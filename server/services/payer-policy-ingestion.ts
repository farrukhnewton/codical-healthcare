import pdfParse from "pdf-parse";
import type { CommercialPayer } from "@shared/schema";

export type PayerPolicyIngestDocument = {
  title: string;
  policyNumber: string | null;
  documentType: string;
  effectiveDate: string | null;
  lastPublishedAt: string | null;
  cptCodes: string[];
  hcpcsCodes: string[];
  drugCodes: string[];
  requirementsText: string;
  sourceUrl: string;
  sourceHost: string;
};

const USER_AGENT =
  "CodicalHealthPolicyIndexer/1.0 (+https://codical.health; provider policy indexing)";
const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;
const MIN_POLICY_SCORE = 4;

function normalizeUrl(value?: string | null) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&ndash;|&mdash;/gi, "-")
    .replace(/&rsquo;|&lsquo;/gi, "'")
    .replace(/&rdquo;|&ldquo;/gi, '"')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)));
}

function stripHtml(html: string) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function rootDomain(host: string) {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".");
  return parts.slice(-2).join(".");
}

function titleFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").filter(Boolean).pop() || "Policy document";
    return decodeURIComponent(last)
      .replace(/\.(pdf|html?|aspx)$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "Policy document";
  }
}

function isGenericTitle(title: string) {
  return /^(view documents?|clinical policy bulletins?|coverage policies?|search|more information|learn more)$/i.test(
    title.trim()
  );
}

function classifyDocument(title: string, url: string) {
  const combined = `${title} ${url}`.toLowerCase();
  if (combined.includes("drug")) return "drug_policy";
  if (combined.includes("bulletin")) return "policy_bulletin";
  if (combined.includes("clinical")) return "clinical_policy";
  if (combined.includes("prior-auth") || combined.includes("prior authorization")) return "prior_authorization";
  return "medical_policy";
}

function scorePolicyLink(text: string, href: string) {
  const combined = `${text} ${href}`.toLowerCase();
  let score = 0;
  if (href.toLowerCase().endsWith(".pdf")) score += 4;
  if (combined.includes("medical policy")) score += 6;
  if (combined.includes("clinical policy")) score += 6;
  if (combined.includes("coverage policy")) score += 6;
  if (combined.includes("drug policy")) score += 5;
  if (combined.includes("policy bulletin")) score += 4;
  if (combined.includes("clinical policy bulletin")) score += 6;
  if (combined.includes("/cpb/")) score += 5;
  if (combined.includes("coveragepolicies")) score += 5;
  if (combined.includes("commercial-medical-drug")) score += 5;
  if (combined.includes("/pdf/coveragepolicies/medical/")) score += 8;
  if (/\([a-z]\d{3,5}\)/i.test(combined) || /\bmm_\d{3,5}/i.test(combined)) score += 4;
  if (combined.includes("applicable procedure codes")) score += 3;
  if (combined.includes("effective date")) score += 2;
  if (combined.includes("policy")) score += 2;
  if (combined.includes("provider")) score += 1;
  if (combined.includes("guidelines") || combined.includes("criteria")) score -= 2;
  if (combined.includes("login") || combined.includes("sign-in")) score -= 5;
  if (combined.includes("privacy") || combined.includes("terms-of-use")) score -= 5;
  return score;
}

function uniqueValues(values: Iterable<string>, limit = 80) {
  const seen = new Set<string>();
  const list = Array.isArray(values) ? values : Array.from(values);
  for (let index = 0; index < list.length; index += 1) {
    const raw = list[index];
    const value = String(raw || "").toUpperCase().trim();
    if (value) seen.add(value);
    if (seen.size >= limit) break;
  }
  return Array.from(seen);
}

function extractCodes(text: string) {
  const normalized = text.replace(/\u00a0/g, " ");
  const cptCodes = uniqueValues(normalized.match(/\b\d{5}\b/g) || []);
  const hcpcsCodes = uniqueValues(normalized.match(/\b[A-Z]\d{4}\b/g) || []);
  const drugCodes = uniqueValues(normalized.match(/\b\d{4,5}-\d{3,4}-\d{1,2}\b/g) || [], 40);
  return { cptCodes, hcpcsCodes, drugCodes };
}

function extractPolicyNumber(title: string, url: string, text: string) {
  const combined = `${title} ${url} ${text.slice(0, 1600)}`;
  const cpb = combined.match(/\bCPB\s*#?\s*(\d{3,4})\b/i);
  if (cpb) return `CPB ${cpb[1]}`;
  const aetnaUrl = url.match(/\/(\d{4})\.html?$/i);
  if (aetnaUrl) return `CPB ${aetnaUrl[1]}`;
  const cigna = url.match(/\/(mm_\d{3,5}[^/.]*)/i);
  if (cigna) return cigna[1].toUpperCase();
  const parenthetical = title.match(/\(([A-Z]\d{3,5})\)/i);
  if (parenthetical) return parenthetical[1].toUpperCase();
  const policy = combined.match(/\b(?:policy|number|reference)\s*(?:no\.?|#|number)?\s*[:\-]?\s*([A-Z]{0,4}\d{3,6}[A-Z0-9.-]*)\b/i);
  return policy ? policy[1].toUpperCase() : null;
}

function extractDate(label: string, text: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`${escaped}\\s*:?\\s*([A-Z][a-z]+\\s+\\d{1,2},\\s+\\d{4}|\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4})`, "i"));
  return match ? match[1] : null;
}

async function fetchBuffer(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/pdf,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Policy source unavailable (${response.status})`);
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_DOCUMENT_BYTES) {
    throw new Error("Policy source is too large to index safely");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_DOCUMENT_BYTES) {
    throw new Error("Policy source is too large to index safely");
  }

  return {
    buffer,
    contentType: response.headers.get("content-type") || "",
    finalUrl: response.url || url,
  };
}

async function readableTextFromBuffer(buffer: Buffer, contentType: string, finalUrl: string) {
  const isPdf = contentType.toLowerCase().includes("pdf") || finalUrl.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    const parsed = await pdfParse(buffer);
    return stripHtml(parsed.text || "");
  }

  return stripHtml(buffer.toString("utf8"));
}

function extractPolicyLinks(html: string, portalUrl: string, payer: CommercialPayer) {
  const portal = new URL(portalUrl);
  const portalRoot = rootDomain(portal.hostname);
  const payerToken = String(payer.shortName || payer.name).toLowerCase().replace(/[^a-z0-9]/g, "");
  const candidates = new Map<string, { url: string; title: string; score: number }>();
  const anchorRe = /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;
  while ((match = anchorRe.exec(html)) !== null) {
    const href = decodeEntities(match[2] || "").trim();
    const text = stripHtml(match[3] || "");
    if (!href || href.startsWith("#") || /^javascript:|^mailto:|^tel:/i.test(href)) continue;

    let url: URL;
    try {
      url = new URL(href, portalUrl);
    } catch {
      continue;
    }

    if (!/^https?:$/i.test(url.protocol)) continue;
    if (/\.(png|jpe?g|gif|svg|css|js|zip|xlsx?)$/i.test(url.pathname)) continue;

    const sameRoot = rootDomain(url.hostname) === portalRoot;
    const combined = `${text} ${url.href}`.toLowerCase();
    const payerRelated = combined.replace(/[^a-z0-9]/g, "").includes(payerToken);
    const score = scorePolicyLink(text, url.href);

    if (!sameRoot && !payerRelated && score < MIN_POLICY_SCORE + 3) continue;
    if (score < MIN_POLICY_SCORE) continue;

    const title = text || titleFromUrl(url.href);
    const existing = candidates.get(url.href);
    if (!existing || existing.score < score) {
      candidates.set(url.href, { url: url.href, title, score });
    }
  }

  return Array.from(candidates.values())
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

export async function discoverPayerPolicies(payer: CommercialPayer, limit = 24) {
  const portalUrl = normalizeUrl(payer.policyPortalUrl);
  if (!portalUrl) {
    throw new Error(`No policy portal configured for ${payer.name}`);
  }

  const portalSource = await fetchBuffer(portalUrl);
  const portalHtml = portalSource.buffer.toString("utf8");
  const candidates = extractPolicyLinks(portalHtml, portalUrl, payer).slice(0, Math.max(1, Math.min(limit * 2, 80)));
  const queue = [...candidates];
  const seen = new Set<string>();
  const documents: PayerPolicyIngestDocument[] = [];

  while (queue.length > 0 && documents.length < limit) {
    const candidate = queue.shift()!;
    if (seen.has(candidate.url)) continue;
    seen.add(candidate.url);

    try {
      const source = await fetchBuffer(candidate.url);
      const isPdf = source.contentType.toLowerCase().includes("pdf") || source.finalUrl.toLowerCase().endsWith(".pdf");
      const rawHtml = isPdf ? "" : source.buffer.toString("utf8");
      const nestedLinks = rawHtml ? extractPolicyLinks(rawHtml, candidate.url, payer) : [];

      if (!isPdf && nestedLinks.length > 0) {
        nestedLinks
          .filter((link) => !seen.has(link.url))
          .slice(0, Math.max(4, limit - documents.length))
          .reverse()
          .forEach((link) => queue.unshift(link));

        if (isGenericTitle(candidate.title)) {
          continue;
        }
      }

      const readableText = await readableTextFromBuffer(source.buffer, source.contentType, source.finalUrl);
      const text = readableText || candidate.title;
      const title = !isGenericTitle(candidate.title) && candidate.title.length > 5
        ? candidate.title
        : titleFromUrl(candidate.url);
      const sourceHost = new URL(candidate.url).hostname.replace(/^www\./, "");
      const { cptCodes, hcpcsCodes, drugCodes } = extractCodes(text);

      documents.push({
        title: title.slice(0, 260),
        policyNumber: extractPolicyNumber(title, candidate.url, text),
        documentType: classifyDocument(title, candidate.url),
        effectiveDate: extractDate("Effective Date", `${candidate.title} ${text}`),
        lastPublishedAt:
          extractDate("Last Published", `${candidate.title} ${text}`) ||
          extractDate("Last Review", `${candidate.title} ${text}`),
        cptCodes,
        hcpcsCodes,
        drugCodes,
        requirementsText: text.slice(0, 7000) || title,
        sourceUrl: candidate.url,
        sourceHost,
      });
    } catch {
      const title = candidate.title || titleFromUrl(candidate.url);
      documents.push({
        title: title.slice(0, 260),
        policyNumber: extractPolicyNumber(title, candidate.url, ""),
        documentType: classifyDocument(title, candidate.url),
        effectiveDate: null,
        lastPublishedAt: null,
        cptCodes: [],
        hcpcsCodes: [],
        drugCodes: [],
        requirementsText: `Indexed source metadata from ${candidate.url}. Full document text could not be fetched from this network route.`,
        sourceUrl: candidate.url,
        sourceHost: new URL(candidate.url).hostname.replace(/^www\./, ""),
      });
    }
  }

  return documents;
}
