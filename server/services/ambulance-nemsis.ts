import { createHash } from "node:crypto";

export type NemsisEvidence = {
  element: string;
  value: string;
  source: "nemsis-xml";
};

export type NemsisImportResult = {
  standard: "NEMSIS";
  detectedVersion: string | null;
  fileSha256: string;
  structuralStatus: "accepted" | "accepted-with-warnings";
  recordNumber: string | null;
  patientName: string | null;
  response: Record<string, string | null>;
  disposition: Record<string, string | null>;
  symptoms: string[];
  medications: Array<{ name: string; route: string | null; response: string | null }>;
  procedures: Array<{ name: string; successful: string | null }>;
  evidence: NemsisEvidence[];
  validation: Array<{ severity: "warning" | "error"; message: string }>;
  unmappedElements: number;
};

const MAX_NEMSIS_BYTES = 10 * 1024 * 1024;

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function values(xml: string, element: string) {
  const escaped = element.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<(?:(?:[A-Za-z_][\\w.-]*):)?${escaped}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:[A-Za-z_][\\w.-]*):)?${escaped}>`, "gi");
  return Array.from(xml.matchAll(pattern))
    .map((match) => decodeXml(match[1].replace(/<[^>]*>/g, " ")))
    .filter(Boolean);
}

function first(xml: string, ...elements: string[]) {
  for (const element of elements) {
    const value = values(xml, element)[0];
    if (value) return value;
  }
  return null;
}

function groupValues(xml: string, group: string, selectors: Record<string, string[]>) {
  const escaped = group.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<(?:(?:[A-Za-z_][\\w.-]*):)?${escaped}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:[A-Za-z_][\\w.-]*):)?${escaped}>`, "gi");
  return Array.from(xml.matchAll(pattern)).map((match) => Object.fromEntries(
    Object.entries(selectors).map(([key, tags]) => [key, first(match[1], ...tags)]),
  ));
}

export function parseNemsisXml(input: Buffer | string): NemsisImportResult {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  if (!buffer.length) throw new Error("The NEMSIS file is empty.");
  if (buffer.length > MAX_NEMSIS_BYTES) throw new Error("NEMSIS XML files must be 10 MB or smaller.");
  const xml = buffer.toString("utf8").replace(/^\uFEFF/, "");
  if (/<!DOCTYPE|<!ENTITY|SYSTEM\s+["']|PUBLIC\s+["']/i.test(xml)) throw new Error("External entities and document type declarations are not allowed.");
  if (!/^\s*<\?xml\b|^\s*<[A-Za-z_]/.test(xml)) throw new Error("The upload is not recognizable XML.");
  if (!/<(?:(?:[A-Za-z_][\w.-]*):)?EMSDataSet\b/i.test(xml)) throw new Error("Expected a NEMSIS EMSDataSet root element.");

  const validation: NemsisImportResult["validation"] = [];
  const version = xml.match(/<(?:(?:[A-Za-z_][\w.-]*):)?EMSDataSet\b[^>]*(?:version|nemesisVersion|nemsisVersion)=["']([^"']+)["']/i)?.[1]
    ?? xml.match(/release-(3\.[0-9.]+)/i)?.[1]
    ?? null;
  if (!version) validation.push({ severity: "warning", message: "The NEMSIS version was not declared in the root/schema location." });
  if (version && !/^3\.(4|5)/.test(version)) validation.push({ severity: "warning", message: `Version ${version} is outside the tested NEMSIS 3.4/3.5 import range.` });

  const recordNumber = first(xml, "eRecord.01");
  if (!recordNumber) validation.push({ severity: "warning", message: "eRecord.01 (patient care report number) was not found." });
  const lastName = first(xml, "ePatient.02");
  const firstName = first(xml, "ePatient.03");
  const patientName = [firstName, lastName].filter(Boolean).join(" ") || null;
  const response = {
    agencyNumber: first(xml, "eResponse.01"),
    unitNumber: first(xml, "eResponse.13"),
    serviceRequested: first(xml, "eResponse.05"),
    primaryRole: first(xml, "eResponse.07"),
    dispatchComplaint: first(xml, "eDispatch.01"),
    responseMode: first(xml, "eResponse.23"),
  };
  const disposition = {
    patientDisposition: first(xml, "eDisposition.12"),
    destinationName: first(xml, "eDisposition.01"),
    destinationType: first(xml, "eDisposition.21"),
    transportMethod: first(xml, "eDisposition.17"),
    transportMode: first(xml, "eDisposition.18"),
    destinationZip: first(xml, "eDisposition.07"),
  };
  const symptoms = Array.from(new Set([
    ...values(xml, "eSituation.09"),
    ...values(xml, "eSituation.10"),
    ...values(xml, "eSituation.11"),
  ])).slice(0, 40);
  const medications = groupValues(xml, "eMedications.MedicationGroup", {
    name: ["eMedications.03"], route: ["eMedications.05"], response: ["eMedications.07"],
  }).filter((row) => row.name).map((row) => ({ name: row.name!, route: row.route, response: row.response }));
  const procedures = groupValues(xml, "eProcedures.ProcedureGroup", {
    name: ["eProcedures.03"], successful: ["eProcedures.06"],
  }).filter((row) => row.name).map((row) => ({ name: row.name!, successful: row.successful }));

  const evidence: NemsisEvidence[] = [];
  const evidenceMap: Record<string, string | null | undefined> = {
    "eRecord.01": recordNumber,
    "ePatient.02/ePatient.03": patientName,
    "eResponse.05": response.serviceRequested,
    "eResponse.23": response.responseMode,
    "eDispatch.01": response.dispatchComplaint,
    "eDisposition.12": disposition.patientDisposition,
    "eDisposition.21": disposition.destinationType,
  };
  for (const [element, value] of Object.entries(evidenceMap)) {
    if (value) evidence.push({ element, value, source: "nemsis-xml" });
  }
  symptoms.forEach((value) => evidence.push({ element: "eSituation", value, source: "nemsis-xml" }));

  const elementCount = (xml.match(/<(?!(?:\/|\?|!))[A-Za-z_][\w.:-]*(?:\s|>)/g) ?? []).length;
  const mappedCount = evidence.length + medications.length + procedures.length;
  validation.push({ severity: "warning", message: "The import performs safe structural parsing and evidence mapping. NEMSIS certification-grade XSD and Schematron validation must run in the managed ingestion pipeline before production exchange." });

  return {
    standard: "NEMSIS",
    detectedVersion: version,
    fileSha256: createHash("sha256").update(buffer).digest("hex"),
    structuralStatus: validation.length ? "accepted-with-warnings" : "accepted",
    recordNumber,
    patientName,
    response,
    disposition,
    symptoms,
    medications,
    procedures,
    evidence,
    validation,
    unmappedElements: Math.max(0, elementCount - mappedCount),
  };
}
