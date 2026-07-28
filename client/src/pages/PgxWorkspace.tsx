import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Dna,
  Download,
  FileSearch,
  FileText,
  Loader2,
  RotateCcw,
  Save,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

type PgxExtractedData = {
  patient: { name?: string; dob?: string; mrn?: string };
  lab: { name?: string; accession?: string; collectionDate?: string; reportDate?: string };
  orderingProvider?: { name?: string; npi?: string };
  diagnosisCodes: string[];
  genes: Array<{ gene: string; genotype?: string; phenotype?: string; cpt?: string; confidence: number }>;
  medications: Array<{ name: string; drugClass?: string; source: "detected" | "manual" }>;
  panel: { geneCount: number; hasDupDel: boolean; detectedPanelName?: string };
  warnings: string[];
};

type PgxAnalysis = {
  extracted: PgxExtractedData;
  cptSelection: {
    type: "panel" | "stacked" | "unlisted";
    codes: Array<{ code: string; description: string; units: number; gene?: string }>;
    notes: string[];
  };
  icd10: Array<{ code: string; status: "covered" | "review"; groupNumber?: number; rationale: string }>;
  medicalNecessity: {
    isMet: boolean;
    reason: string;
    actionablePairs: Array<{ gene: string; drug: string; cpicLevel: string; tableSource: string; recommendation: string }>;
  };
  auditChecklist: {
    gates: Array<{ id: string; label: string; passed: boolean; message: string }>;
    allPassed: boolean;
  };
  narrative: string;
  disclaimer: string;
};

type GeneratedClaim = {
  claimJson: Record<string, unknown>;
  narrative: string;
  filename: string;
  pdfBase64?: string;
  downloadUrl?: string | null;
};

const STEPS = ["Upload documents", "Extract data", "Match & calculate", "Generate claim"] as const;

async function pgxFetch(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(path, { ...init, headers, credentials: "include" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || "The PGx request could not be completed.");
  return payload;
}

function downloadBase64Pdf(base64: string, filename: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function PgxWorkspace() {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [furthestStep, setFurthestStep] = useState(1);
  const [labReport, setLabReport] = useState<File | null>(null);
  const [requisition, setRequisition] = useState<File | null>(null);
  const [labText, setLabText] = useState("");
  const [requisitionText, setRequisitionText] = useState("");
  const [primaryIcd10, setPrimaryIcd10] = useState("");
  const [drugNames, setDrugNames] = useState("");
  const [extracted, setExtracted] = useState<PgxExtractedData | null>(null);
  const [analysis, setAnalysis] = useState<PgxAnalysis | null>(null);
  const [claim, setClaim] = useState<GeneratedClaim | null>(null);
  const [busy, setBusy] = useState<"extract" | "analyze" | "claim" | "save" | null>(null);
  const [error, setError] = useState("");

  const cptCodes = useMemo(() => analysis?.cptSelection.codes.map((item) => item.code) || [], [analysis]);
  const diagnosisCodes = useMemo(() => analysis?.icd10.map((item) => item.code) || extracted?.diagnosisCodes || [], [analysis, extracted]);

  const moveTo = (next: number) => {
    if (next <= furthestStep) setStep(next);
  };

  const reset = () => {
    setStep(1);
    setFurthestStep(1);
    setLabReport(null);
    setRequisition(null);
    setLabText("");
    setRequisitionText("");
    setPrimaryIcd10("");
    setDrugNames("");
    setExtracted(null);
    setAnalysis(null);
    setClaim(null);
    setError("");
  };

  const extractDocuments = async () => {
    if (!labReport && !requisition && labText.trim().length < 20 && requisitionText.trim().length < 20) {
      setError("Upload a PDF/TXT document or paste enough report text to begin extraction.");
      return;
    }

    setBusy("extract");
    setError("");
    try {
      const form = new FormData();
      if (labReport) form.append("labReport", labReport);
      if (requisition) form.append("requisition", requisition);
      form.append("labText", labText);
      form.append("requisitionText", requisitionText);
      const payload = await pgxFetch("/api/pgx/extract", { method: "POST", body: form });
      const result = payload.extracted as PgxExtractedData;
      setExtracted(result);
      setPrimaryIcd10(result.diagnosisCodes[0] || "");
      setDrugNames(result.medications.map((medication) => medication.name).join(", "));
      setStep(2);
      setFurthestStep((current) => Math.max(current, 2));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Extraction failed.");
    } finally {
      setBusy(null);
    }
  };

  const analyzeResults = async () => {
    if (!extracted) return;
    setBusy("analyze");
    setError("");
    try {
      const payload = await pgxFetch("/api/pgx/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extracted, primaryIcd10, drugNames, payerAcceptsPanel: true }),
      });
      setAnalysis(payload.analysis as PgxAnalysis);
      setStep(3);
      setFurthestStep((current) => Math.max(current, 3));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed.");
    } finally {
      setBusy(null);
    }
  };

  const generateClaim = async () => {
    if (!analysis) return;
    setBusy("claim");
    setError("");
    try {
      const payload = await pgxFetch("/api/pgx/generate-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis }),
      });
      setClaim(payload as GeneratedClaim);
      setStep(4);
      setFurthestStep(4);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Claim generation failed.");
    } finally {
      setBusy(null);
    }
  };

  const saveAnalysis = async () => {
    if (!analysis) return;
    setBusy("save");
    try {
      await pgxFetch("/api/pgx/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis, claimJson: claim?.claimJson }),
      });
      toast({ title: "PGx review saved", description: "The analysis is available in PGx history." });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setBusy(null);
    }
  };

  const copyNarrative = async () => {
    if (!analysis?.narrative) return;
    await navigator.clipboard.writeText(analysis.narrative);
    toast({ title: "Narrative copied", description: "The coder review narrative is on your clipboard." });
  };

  const downloadClaim = () => {
    if (claim?.pdfBase64) downloadBase64Pdf(claim.pdfBase64, claim.filename || "PGx_Coding_Review.pdf");
    else if (claim?.downloadUrl?.startsWith("http")) window.open(claim.downloadUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="specialty-page pgx-workspace-page">
      <header className="pgx-workspace-header tool-panel">
        <div className="pgx-title-block">
          <Link href="/specialty" className="pgx-back-link"><ChevronLeft size={15} /> Specialty Coding</Link>
          <div><span className="pgx-title-icon"><Dna size={23} /></span><div><h1>PGx Coding Engine</h1><p>Pharmacogenomic coding decision support</p></div></div>
        </div>
        <div className="pgx-header-actions">
          <button type="button" className="tool-secondary-button" onClick={reset}><RotateCcw size={15} /> Reset</button>
          <button type="button" className="tool-secondary-button" onClick={saveAnalysis} disabled={!analysis || busy !== null}>
            {busy === "save" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save
          </button>
          <button type="button" className="tool-primary-button" onClick={downloadClaim} disabled={!claim || (!claim.pdfBase64 && !claim.downloadUrl)}><Download size={15} /> Export</button>
        </div>
      </header>

      <nav className="pgx-stepper tool-panel" aria-label="PGx workflow progress">
        {STEPS.map((label, index) => {
          const number = index + 1;
          const completed = number < step;
          const available = number <= furthestStep;
          return (
            <button key={label} type="button" onClick={() => moveTo(number)} disabled={!available} className={`${number === step ? "is-current" : ""}${completed ? " is-complete" : ""}`}>
              <span>{completed ? <Check size={14} /> : number}</span>
              <strong>{label}</strong>
            </button>
          );
        })}
      </nav>

      {error ? <div className="pgx-error" role="alert"><AlertTriangle size={17} /><span>{error}</span><button type="button" onClick={() => setError("")}>Dismiss</button></div> : null}

      <div className="pgx-workspace-grid">
        <section className="pgx-main-panel tool-panel">
          {step === 1 ? (
            <div className="pgx-step-content">
              <div className="pgx-section-head"><span><UploadCloud size={18} /></span><div><h2>Upload lab report and requisition</h2><p>Use text-based PDF/TXT files, or paste report text below.</p></div></div>
              <div className="pgx-upload-grid">
                <label className={`pgx-upload-zone${labReport ? " has-file" : ""}`}>
                  <FileText size={24} /><strong>{labReport?.name || "PGx lab report"}</strong><span>{labReport ? `${Math.ceil(labReport.size / 1024)} KB selected` : "Select PDF or TXT, up to 20 MB"}</span>
                  <input type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={(event) => setLabReport(event.target.files?.[0] || null)} />
                </label>
                <label className={`pgx-upload-zone${requisition ? " has-file" : ""}`}>
                  <FileSearch size={24} /><strong>{requisition?.name || "Requisition form"}</strong><span>{requisition ? `${Math.ceil(requisition.size / 1024)} KB selected` : "Optional PDF or TXT"}</span>
                  <input type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={(event) => setRequisition(event.target.files?.[0] || null)} />
                </label>
              </div>
              <div className="pgx-text-grid">
                <label><span>Lab report text</span><textarea value={labText} onChange={(event) => setLabText(event.target.value)} placeholder="Paste de-identified PGx result text for testing..." /></label>
                <label><span>Requisition text</span><textarea value={requisitionText} onChange={(event) => setRequisitionText(event.target.value)} placeholder="Paste diagnosis, medication, and ordering-provider context..." /></label>
              </div>
              <div className="pgx-action-row"><span>PDF text extraction is available. Image OCR is planned for a later phase.</span><button type="button" className="tool-primary-button" onClick={extractDocuments} disabled={busy !== null}>{busy === "extract" ? <Loader2 size={16} className="animate-spin" /> : <FileSearch size={16} />} Analyze &amp; extract</button></div>
            </div>
          ) : null}

          {step === 2 && extracted ? (
            <div className="pgx-step-content">
              <div className="pgx-section-head is-success"><span><CheckCircle2 size={18} /></span><div><h2>Extraction complete</h2><p>{extracted.genes.length} supported genes and {extracted.medications.length} medications detected.</p></div></div>
              <div className="pgx-fact-grid">
                <article><span>Patient</span><strong>{extracted.patient.name || "Not detected"}</strong><small>{extracted.patient.dob || "DOB not detected"}</small></article>
                <article><span>Laboratory</span><strong>{extracted.lab.name || "Not detected"}</strong><small>{extracted.lab.accession || "Accession not detected"}</small></article>
                <article><span>Panel</span><strong>{extracted.panel.detectedPanelName || "General PGx panel"}</strong><small>{extracted.panel.hasDupDel ? "Copy-number evidence detected" : "Copy-number evidence not detected"}</small></article>
              </div>
              <div className="pgx-table-wrap"><div className="pgx-table-head"><h3>Genes detected</h3><span>{extracted.genes.length} results</span></div><table><thead><tr><th>Gene</th><th>Genotype</th><th>Phenotype</th><th>Confidence</th></tr></thead><tbody>{extracted.genes.map((gene) => <tr key={gene.gene}><td><strong>{gene.gene}</strong></td><td>{gene.genotype || "Review"}</td><td>{gene.phenotype || "Review"}</td><td>{Math.round(gene.confidence * 100)}%</td></tr>)}</tbody></table></div>
              <div className="pgx-review-fields">
                <label><span>Primary ICD-10</span><input className="tool-input" value={primaryIcd10} onChange={(event) => setPrimaryIcd10(event.target.value.toUpperCase())} placeholder="e.g. F33.2" /></label>
                <label><span>Active medications</span><input className="tool-input" value={drugNames} onChange={(event) => setDrugNames(event.target.value)} placeholder="Comma-separated drug names" /></label>
              </div>
              {extracted.warnings.length ? <div className="pgx-warning-list">{extracted.warnings.map((warning) => <p key={warning}><AlertTriangle size={14} /> {warning}</p>)}</div> : null}
              <div className="pgx-action-row"><button type="button" className="tool-secondary-button" onClick={() => setStep(1)}><ChevronLeft size={15} /> Back</button><button type="button" className="tool-primary-button" onClick={analyzeResults} disabled={busy !== null}>{busy === "analyze" ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} Match &amp; calculate</button></div>
            </div>
          ) : null}

          {step === 3 && analysis ? (
            <div className="pgx-step-content">
              <div className="pgx-section-head"><span><ShieldCheck size={18} /></span><div><h2>Coder review</h2><p>Starter knowledge matches require validation against current source policies.</p></div></div>
              <div className="pgx-code-grid"><article><span>CPT strategy</span><strong>{analysis.cptSelection.type}</strong><p>{cptCodes.join(", ") || "No suggestion"}</p></article><article><span>Diagnosis review</span><strong>{diagnosisCodes.length} codes</strong><p>{diagnosisCodes.join(", ") || "No diagnosis"}</p></article><article className={analysis.medicalNecessity.isMet ? "is-success" : "is-warning"}><span>Evidence context</span><strong>{analysis.medicalNecessity.isMet ? "Found" : "Needs review"}</strong><p>{analysis.medicalNecessity.actionablePairs.length} actionable pairs</p></article></div>
              <div className="pgx-audit-list"><h3>Six-gate audit checklist</h3>{analysis.auditChecklist.gates.map((gate) => <article key={gate.id} className={gate.passed ? "is-passed" : ""}><span>{gate.passed ? <Check size={14} /> : <AlertTriangle size={14} />}</span><div><strong>{gate.label}</strong><p>{gate.message}</p></div></article>)}</div>
              <div className="pgx-narrative"><div><h3>Required claim narrative</h3><button type="button" onClick={copyNarrative}><Clipboard size={14} /> Copy</button></div><p>{analysis.narrative}</p></div>
              <div className="pgx-action-row"><button type="button" className="tool-secondary-button" onClick={() => setStep(2)}><ChevronLeft size={15} /> Back</button><button type="button" className="tool-primary-button" onClick={generateClaim} disabled={busy !== null}>{busy === "claim" ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} Generate claim preview</button></div>
            </div>
          ) : null}

          {step === 4 && analysis && claim ? (
            <div className="pgx-step-content">
              <div className="pgx-section-head is-success"><span><CheckCircle2 size={18} /></span><div><h2>Claim preview generated</h2><p>Review every field before exporting or transferring to a billing system.</p></div></div>
              <div className="pgx-claim-summary"><div><span>Suggested CPT</span><strong>{cptCodes.join(", ") || "Review required"}</strong></div><div><span>Suggested ICD-10</span><strong>{diagnosisCodes.join(", ") || "Review required"}</strong></div><div><span>Audit status</span><strong>{analysis.auditChecklist.allPassed ? "All starter gates passed" : "Coder review required"}</strong></div></div>
              <pre className="pgx-json-preview">{JSON.stringify(claim.claimJson, null, 2)}</pre>
              <div className="pgx-action-row"><button type="button" className="tool-secondary-button" onClick={copyNarrative}><Clipboard size={15} /> Copy narrative</button><button type="button" className="tool-primary-button" onClick={downloadClaim} disabled={!claim.pdfBase64 && !claim.downloadUrl}><Download size={15} /> Download PDF</button></div>
            </div>
          ) : null}
        </section>

        <aside className="pgx-summary-panel tool-panel">
          <div className="pgx-summary-title"><span><Dna size={17} /></span><div><h2>Live coding preview</h2><p>Phase 1 starter knowledge</p></div></div>
          <dl><div><dt>Genes</dt><dd>{extracted?.genes.length ?? "—"}</dd></div><div><dt>CPT</dt><dd>{cptCodes.join(", ") || "Pending"}</dd></div><div><dt>ICD-10</dt><dd>{diagnosisCodes.join(", ") || "Pending"}</dd></div><div><dt>Actionable pairs</dt><dd>{analysis?.medicalNecessity.actionablePairs.length ?? "—"}</dd></div></dl>
          <div className="pgx-guide"><h3>{step === 1 ? "Quick start" : "Current review"}</h3>{step === 1 ? <ol><li>Upload a text-based PGx report.</li><li>Add requisition or medication context.</li><li>Review every extracted gene and phenotype.</li><li>Validate suggestions against current payer policy.</li></ol> : <p>{analysis?.medicalNecessity.reason || "Confirm the extracted fields, then continue to gene-drug matching."}</p>}</div>
          <div className="pgx-safety-note"><AlertTriangle size={16} /><p><strong>Decision support only.</strong> This workspace does not replace current CMS/payer policy, laboratory interpretation, clinical judgment, or certified coder review.</p></div>
          {step < furthestStep ? <button type="button" className="pgx-resume-button" onClick={() => setStep(furthestStep)}>Resume latest step <ChevronRight size={15} /></button> : null}
        </aside>
      </div>
    </div>
  );
}

export default PgxWorkspace;
