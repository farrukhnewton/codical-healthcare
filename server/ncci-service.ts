import { pool } from "./db";

export type NcciCheckType = "practitioner" | "outpatient";

export type NcciCheckResult = {
  hasEdit: boolean;
  message: string;
  col1?: string;
  col2?: string;
  col1_code?: string;
  col2_code?: string;
  modifier_indicator?: string | null;
  effective_date?: string | null;
  deletion_date?: string | null;
  rationale?: string | null;
  modifierAllowed?: boolean;
  source?: string;
  lookupDirection?: string;
};

export type NcciBatchCheckResult = {
  source: "cloudflare-ncci";
  type: NcciCheckType;
  codes: string[];
  pairCount: number;
  counts: {
    edits: number;
    modifierAllowed: number;
    modifierNotAllowed: number;
    noEdit: number;
  };
  pairs: Array<NcciCheckResult & {
    inputCol1: string;
    inputCol2: string;
    type: NcciCheckType;
  }>;
};

function normalizeCode(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function normalizeType(value: unknown): NcciCheckType {
  return value === "outpatient" ? "outpatient" : "practitioner";
}

function normalizeUniqueCodes(values: unknown, max = 8) {
  const input = Array.isArray(values)
    ? values
    : typeof values === "string"
      ? values.split(/[\s,;]+/)
      : [];
  const seen = new Set<string>();
  const codes: string[] = [];

  for (const value of input) {
    const code = normalizeCode(value);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
    if (codes.length >= max) break;
  }

  return codes;
}

function noEditResult(col1: string, col2: string, source: string): NcciCheckResult {
  return {
    hasEdit: false,
    message: "No NCCI edit found - these codes can be billed together",
    col1,
    col2,
    source,
  };
}

async function checkCloudflareNcci(col1: string, col2: string, type: NcciCheckType) {
  const baseUrl = process.env.CLOUDFLARE_NCCI_API_URL?.replace(/\/+$/, "");
  if (!baseUrl) return null;

  const url = new URL("/api/ncci/check", baseUrl);
  url.searchParams.set("col1", col1);
  url.searchParams.set("col2", col2);
  url.searchParams.set("type", type);

  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Cloudflare NCCI lookup failed with HTTP ${response.status}`);
  }

  return (await response.json()) as NcciCheckResult;
}

async function checkSupabaseNcci(col1: string, col2: string, type: NcciCheckType) {
  const table = type === "outpatient" ? "ncci_outpatient" : "ncci_practitioner";
  const result = await pool.query(
    `select col1_code, col2_code, effective_date, deletion_date, modifier_indicator, rationale
     from ${table}
     where (col1_code = $1 and col2_code = $2)
        or (col1_code = $2 and col2_code = $1)
     limit 1`,
    [col1, col2],
  );

  if (result.rows.length === 0) {
    return noEditResult(col1, col2, "supabase");
  }

  const edit = result.rows[0];
  return {
    hasEdit: true,
    col1_code: edit.col1_code,
    col2_code: edit.col2_code,
    modifier_indicator: edit.modifier_indicator,
    effective_date: edit.effective_date,
    deletion_date: edit.deletion_date,
    rationale: edit.rationale,
    modifierAllowed: edit.modifier_indicator === "1",
    source: "supabase",
    message:
      edit.modifier_indicator === "0"
        ? "Edit exists - modifier NOT allowed"
        : edit.modifier_indicator === "1"
          ? "Edit exists - modifier allowed"
          : "Edit exists - not applicable",
  } satisfies NcciCheckResult;
}

export async function checkNcciEdit(rawCol1: unknown, rawCol2: unknown, rawType: unknown) {
  const col1 = normalizeCode(rawCol1);
  const col2 = normalizeCode(rawCol2);
  const type = normalizeType(rawType);

  if (!col1 || !col2) {
    const error = new Error("Both CPT codes required");
    (error as any).statusCode = 400;
    throw error;
  }

  try {
    const cloudflareResult = await checkCloudflareNcci(col1, col2, type);
    if (cloudflareResult) return cloudflareResult;
  } catch (error: any) {
    console.warn("Cloudflare NCCI lookup failed; falling back to Supabase:", error?.message || error);
  }

  return checkSupabaseNcci(col1, col2, type);
}

export async function checkNcciBatchEdits(rawCodes: unknown, rawType: unknown): Promise<NcciBatchCheckResult> {
  const type = normalizeType(rawType);
  const codes = normalizeUniqueCodes(rawCodes, 8);

  if (codes.length < 2) {
    const error = new Error("At least two CPT/HCPCS codes required");
    (error as any).statusCode = 400;
    throw error;
  }

  const pairs: NcciBatchCheckResult["pairs"] = [];

  for (let i = 0; i < codes.length; i += 1) {
    for (let j = i + 1; j < codes.length; j += 1) {
      const inputCol1 = codes[i];
      const inputCol2 = codes[j];
      const result = await checkNcciEdit(inputCol1, inputCol2, type);

      pairs.push({
        ...result,
        inputCol1,
        inputCol2,
        type,
      });
    }
  }

  const counts = pairs.reduce(
    (summary, pair) => {
      if (!pair.hasEdit) {
        summary.noEdit += 1;
        return summary;
      }

      summary.edits += 1;
      if (pair.modifierAllowed) {
        summary.modifierAllowed += 1;
      } else {
        summary.modifierNotAllowed += 1;
      }
      return summary;
    },
    { edits: 0, modifierAllowed: 0, modifierNotAllowed: 0, noEdit: 0 },
  );

  return {
    source: "cloudflare-ncci",
    type,
    codes,
    pairCount: pairs.length,
    counts,
    pairs,
  };
}
