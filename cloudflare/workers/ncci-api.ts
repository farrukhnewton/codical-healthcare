type Env = {
  NCCI_BUCKET: R2Bucket;
};

type NcciKind = "practitioner" | "outpatient";
type NcciEditTuple = [modifierIndicator: string, effectiveDate: string, deletionDate: string, rationale: string];
type NcciShard = {
  version: string;
  kind: NcciKind;
  col1: string;
  count: number;
  edits: Record<string, NcciEditTuple>;
};

const NCCI_PREFIX = "ncci/v1";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
      "cache-control": status === 200 ? "public, max-age=120" : "no-store",
    },
  });
}

function normalizeCode(value: string | null) {
  return (value || "").trim().toUpperCase();
}

function shardKey(kind: NcciKind, code: string) {
  return `${NCCI_PREFIX}/${kind}/${encodeURIComponent(code)}.json`;
}

async function readShard(bucket: R2Bucket, kind: NcciKind, code: string) {
  const object = await bucket.get(shardKey(kind, code));
  if (!object) return null;
  return (await object.json()) as NcciShard;
}

async function findEdit(bucket: R2Bucket, kind: NcciKind, col1: string, col2: string) {
  const firstShard = await readShard(bucket, kind, col1);
  const firstEdit = firstShard?.edits[col2];
  if (firstEdit) {
    return { originalCol1: col1, originalCol2: col2, edit: firstEdit, lookupDirection: "forward" };
  }

  const secondShard = await readShard(bucket, kind, col2);
  const secondEdit = secondShard?.edits[col1];
  if (secondEdit) {
    return { originalCol1: col2, originalCol2: col1, edit: secondEdit, lookupDirection: "reverse" };
  }

  return null;
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, OPTIONS",
          "access-control-allow-headers": "content-type, authorization",
        },
      });
    }

    if (url.pathname === "/health") {
      return json({ ok: true, service: "codical-ncci-api", source: "cloudflare-r2" });
    }

    if (url.pathname !== "/api/ncci/check") {
      return json({ message: "Not found" }, 404);
    }

    const col1 = normalizeCode(url.searchParams.get("col1"));
    const col2 = normalizeCode(url.searchParams.get("col2"));
    const type = url.searchParams.get("type") === "outpatient" ? "outpatient" : "practitioner";

    if (!col1 || !col2) {
      return json({ message: "Both CPT codes required" }, 400);
    }

    const found = await findEdit(env.NCCI_BUCKET, type, col1, col2);
    if (!found) {
      return json({
        hasEdit: false,
        message: "No NCCI edit found - these codes can be billed together",
        col1,
        col2,
        source: "cloudflare-r2",
      });
    }

    const [modifierIndicator, effectiveDate, deletionDate, rationale] = found.edit;

    return json({
      hasEdit: true,
      col1_code: found.originalCol1,
      col2_code: found.originalCol2,
      modifier_indicator: modifierIndicator,
      effective_date: effectiveDate || null,
      deletion_date: deletionDate || null,
      rationale: rationale || null,
      modifierAllowed: modifierIndicator === "1",
      lookupDirection: found.lookupDirection,
      source: "cloudflare-r2",
      message:
        modifierIndicator === "0"
          ? "Edit exists - modifier NOT allowed"
          : modifierIndicator === "1"
            ? "Edit exists - modifier allowed"
            : "Edit exists - not applicable",
    });
  },
};
