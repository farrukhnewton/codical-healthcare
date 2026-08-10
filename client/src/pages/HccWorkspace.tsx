import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArchiveRestore, BadgeCheck, BarChart3, CheckCircle2, ChevronRight,
  CircleDollarSign, Database, FileCheck2, FileSearch, FileUp, Fingerprint, GitBranch,
  History, Info, Layers3, Loader2, LockKeyhole, Scale, ShieldCheck, Sparkles,
  Stethoscope, Trash2, UserRoundCheck,
} from "lucide-react";
import {
  HCC_ENGINE_VERSION,
  type HccCaseInput,
  type HccDiagnosisEvidence,
  type HccEvaluation,
} from "../../../shared/hcc-coding";

const blankDiagnosis = (): HccDiagnosisEvidence => ({
  code: "",
  serviceDate: "2025-12-31",
  encounterId: "",
  dataSource: "physician",
  documentationStatus: "review",
  signatureStatus: "missing",
  acceptableProviderType: null,
  eligibleService: null,
  patientMatched: null,
  clinicallyAddressed: null,
});

const initialCase: HccCaseInput = {
  paymentYear: 2026,
  programType: "ma",
  enrollmentType: "continuing",
  snp: false,
  esrdStatus: "none",
  dateOfBirth: "",
  sex: "female",
  originalReasonForEntitlement: 0,
  medicaidStatus: "none",
  institutional: false,
  longTermInstitutionalMedicaid: false,
  diagnoses: [blankDiagnosis()],
  priorYearDiagnoses: [],
};

type UploadedDocument = {
  fileName: string;
  extractionMethod: string;
  candidateCodes: string[];
  candidateFlags: Record<string, boolean>;
  warnings: string[];
};

async function authenticatedFetch(path: string, init: RequestInit) {
  const { supabase } = await import("@/lib/supabase");
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error("Your session expired. Sign in again and retry.");
  const response = await fetch(path, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${data.session.access_token}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `Request failed (${response.status})`);
  return payload;
}
const normalizeCodes = (value: string) => [...new Set(value.split(/[,;\n\s]+/).map((code) => code.toUpperCase().replace(/[^A-Z0-9]/g, "")).filter(Boolean))];
const pretty = (value: string) => value.replace(/_/g, " · ").replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="hcc-field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}

function TriState({ value, onChange, label, detail }: { value: boolean | null; onChange: (value: boolean | null) => void; label: string; detail?: string }) {
  return <div className={`hcc-tristate ${value === true ? "yes" : value === false ? "no" : "unknown"}`}>
    <div><strong>{label}</strong>{detail ? <small>{detail}</small> : null}</div>
    <div className="hcc-tristate-actions">
      <button type="button" className={value === true ? "active" : ""} onClick={() => onChange(true)}>Yes</button>
      <button type="button" className={value === false ? "active" : ""} onClick={() => onChange(false)}>No</button>
      <button type="button" className={value === null ? "active" : ""} onClick={() => onChange(null)}>Review</button>
    </div>
  </div>;
}

function Score({ label, value, tone }: { label: string; value: number | null; tone: string }) {
  return <article className={`hcc-score ${tone}`}><span>{label}</span><strong>{value === null ? "—" : value.toFixed(3)}</strong></article>;
}

export function HccWorkspace() {
  const [caseInput, setCaseInput] = useState<HccCaseInput>(initialCase);
  const [priorText, setPriorText] = useState("");
  const [result, setResult] = useState<HccEvaluation | null>(null);
  const [busy, setBusy] = useState(false);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof HccCaseInput>(key: K, value: HccCaseInput[K]) => setCaseInput((current) => ({ ...current, [key]: value }));
  const updateDiagnosis = <K extends keyof HccDiagnosisEvidence>(index: number, key: K, value: HccDiagnosisEvidence[K]) => setCaseInput((current) => ({ ...current, diagnoses: current.diagnoses.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }));
  const removeDiagnosis = (index: number) => setCaseInput((current) => ({ ...current, diagnoses: current.diagnoses.filter((_, itemIndex) => itemIndex !== index) }));
  const activeRows = useMemo(() => caseInput.diagnoses.filter((item) => item.code.trim()).length, [caseInput.diagnoses]);
  const verifiedRows = useMemo(() => caseInput.diagnoses.filter((item) => item.documentationStatus === "confirmed" && item.signatureStatus !== "missing" && item.acceptableProviderType === true && item.eligibleService === true && item.patientMatched === true).length, [caseInput.diagnoses]);

  async function uploadDocuments(fileList: FileList | null) {
    if (!fileList?.length) return;
    setDocumentBusy(true); setError(null); setNotice(null);
    const body = new FormData();
    Array.from(fileList).forEach((file) => body.append("documents", file));
    try {
      const payload = await authenticatedFetch("/api/hcc/documents/extract", { method: "POST", body });
      const received: UploadedDocument[] = payload.documents || [];
      setDocuments(received);
      const candidates = [...new Set(received.flatMap((document) => document.candidateCodes || []))];
      if (candidates.length) {
        setCaseInput((current) => ({ ...current, diagnoses: [...current.diagnoses.filter((row) => row.code.trim()), ...candidates.map((code, index) => ({ ...blankDiagnosis(), code, serviceDate: "2025-12-31", encounterId: `extracted-review-${index + 1}`, sourceDocumentId: received.find((document) => document.candidateCodes?.includes(code))?.fileName }))] }));
      }
      setNotice(`${received.length} document${received.length === 1 ? "" : "s"} processed. ${candidates.length} model-mapped code candidate${candidates.length === 1 ? "" : "s"} require source verification.`);
    } catch (uploadError: any) {
      setError(uploadError?.message || "Document processing failed.");
    } finally {
      setDocumentBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function buildWorksheet() {
    setBusy(true); setError(null); setNotice(null); setResult(null);
    const reviewed = { ...caseInput, diagnoses: caseInput.diagnoses.filter((row) => row.code.trim()), priorYearDiagnoses: normalizeCodes(priorText) };
    setCaseInput(reviewed);
    try {
      const payload = await authenticatedFetch("/api/hcc/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseInput: reviewed }) });
      setResult(payload.evaluation);
      setNotice("Calculated with the official CMS PY 2026 final V28 mapping and coefficient package. Human validation remains required.");
    } catch (buildError: any) {
      setError(buildError?.message || "The HCC worksheet could not be built.");
    } finally { setBusy(false); }
  }

  return <div className="hcc-page">
    <section className="hcc-hero">
      <img src="/assets/specialty/hcc-risk-adjustment-hero-v1.png" alt="Clinical documentation and risk-adjustment professionals reviewing a condition hierarchy" />
      <div className="hcc-hero-shade" />
      <div className="hcc-hero-copy">
        <span className="specialty-eyebrow"><GitBranch size={15} /> CMS-HCC model intelligence</span>
        <h1>Map the evidence.<br /><em>Respect the hierarchy.</em></h1>
        <p>A compliance-first V28 workspace for encounter eligibility, current-record support, demographic segments, HCC hierarchy, disease interactions, normalization, and RADV-ready review.</p>
        <div className="hcc-hero-meta"><span><BadgeCheck size={15} /> PY 2026 final</span><span><Database size={15} /> 8,019 mappings</span><span><ShieldCheck size={15} /> No diagnosis suggestions</span></div>
      </div>
      <span className="hcc-version">Engine {HCC_ENGINE_VERSION}</span>
    </section>

    <div className="hcc-model-banner">
      <div><Sparkles size={18} /><span><strong>2026 model context</strong>Non-PACE MA uses 100% of the 2024 CMS-HCC V28 model.</span></div>
      <div><Scale size={18} /><span><strong>Score layers stay separate</strong>Raw model → ÷ 1.067 normalization → 5.90% statutory coding adjustment view.</span></div>
      <div><CircleDollarSign size={18} /><span><strong>No generic revenue multiplier</strong>RAF alone is not a member payment amount.</span></div>
    </div>

    <div className="hcc-workspace-grid">
      <main className="hcc-input-column">
        <section className="hcc-panel">
          <header className="hcc-panel-heading"><div><span>01</span><h2>Model and beneficiary context</h2></div><UserRoundCheck size={20} /></header>
          <p className="hcc-section-copy">CMS calculates age as of February 1 of the payment year. Program and ESRD pathways are hard gates, not cosmetic labels.</p>
          <div className="hcc-form-grid four">
            <Field label="Payment year"><input value="2026" disabled /></Field>
            <Field label="Program"><select value={caseInput.programType} onChange={(event) => update("programType", event.target.value as HccCaseInput["programType"])}><option value="ma">Medicare Advantage</option><option value="pace">PACE</option></select></Field>
            <Field label="Enrollment"><select value={caseInput.enrollmentType} onChange={(event) => update("enrollmentType", event.target.value as HccCaseInput["enrollmentType"])}><option value="continuing">Continuing enrollee</option><option value="new">New enrollee</option></select></Field>
            <Field label="ESRD status"><select value={caseInput.esrdStatus} onChange={(event) => update("esrdStatus", event.target.value as HccCaseInput["esrdStatus"])}><option value="none">No ESRD pathway</option><option value="dialysis">Dialysis</option><option value="transplant">Transplant</option><option value="functioning-graft">Functioning graft</option></select></Field>
          </div>
          <div className="hcc-form-grid four hcc-spaced">
            <Field label="Date of birth"><input type="date" value={caseInput.dateOfBirth} onChange={(event) => update("dateOfBirth", event.target.value)} /></Field>
            <Field label="Sex for CMS model"><select value={caseInput.sex} onChange={(event) => update("sex", event.target.value as HccCaseInput["sex"])}><option value="female">Female</option><option value="male">Male</option></select></Field>
            <Field label="Original entitlement"><select value={caseInput.originalReasonForEntitlement} onChange={(event) => update("originalReasonForEntitlement", Number(event.target.value) as 0 | 1 | 2 | 3)}><option value={0}>Age</option><option value={1}>Disability</option><option value={2}>ESRD</option><option value={3}>Both disability and ESRD</option></select></Field>
            <Field label="Medicaid status"><select value={caseInput.medicaidStatus} onChange={(event) => update("medicaidStatus", event.target.value as HccCaseInput["medicaidStatus"])}><option value="none">Non-dual</option><option value="partial">Partial benefit dual</option><option value="full">Full benefit dual</option></select></Field>
          </div>
          <div className="hcc-check-row">
            <label><input type="checkbox" checked={caseInput.institutional} onChange={(event) => update("institutional", event.target.checked)} /><span>Institutional segment</span></label>
            <label><input type="checkbox" checked={caseInput.longTermInstitutionalMedicaid} onChange={(event) => update("longTermInstitutionalMedicaid", event.target.checked)} /><span>LTI Medicaid indicator</span></label>
            <label><input type="checkbox" checked={caseInput.snp} onChange={(event) => update("snp", event.target.checked)} /><span>New-enrollee SNP coefficient</span></label>
          </div>
        </section>

        <section className="hcc-panel">
          <header className="hcc-panel-heading"><div><span>02</span><h2>Source records</h2></div><FileSearch size={20} /></header>
          <p className="hcc-section-copy">Upload encounter notes or audit records. OCR candidates stay in review status until a human confirms the exact code, patient, encounter, provider, signature, and service eligibility.</p>
          <input ref={fileRef} hidden type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.txt" onChange={(event) => uploadDocuments(event.target.files)} />
          <button className="hcc-upload" type="button" disabled={documentBusy} onClick={() => fileRef.current?.click()}>{documentBusy ? <Loader2 className="spin" /> : <FileUp />}<span><strong>{documentBusy ? "Processing records…" : "Upload clinical records"}</strong><small>Native text + approved OCR handoff · encrypted object storage when configured</small></span><ChevronRight size={18} /></button>
          {documents.length ? <div className="hcc-documents">{documents.map((document) => <article key={document.fileName}><FileCheck2 size={17} /><div><strong>{document.fileName}</strong><span>{pretty(document.extractionMethod)} · {document.candidateCodes.length} mapped candidates</span><small>{document.warnings?.[0] || "Human verification required"}</small></div></article>)}</div> : null}
        </section>

        <section className="hcc-panel">
          <header className="hcc-panel-heading"><div><span>03</span><h2>Current-year diagnosis evidence</h2></div><Stethoscope size={20} /></header>
          <p className="hcc-section-copy">Every diagnosis is evaluated independently. A code mapping to an HCC does not make it reportable or RADV-supported.</p>
          <div className="hcc-diagnosis-list">
            {caseInput.diagnoses.map((diagnosis, index) => <article className="hcc-diagnosis-card" key={`${index}-${diagnosis.sourceDocumentId || "manual"}`}>
              <div className="hcc-diagnosis-top">
                <span className="hcc-row-number">{String(index + 1).padStart(2, "0")}</span>
                <Field label="ICD-10-CM"><input value={diagnosis.code} onChange={(event) => updateDiagnosis(index, "code", event.target.value.toUpperCase())} placeholder="E11.42" /></Field>
                <Field label="Date of service"><input type="date" value={diagnosis.serviceDate} onChange={(event) => updateDiagnosis(index, "serviceDate", event.target.value)} /></Field>
                <Field label="Encounter ID"><input value={diagnosis.encounterId} onChange={(event) => updateDiagnosis(index, "encounterId", event.target.value)} placeholder="ENC-2025-001" /></Field>
                <button type="button" className="hcc-remove" aria-label={`Remove diagnosis ${index + 1}`} onClick={() => removeDiagnosis(index)}><Trash2 size={16} /></button>
              </div>
              <div className="hcc-form-grid three">
                <Field label="Data source"><select value={diagnosis.dataSource} onChange={(event) => updateDiagnosis(index, "dataSource", event.target.value as HccDiagnosisEvidence["dataSource"])}><option value="physician">Physician</option><option value="hospital-outpatient">Hospital outpatient</option><option value="hospital-inpatient">Hospital inpatient</option><option value="other">Other / unsupported</option></select></Field>
                <Field label="Record support"><select value={diagnosis.documentationStatus} onChange={(event) => updateDiagnosis(index, "documentationStatus", event.target.value as HccDiagnosisEvidence["documentationStatus"])}><option value="review">Needs review</option><option value="confirmed">Confirmed in current record</option><option value="unsubstantiated">Unsubstantiated</option><option value="deleted">Delete / correction</option></select></Field>
                <Field label="Signature"><select value={diagnosis.signatureStatus} onChange={(event) => updateDiagnosis(index, "signatureStatus", event.target.value as HccDiagnosisEvidence["signatureStatus"])}><option value="missing">Missing / unknown</option><option value="signed">Signed</option><option value="attested">Permitted attestation</option></select></Field>
              </div>
              <div className="hcc-evidence-grid">
                <TriState label="Patient matched" value={diagnosis.patientMatched} onChange={(value) => updateDiagnosis(index, "patientMatched", value)} />
                <TriState label="Provider type accepted" value={diagnosis.acceptableProviderType} onChange={(value) => updateDiagnosis(index, "acceptableProviderType", value)} />
                <TriState label="Eligible service verified" value={diagnosis.eligibleService} onChange={(value) => updateDiagnosis(index, "eligibleService", value)} />
                <TriState label="Condition addressed" detail="Review cue, not a standalone CMS exclusion" value={diagnosis.clinicallyAddressed} onChange={(value) => updateDiagnosis(index, "clinicallyAddressed", value)} />
              </div>
            </article>)}
          </div>
          <button className="hcc-add-row" type="button" onClick={() => update("diagnoses", [...caseInput.diagnoses, blankDiagnosis()])}>+ Add diagnosis evidence row</button>
        </section>

        <section className="hcc-panel">
          <header className="hcc-panel-heading"><div><span>04</span><h2>Historical review queue</h2></div><History size={20} /></header>
          <p className="hcc-section-copy">Prior-year codes can prompt record review only. They are never copied into the current year, converted into diagnoses, or added to RAF.</p>
          <Field label="Prior-year ICD-10-CM codes" hint="Separate with commas, spaces, or new lines."><textarea rows={3} value={priorText} onChange={(event) => setPriorText(event.target.value)} placeholder="E11.42, I50.32, N18.4" /></Field>
        </section>
      </main>

      <aside className="hcc-results-column">
        <section className="hcc-panel hcc-live-card">
          <header className="hcc-panel-heading compact"><div><span><BarChart3 size={14} /></span><h2>Live readiness</h2></div><Fingerprint size={19} /></header>
          <div className="hcc-readiness"><article><strong>{activeRows}</strong><span>entered</span></article><article><strong>{verifiedRows}</strong><span>verified</span></article><article><strong>{normalizeCodes(priorText).length}</strong><span>historical cues</span></article></div>
          <div className="hcc-rule"><GitBranch size={16} /><span><strong>Hierarchy first</strong>Lower related HCCs are suppressed only after eligible diagnoses map through CMS age and sex edits.</span></div>
          <div className="hcc-rule"><LockKeyhole size={16} /><span><strong>Evidence before coefficient</strong>Held and historical diagnoses contribute zero.</span></div>
        </section>

        <section className="hcc-panel hcc-build-card">
          <span className="specialty-eyebrow"><ShieldCheck size={14} /> Human-controlled model run</span>
          <h2>Build V28 worksheet</h2>
          <p>Run official mapping, hierarchy, condition-count, interaction, and coefficient logic. No encounter data is submitted.</p>
          <button type="button" className="hcc-build-button" disabled={busy} onClick={buildWorksheet}>{busy ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />}{busy ? "Calculating…" : "Build risk-adjustment worksheet"}</button>
          {notice ? <div className="hcc-alert"><Info size={15} />{notice}</div> : null}
          {error ? <div className="hcc-alert danger"><AlertTriangle size={15} />{error}</div> : null}
        </section>

        {result ? <>
          <section className="hcc-panel hcc-score-card">
            <header className="hcc-panel-heading compact"><div><span><Scale size={14} /></span><h2>Risk-score layers</h2></div><span className={`hcc-status ${result.status === "hold" ? "hold" : "ready"}`}>{pretty(result.status)}</span></header>
            <div className="hcc-score-grid"><Score label="Raw CMS model" value={result.rawRiskScore} tone="raw" /><Score label="Normalized" value={result.normalizedRiskScore} tone="normalized" /><Score label="5.90% adjusted view" value={result.codingPatternAdjustedScore} tone="adjusted" /></div>
            <div className="hcc-segment"><span>Coefficient segment</span><strong>{result.segment ? pretty(result.segment) : "Unresolved"}</strong></div>
            <p className="hcc-payment-note"><CircleDollarSign size={15} />{result.paymentEstimateReason}</p>
          </section>

          <section className="hcc-panel">
            <header className="hcc-panel-heading compact"><div><span><Layers3 size={14} /></span><h2>Payment HCCs</h2></div><strong className="hcc-count">{result.activeHccs.length}</strong></header>
            <div className="hcc-hcc-list">{result.activeHccs.length ? result.activeHccs.map((item) => <article key={item.hcc}><span>HCC {item.hcc}</span><strong>{item.label}</strong><small>{item.sourceCodes.join(" · ")}</small></article>) : <p>No eligible payment HCCs.</p>}</div>
            {result.suppressedHccs.length ? <div className="hcc-suppressed"><strong>Hierarchy suppression</strong>{result.suppressedHccs.map((item) => <span key={item.hcc}>HCC {item.hcc} suppressed by HCC {item.suppressedBy}</span>)}</div> : null}
          </section>

          <section className="hcc-panel">
            <header className="hcc-panel-heading compact"><div><span><FileCheck2 size={14} /></span><h2>Evidence disposition</h2></div></header>
            <div className="hcc-disposition">{result.diagnoses.map((item) => <article key={item.code} className={item.status}><div><strong>{item.code}</strong><span>{item.mappedCcs.length ? `CC ${item.mappedCcs.join(", ")}` : "No V28 mapping"}</span></div><span>{pretty(item.status)}</span>{item.issues.slice(0, 2).map((issue) => <small key={issue}>{issue}</small>)}</article>)}</div>
          </section>

          {result.reviewCues.length ? <section className="hcc-panel"><header className="hcc-panel-heading compact"><div><span><ArchiveRestore size={14} /></span><h2>Historical review cues</h2></div></header><div className="hcc-cues">{result.reviewCues.map((cue) => <article key={cue.code}><strong>{cue.code}</strong><span>{cue.mappedHccs.length ? `Model HCCs ${cue.mappedHccs.join(", ")}` : "No V28 mapping"}</span><p>{cue.message}</p></article>)}</div></section> : null}

          {(result.blockers.length || result.warnings.length) ? <section className="hcc-panel"><header className="hcc-panel-heading compact"><div><span><AlertTriangle size={14} /></span><h2>Release checks</h2></div></header><div className="hcc-release-list">{result.blockers.map((item) => <p className="blocker" key={item}><AlertTriangle size={14} />{item}</p>)}{result.warnings.map((item) => <p key={item}><Info size={14} />{item}</p>)}</div></section> : null}
        </> : <section className="hcc-empty"><GitBranch size={28} /><h3>Worksheet waiting</h3><p>Complete beneficiary context and current-year evidence, then run the official V28 model.</p></section>}
      </aside>
    </div>
  </div>;
}
