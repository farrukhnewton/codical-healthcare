import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, Dna, Download, FileSearch, FileText, Image, Loader2, RotateCcw, Save, ScanLine, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { fileNeedsBrowserOcr, scanPgxDocument, type PgxOcrProgress } from "@/lib/pgx-ocr";
import { useToast } from "@/hooks/use-toast";

type DiagnosisSelection = { code: string; description?: string; selectionType: "circled_preprinted" | "checked_preprinted" | "handwritten_circled" | "handwritten" | "other_mark"; page: number; confidence: number; evidence: string; source: "vision" };
type PatientMatch = { labName?: string; requisitionName?: string; documentsMatch: boolean; databaseStatus: "matched" | "not_found" | "ambiguous" | "document_mismatch" | "not_checked"; databasePatient?: { id: number; name: string } };
type Extracted = {
  patient: { name?: string }; patientMatch?: PatientMatch;
  lab: { name?: string }; orderingProvider?: { name?: string; npi?: string };
  diagnosisCodes: string[]; diagnosisSelections?: DiagnosisSelection[];
  genes: Array<{ gene: string; genotype?: string; phenotype?: string; confidence: number }>;
  medications: Array<{ name: string; drugClass?: string; source: "detected" | "manual" }>;
  panel: { geneCount: number; hasDupDel: boolean; detectedPanelName?: string }; warnings: string[];
};
type ServiceLine = { lineNumber: number; cptCode: string | null; description: string; units: number; genes: string[]; medications: string[]; diagnosisCodes: string[]; diagnosisPointers: number[]; cmsMatches: Array<{ diagnosisCode: string; groupNumber: number; articleId: string }>; codingBasis: "qualifying_panel" | "single_gene_test" | "separate_test_confirmation" | "unlisted_review"; status: "ready" | "review"; issues: string[] };
type EvidenceRow = { gene: string; genotype?: string; phenotype?: string; medications: string[]; evidence: string[]; cmsArticleIds: string[]; separateTestCptReference: string | null; status: "ready" | "review"; issues: string[] };
type Analysis = {
  extracted: Extracted;
  cptSelection: { type: "panel" | "stacked" | "unlisted"; codes: Array<{ code: string; description: string; units: number; gene?: string }>; notes: string[] };
  icd10: Array<{ code: string; status: "supported" | "manual_review"; groupNumber?: number; rationale: string }>;
  medicalNecessity: { isMet: boolean; reason: string; actionablePairs: Array<{ gene: string; drug: string; cpicLevel: string; tableSource: string; recommendation: string }> };
  auditChecklist: { gates: Array<{ id: string; label: string; passed: boolean; message: string }>; allPassed: boolean };
  billingWorksheet: { format: "PGX_BILLING_WORKSHEET"; articleId: string; lcdId: string; serviceState?: string; documentedDiagnosisCodes: string[]; serviceLines: ServiceLine[]; evidenceRows: EvidenceRow[]; notes: string[] };
  disclaimer: string;
};
type ClaimPreview = { claimType: "PGX_BILLING_WORKSHEET"; articleId?: string; serviceState?: string; patient: { name: string | null }; documentedDiagnosisCodes: string[]; serviceLines: ServiceLine[]; evidenceRows: EvidenceRow[]; notes: string[]; audit: Analysis["auditChecklist"]; disclaimer: string };
type Generated = { claimJson: ClaimPreview; filename: string; pdfBase64?: string; downloadUrl?: string | null };

async function pgxFetch(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session?.access_token) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), path.endsWith("/extract") ? 150_000 : 75_000);
  try {
    const response = await fetch(path, { ...init, headers, credentials: "include", signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || `PGx request failed (HTTP ${response.status}).`);
    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Document analysis timed out. Your files and review fields remain on this page; try again.");
    if (error instanceof TypeError || (error instanceof Error && /networkerror|failed to fetch|load failed/i.test(error.message))) throw new Error("The PGx service could not be reached. Your extracted data was kept; retry when the server connection is available.");
    throw error;
  } finally { window.clearTimeout(timeout); }
}

function manualIcdCodes(value: string) { return value.split(/[,;\s]+/).map((code) => code.trim().toUpperCase()).filter(Boolean); }
function validIcd(value: string) { return manualIcdCodes(value).every((code) => /^[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?$/.test(code)); }
const MEDICARE_SERVICE_AREAS = new Set("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR VI GU AS MP".split(" "));
function validServiceState(value: string) { return MEDICARE_SERVICE_AREAS.has(value.trim().toUpperCase()); }
function selectionLabel(type: DiagnosisSelection["selectionType"]) { return ({ circled_preprinted: "Circled printed option", checked_preprinted: "Checked printed option", handwritten_circled: "Circled handwriting", handwritten: "Handwritten", other_mark: "Marked option" })[type]; }
function downloadPdf(base64: string, filename: string) { const bytes = Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0)); const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); }

function BillingWorksheet({ claim }: { claim: ClaimPreview }) {
  return <article className="pgx-paper-claim" aria-label="PGx billing worksheet">
    <header><div><span>Coder worksheet</span><h3>Billable services and PGx evidence</h3></div><strong>{claim.articleId || "CMS MCD"}{claim.serviceState ? ` · ${claim.serviceState}` : ""} · REVIEW COPY</strong></header>
    <section className="pgx-claim-diagnoses"><span>Source-documented diagnoses</span><strong>{claim.documentedDiagnosisCodes.join(", ") || "None documented — hold claim"}</strong></section>
    <div className="pgx-billing-table-wrap"><table className="pgx-billing-table pgx-service-lines"><caption>Billable laboratory service lines</caption><thead><tr><th>Line</th><th>CPT</th><th>Units</th><th>Tested content</th><th>Required drugs</th><th>Supported diagnosis</th><th>Status</th></tr></thead><tbody>{claim.serviceLines.length ? claim.serviceLines.map((line) => <tr key={`${line.lineNumber}-${line.cptCode}`} className={line.status === "ready" ? "is-ready" : "is-review"}><td><strong>{line.lineNumber}</strong></td><td><strong>{line.cptCode || "Hold"}</strong><small>{line.description}</small></td><td>{line.units}</td><td>{line.genes.join(", ") || "Review"}</td><td>{line.medications.join(", ") || "None linked"}</td><td>{line.diagnosisCodes.join(", ") || "None supported"}{line.diagnosisPointers.length ? <small>Pointers {line.diagnosisPointers.join(", ")}</small> : null}</td><td><strong>{line.status === "ready" ? "Ready" : "Review"}</strong>{line.issues.length ? <small>{line.issues.join(" ")}</small> : line.cmsMatches.length ? <small>{Array.from(new Set(line.cmsMatches.map((match) => `${match.articleId} group ${match.groupNumber}`))).join(" · ")}</small> : null}</td></tr>) : <tr className="is-review"><td colSpan={7}>No billable service could be determined from the source documents.</td></tr>}</tbody></table></div>
    <div className="pgx-billing-table-wrap"><table className="pgx-billing-table pgx-evidence-table"><caption>Gene-medication evidence — not additional claim lines</caption><thead><tr><th>Gene</th><th>Result</th><th>Active actionable medication</th><th>Evidence</th><th>Separate-test CPT reference</th><th>Status</th></tr></thead><tbody>{claim.evidenceRows.map((row) => <tr key={row.gene} className={row.status === "ready" ? "is-ready" : "is-review"}><td><strong>{row.gene}</strong></td><td>{[row.genotype, row.phenotype].filter(Boolean).join(" · ") || "Review"}</td><td>{row.medications.join(", ") || "No match"}</td><td>{[...row.evidence, ...row.cmsArticleIds].join(" · ") || "Review"}</td><td>{row.separateTestCptReference || "No specific reference"}<small>Only if separately ordered and performed</small></td><td><strong>{row.status === "ready" ? "Supported" : "Review"}</strong>{row.issues.length ? <small>{row.issues.join(" ")}</small> : null}</td></tr>)}</tbody></table></div>
    <div className="pgx-form-guidance"><ShieldCheck size={16} /><p>{claim.notes.join(" ")}</p></div>
  </article>;
}

export function PgxWorkspace() {
  const { toast } = useToast();
  const [labReport, setLabReport] = useState<File | null>(null); const [requisition, setRequisition] = useState<File | null>(null);
  const [labText, setLabText] = useState(""); const [requisitionText, setRequisitionText] = useState("");
  const [primaryIcd10, setPrimaryIcd10] = useState(""); const [drugNames, setDrugNames] = useState("");
  const [serviceState, setServiceState] = useState("");
  const [confirmed, setConfirmed] = useState(false); const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null); const [claim, setClaim] = useState<Generated | null>(null);
  const [busy, setBusy] = useState<"scan" | "build" | "save" | null>(null); const [ocrProgress, setOcrProgress] = useState<PgxOcrProgress | null>(null); const [error, setError] = useState("");

  const reset = () => { setLabReport(null); setRequisition(null); setLabText(""); setRequisitionText(""); setPrimaryIcd10(""); setDrugNames(""); setServiceState(""); setExtracted(null); setAnalysis(null); setClaim(null); setConfirmed(false); setOcrProgress(null); setError(""); };
  const extractDocuments = async () => {
    if (!labReport && !requisition && labText.trim().length < 20 && requisitionText.trim().length < 20) return setError("Upload a lab report and requisition, or paste enough text to begin.");
    setBusy("scan"); setError(""); setAnalysis(null); setClaim(null); setConfirmed(false);
    try {
      let scannedLab = "", scannedReq = ""; const localWarnings: string[] = [];
      let diagnosisPageImages: Array<{ pageNumber: number; blob: Blob }> = [];
      for (const [file, kind] of [[labReport, "lab"], [requisition, "requisition"]] as const) {
        if (!file || !fileNeedsBrowserOcr(file)) continue;
        try { const result = await scanPgxDocument(file, setOcrProgress, { preferNativeText: kind === "lab", handwritingMode: kind === "requisition" }); if (kind === "lab") scannedLab = result.text; else { scannedReq = result.text; diagnosisPageImages = result.diagnosisPageImages; } localWarnings.push(...result.warnings.map((warning) => `${file.name}: ${warning}`)); }
        catch { localWarnings.push(`${file.name}: local OCR could not read every mark; server visual OCR and manual verification are required.`); }
      }
      const form = new FormData(); if (labReport) form.append("labReport", labReport); if (requisition) form.append("requisition", requisition);
      for (const pageImage of diagnosisPageImages) form.append("diagnosisPageImages", pageImage.blob, `diagnosis-page-${pageImage.pageNumber}.jpg`);
      form.append("labText", [labText, scannedLab].filter(Boolean).join("\n\n")); form.append("requisitionText", [requisitionText, scannedReq].filter(Boolean).join("\n\n"));
      const payload = await pgxFetch("/api/pgx/extract", { method: "POST", body: form }); const result = payload.extracted as Extracted;
      setExtracted({ ...result, warnings: [...result.warnings, ...localWarnings] }); setPrimaryIcd10(result.diagnosisCodes.join(", ")); setDrugNames(result.medications.map((item) => item.name).join(", ")); setOcrProgress(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Document analysis failed."); } finally { setBusy(null); }
  };
  const buildWorksheet = async () => {
    if (!extracted || !confirmed) return setError("Compare the extracted name, diagnoses, and medications with both source documents, then confirm the review.");
    if (!validIcd(primaryIcd10)) return setError("One or more documented diagnosis codes do not use valid ICD-10-CM syntax.");
    if (!validServiceState(serviceState)) return setError("Enter a valid two-letter Medicare service state so the correct MAC article can be used.");
    if (extracted.patientMatch?.databaseStatus === "document_mismatch") return setError("The patient names do not match. Correct the document pair before coding.");
    setBusy("build"); setError(""); setClaim(null);
    try {
      const diagnosisCodes = manualIcdCodes(primaryIcd10);
      const analyzed = await pgxFetch("/api/pgx/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ extracted, primaryIcd10: diagnosisCodes[0], diagnosisCodes, drugNames, stateCode: serviceState.trim().toUpperCase() }) });
      const result = analyzed.analysis as Analysis;
      if (!result?.billingWorksheet || !Array.isArray(result.billingWorksheet.serviceLines) || !Array.isArray(result.billingWorksheet.evidenceRows)) {
        throw new Error("The PGx API is running an older claim format. Restart the Codical development server, then click Build billing worksheet again; your extracted review is still preserved.");
      }
      setAnalysis(result);
      const generated = await pgxFetch("/api/pgx/generate-claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analysis: result }) });
      const claimJson: ClaimPreview = {
        claimType: "PGX_BILLING_WORKSHEET",
        articleId: generated?.claimJson?.articleId || result.billingWorksheet.articleId,
        serviceState: generated?.claimJson?.serviceState || result.billingWorksheet.serviceState,
        patient: { name: generated?.claimJson?.patient?.name || result.extracted.patient.name || null },
        documentedDiagnosisCodes: Array.isArray(generated?.claimJson?.documentedDiagnosisCodes) ? generated.claimJson.documentedDiagnosisCodes : result.billingWorksheet.documentedDiagnosisCodes,
        serviceLines: Array.isArray(generated?.claimJson?.serviceLines) ? generated.claimJson.serviceLines : result.billingWorksheet.serviceLines,
        evidenceRows: Array.isArray(generated?.claimJson?.evidenceRows) ? generated.claimJson.evidenceRows : result.billingWorksheet.evidenceRows,
        notes: Array.isArray(generated?.claimJson?.notes) ? generated.claimJson.notes : result.billingWorksheet.notes,
        audit: result.auditChecklist,
        disclaimer: generated?.claimJson?.disclaimer || result.disclaimer,
      };
      setClaim({ claimJson, filename: generated.filename || "PGx_Billing_Worksheet.pdf", pdfBase64: generated.pdfBase64, downloadUrl: generated.downloadUrl });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The coding worksheet could not be built."); } finally { setBusy(null); }
  };
  const save = async () => { if (!analysis) return; setBusy("save"); try { await pgxFetch("/api/pgx/analyses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analysis, claimJson: claim?.claimJson }) }); toast({ title: "PGx review saved", description: "The billing worksheet is available in PGx history." }); } catch (caught) { setError(caught instanceof Error ? caught.message : "Save failed."); } finally { setBusy(null); } };

  return <div className="specialty-page pgx-workspace-page pgx-workspace-redesign">
    <header className="pgx-workspace-header tool-panel"><div className="pgx-title-block"><Link href="/specialty" className="pgx-back-link"><ChevronLeft size={15} /> Specialty Coding</Link><div><span className="pgx-title-icon"><Dna size={23} /></span><div><h1>PGx Coding Engine</h1><p>Read laboratory and handwritten requisition documents, verify the patient, and build a CMS-supported billing worksheet.</p></div></div></div><div className="pgx-header-actions"><button type="button" onClick={reset}><RotateCcw size={15} /> New review</button><button type="button" onClick={save} disabled={!analysis || busy !== null}><Save size={15} /> Save</button></div></header>
    {error ? <div className="pgx-error-banner" role="alert"><AlertTriangle size={17} /><span>{error}</span></div> : null}
    <div className="pgx-workspace-grid"><main className="pgx-main-column">
      <section className="pgx-main-panel tool-panel"><div className="pgx-section-head"><span><ScanLine size={18} /></span><div><h2>Scan source documents</h2><p>Visual OCR checks printed text, handwriting, circles, checks, and marked diagnosis rows.</p></div></div><div className="pgx-upload-grid">
        <label className={`pgx-upload-zone${labReport ? " has-file" : ""}`}><FileText size={24} /><strong>{labReport?.name || "PGx laboratory report"}</strong><span>PDF, PNG, JPG or TXT · up to 20 MB</span><input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={(event) => setLabReport(event.target.files?.[0] || null)} /></label>
        <label className={`pgx-upload-zone${requisition ? " has-file" : ""}`}><Image size={24} /><strong>{requisition?.name || "Physician requisition"}</strong><span>Handwriting and marked forms supported</span><input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={(event) => setRequisition(event.target.files?.[0] || null)} /></label>
      </div><details className="pgx-manual-entry"><summary>Paste source text if needed</summary><div className="pgx-text-grid"><label><span>Lab report text</span><textarea value={labText} onChange={(event) => setLabText(event.target.value)} /></label><label><span>Requisition text</span><textarea value={requisitionText} onChange={(event) => setRequisitionText(event.target.value)} /></label></div></details>
      {ocrProgress ? <div className="pgx-ocr-progress" role="status"><ScanLine size={17} /><div><strong>{ocrProgress.status}</strong><span>{ocrProgress.fileName}</span><progress max={1} value={ocrProgress.progress} /></div><b>{Math.round(ocrProgress.progress * 100)}%</b></div> : null}<div className="pgx-action-row"><span>Every handwritten or low-confidence result still requires source verification.</span><button type="button" className="tool-primary-button" onClick={extractDocuments} disabled={busy !== null}>{busy === "scan" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Scan documents</button></div></section>
      {extracted ? <section className="pgx-main-panel tool-panel"><div className="pgx-section-head is-success"><span><CheckCircle2 size={18} /></span><div><h2>Verify extracted information</h2><p>Only patient name is used for document and patient-database matching.</p></div></div>
        <div className="pgx-fact-grid"><article><span>Patient</span><strong>{extracted.patient.name || "Not detected"}</strong><small>{extracted.patientMatch?.databaseStatus === "matched" ? "Matched to patient database" : extracted.patientMatch?.databaseStatus?.replaceAll("_", " ") || "Match not checked"}</small></article><article><span>Lab ↔ requisition</span><strong>{extracted.patientMatch?.documentsMatch ? "Names match" : "Needs review"}</strong><small>{[extracted.patientMatch?.labName, extracted.patientMatch?.requisitionName].filter(Boolean).join(" · ") || "Names not found on both documents"}</small></article><article><span>Panel</span><strong>{extracted.panel.detectedPanelName || "PGx panel"}</strong><small>{extracted.genes.length} tested genes</small></article></div>
        <div className="pgx-review-fields"><label><span>Documented ICD-10-CM codes</span><input className="tool-input" value={primaryIcd10} onChange={(event) => { setPrimaryIcd10(event.target.value.toUpperCase()); setConfirmed(false); }} placeholder="F25.1, F33.2" aria-invalid={!validIcd(primaryIcd10)} />{!validIcd(primaryIcd10) ? <small className="pgx-field-error">Use valid comma-separated ICD-10-CM codes.</small> : null}</label><label><span>Active medications</span><input className="tool-input" value={drugNames} onChange={(event) => { setDrugNames(event.target.value); setConfirmed(false); }} placeholder="Comma-separated medications" /></label><label><span>Medicare service state</span><input className="tool-input" value={serviceState} maxLength={2} onChange={(event) => { setServiceState(event.target.value.toUpperCase().replace(/[^A-Z]/g, "")); setConfirmed(false); }} placeholder="NY" aria-invalid={Boolean(serviceState) && !validServiceState(serviceState)} />{serviceState && !validServiceState(serviceState) ? <small className="pgx-field-error">Use a valid US service-area code.</small> : null}</label></div>
        {extracted.diagnosisSelections?.length ? <div className="pgx-diagnosis-evidence"><div className="pgx-diagnosis-evidence-head"><div><h3>Marked diagnoses found</h3><p>Select only after comparing the named page with the requisition.</p></div></div><div className="pgx-diagnosis-evidence-list">{extracted.diagnosisSelections.map((item) => <button type="button" key={`${item.code}-${item.page}`} className={primaryIcd10 === item.code ? "is-selected" : ""} onClick={() => { setPrimaryIcd10(item.code); setConfirmed(false); }}><span><strong>{item.code}</strong><small>{item.description || "Description needs review"}</small></span><span><b>{selectionLabel(item.selectionType)}</b><small>Page {item.page} · {Math.round(item.confidence * 100)}%</small></span></button>)}</div></div> : null}
        <div className="pgx-table-wrap"><div className="pgx-table-head"><h3>Tested gene results</h3><span>{extracted.genes.length}</span></div><table><thead><tr><th>Gene</th><th>Genotype</th><th>Phenotype</th><th>Confidence</th></tr></thead><tbody>{extracted.genes.map((gene) => <tr key={gene.gene}><td><strong>{gene.gene}</strong></td><td>{gene.genotype || "Review"}</td><td>{gene.phenotype || "Review"}</td><td>{Math.round(gene.confidence * 100)}%</td></tr>)}</tbody></table></div>
        {extracted.warnings.length ? <div className="pgx-warning-list">{extracted.warnings.map((warning, index) => <p key={`${warning}-${index}`}><AlertTriangle size={14} /> {warning}</p>)}</div> : null}
        <label className="pgx-review-confirmation"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span><strong>I compared the patient name, diagnosis, and active medications with both documents.</strong> I understand that uncertain handwriting must remain in review.</span></label><div className="pgx-action-row"><span>Only performed laboratory services become claim lines; gene results remain supporting evidence.</span><button type="button" className="tool-primary-button" onClick={buildWorksheet} disabled={busy !== null || !confirmed}>{busy === "build" ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} Build billing worksheet</button></div>
      </section> : null}
      {analysis ? <section className="pgx-main-panel tool-panel"><div className="pgx-section-head"><span><ShieldCheck size={18} /></span><div><h2>CMS coding review</h2><p>{analysis.medicalNecessity.reason}</p></div></div><div className="pgx-audit-list">{analysis.auditChecklist.gates.map((gate) => <article key={gate.id} className={gate.passed ? "is-passed" : ""}><span>{gate.passed ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}</span><div><strong>{gate.label}</strong><p>{gate.message}</p></div></article>)}</div></section> : null}
    </main><aside className="pgx-claim-column"><section className="pgx-summary-panel pgx-claim-preview-panel tool-panel">{busy === "build" ? <div className="pgx-claim-empty"><Loader2 size={24} className="animate-spin" /><strong>Building billing logic</strong><span>Determining performed service lines, supported diagnoses, and separate gene-drug evidence.</span></div> : claim ? <BillingWorksheet claim={claim.claimJson} /> : <div className="pgx-claim-empty"><FileSearch size={28} /><strong>Billing worksheet</strong><span>Billable laboratory services and separate gene-medication evidence will appear here.</span></div>}<button type="button" className="tool-primary-button pgx-download-button" onClick={() => claim?.pdfBase64 ? downloadPdf(claim.pdfBase64, claim.filename) : claim?.downloadUrl && window.open(claim.downloadUrl, "_blank", "noopener,noreferrer")} disabled={!claim?.pdfBase64 && !claim?.downloadUrl}><Download size={16} /> Download billing worksheet</button></section><div className="pgx-safety-note"><AlertTriangle size={16} /><p><strong>Coder decision support.</strong> The engine does not invent diagnoses, medications, CPT relationships, charges, or claim facts.</p></div></aside></div>
  </div>;
}

export default PgxWorkspace;
