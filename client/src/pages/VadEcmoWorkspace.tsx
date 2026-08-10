import { useRef, useState, type ReactNode } from "react";
import {
  Activity, AlertTriangle, BadgeCheck, CheckCircle2, CircleGauge, Database, FileSearch,
  FileUp, HeartPulse, Info, Layers3, Loader2, Plus, ShieldCheck, Sparkles, Stethoscope, Trash2,
} from "lucide-react";
import {
  VAD_ECMO_ENGINE_VERSION,
  type VadEcmoCaseInput,
  type VadEcmoDiagnosisEvidence,
  type VadEcmoEvaluation,
  type VadEcmoReviewState,
  type VadEcmoServiceInput,
} from "../../../shared/vad-ecmo-coding";

type ExtractedDocument = {
  fileName: string; extractionMethod: string; patientName?: string | null; dateOfBirth?: string | null;
  services: Array<Record<string, any>>; diagnoses: Array<Record<string, any>>; coverageFacts: string[]; warnings: string[];
};
type WorksheetPayload = { evaluation: VadEcmoEvaluation; ncci?: any };
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const blankService = (): VadEcmoServiceInput => ({
  id: id("service"), serviceDate: "2026-08-10", supportKind: "ecmo", phase: "initiation", ecmoMode: "unknown",
  approach: "unknown", configuration: "unknown", intraoperative: null, cardiopulmonaryBypassUsed: null,
  servicePerformed: null, sourceVerified: null, reportingClinician: "", clinicianEligible: null,
  managementDocumented: null, interrogationInPerson: null, interrogationAnalysisReport: null, sameDayProcedureCodes: [],
});
const blankDiagnosis = (): VadEcmoDiagnosisEvidence => ({ id: id("diagnosis"), code: "", description: "", providerDocumented: null, clinicallySupported: null });
const initialCase: VadEcmoCaseInput = {
  patientName: "", dateOfBirth: "1980-01-01", claimScope: "professional", payerType: "medicare", payerName: "", payerJurisdiction: "",
  payerPolicyVerified: null, payerPolicyCurrent: null,
  coverage: {
    indication: "unknown", fdaApprovedAndOnLabel: null, nyhaClassIV: null, lvefPercent: undefined, inotropeDependent: null,
    cardiacIndex: undefined, optimalMedicalManagementDaysOfLast60: undefined, failingOptimalMedicalManagement: null,
    advancedHeartFailureDays: undefined, temporaryMechanicalSupportDays: undefined, multidisciplinaryTeamConfirmed: null,
    credentialedFacilityConfirmed: null, informedDecisionSupportConfirmed: null,
  },
  diagnoses: [], services: [blankService()],
};

async function authenticatedFetch(path: string, init: RequestInit = {}) {
  const { supabase } = await import("@/lib/supabase");
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error("Your session expired. Sign in again and retry.");
  const response = await fetch(path, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${data.session.access_token}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `Request failed (${response.status})`);
  return payload;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="vad-field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}

function ReviewToggle({ value, onChange, label }: { value: VadEcmoReviewState; onChange: (value: VadEcmoReviewState) => void; label: string }) {
  return <div className={`vad-review ${value === true ? "yes" : value === false ? "no" : "pending"}`}>
    <strong>{label}</strong><div><button type="button" className={value === true ? "active" : ""} onClick={() => onChange(true)}>Yes</button><button type="button" className={value === false ? "active" : ""} onClick={() => onChange(false)}>No</button><button type="button" className={value === null ? "active" : ""} onClick={() => onChange(null)}>Review</button></div>
  </div>;
}

export function VadEcmoWorkspace() {
  const [caseInput, setCaseInput] = useState<VadEcmoCaseInput>(initialCase);
  const [documents, setDocuments] = useState<ExtractedDocument[]>([]);
  const [result, setResult] = useState<WorksheetPayload | null>(null);
  const [busy, setBusy] = useState<"documents" | "worksheet" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const update = <K extends keyof VadEcmoCaseInput>(key: K, value: VadEcmoCaseInput[K]) => setCaseInput((current) => ({ ...current, [key]: value }));
  const updateCoverage = <K extends keyof VadEcmoCaseInput["coverage"]>(key: K, value: VadEcmoCaseInput["coverage"][K]) => setCaseInput((current) => ({ ...current, coverage: { ...current.coverage, [key]: value } }));
  const updateService = <K extends keyof VadEcmoServiceInput>(serviceId: string, key: K, value: VadEcmoServiceInput[K]) => update("services", caseInput.services.map((row) => row.id === serviceId ? { ...row, [key]: value } : row));
  const updateDiagnosis = <K extends keyof VadEcmoDiagnosisEvidence>(diagnosisId: string, key: K, value: VadEcmoDiagnosisEvidence[K]) => update("diagnoses", caseInput.diagnoses.map((row) => row.id === diagnosisId ? { ...row, [key]: value } : row));

  const uploadDocuments = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy("documents"); setError(null); setNotice(null);
    try {
      const body = new FormData(); Array.from(files).forEach((file) => body.append("documents", file));
      const payload = await authenticatedFetch("/api/vad-ecmo/documents/extract", { method: "POST", body });
      const incoming = payload.documents as ExtractedDocument[];
      setDocuments((current) => [...current, ...incoming]);
      setCaseInput((current) => {
        const next = { ...current };
        const first = incoming[0];
        if (first?.patientName) next.patientName = first.patientName;
        if (first?.dateOfBirth) next.dateOfBirth = first.dateOfBirth;
        const extractedServices = incoming.flatMap((document) => document.services.map((row) => ({
          ...blankService(), serviceDate: row.serviceDate || "", supportKind: row.supportKind || "ecmo", phase: row.phase || "daily-management",
          ecmoMode: row.ecmoMode || "unknown", approach: row.approach || "unknown", configuration: row.configuration || "unknown",
          reportingClinician: row.reportingClinician || "", managementDocumented: row.managementText ? null : null,
          interrogationInPerson: row.interrogationText ? null : null, interrogationAnalysisReport: row.interrogationText ? null : null,
          sameDayProcedureCodes: row.procedureCodes || [], sourceDocumentId: document.fileName,
        })));
        const extractedDiagnoses = incoming.flatMap((document) => document.diagnoses.map((row) => ({ ...blankDiagnosis(), code: row.code, description: row.description || "", sourceDocumentId: document.fileName })));
        if (extractedServices.length) next.services = extractedServices;
        if (extractedDiagnoses.length) next.diagnoses = extractedDiagnoses;
        return next;
      });
      setNotice(`${incoming.length} document${incoming.length === 1 ? "" : "s"} scanned. Extracted facts remain unverified candidates.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Document processing failed."); }
    finally { setBusy(null); if (fileRef.current) fileRef.current.value = ""; }
  };

  const buildWorksheet = async () => {
    setBusy("worksheet"); setError(null); setNotice(null);
    try {
      const payload = await authenticatedFetch("/api/vad-ecmo/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseInput }) });
      setResult(payload); setNotice("Worksheet built. Resolve every hold and complete licensed code-set, payer, and NCCI review before release.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "VAD/ECMO worksheet failed."); }
    finally { setBusy(null); }
  };

  return <div className="vad-page">
    <section className="vad-hero">
      <div className="vad-hero-copy"><div className="vad-kicker"><Activity size={15} /> VAD / ECMO CODER <span>NEW</span></div><h1>Code the support episode—not just the machine.</h1><p>Device configuration, VV/VA mode, access, age, operative phase, management evidence, coverage, PCS construction, and same-day edits in one audited workspace.</p><div className="vad-hero-badges"><span><ShieldCheck size={15} /> Evidence dependent</span><span><Layers3 size={15} /> CPT + PCS separation</span><span><CircleGauge size={15} /> Episode ledger</span></div></div>
      <div className="vad-hero-art" aria-hidden="true"><img src="/assets/specialty/vad-ecmo-coder-hero-v1.png" alt="" /></div>
    </section>
    {(error || notice) && <div className={`vad-banner ${error ? "error" : "success"}`}>{error ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}<span>{error || notice}</span></div>}

    <div className="vad-layout"><main className="vad-main">
      <section className="vad-card"><header><div><span className="vad-step">01</span><div><h2>Encounter, claim scope, and payer</h2><p>Professional CPT and inpatient PCS are separate pathways.</p></div></div><BadgeCheck size={22} /></header><div className="vad-grid four">
        <Field label="Patient name" hint="Source matching only"><input value={caseInput.patientName} onChange={(event) => update("patientName", event.target.value)} placeholder="Patient full name" /></Field>
        <Field label="Date of birth"><input type="date" value={caseInput.dateOfBirth} onChange={(event) => update("dateOfBirth", event.target.value)} /></Field>
        <Field label="Claim scope"><select value={caseInput.claimScope} onChange={(event) => update("claimScope", event.target.value as VadEcmoCaseInput["claimScope"])}><option value="professional">Professional / CPT</option><option value="inpatient-facility">Inpatient facility / ICD-10-PCS</option></select></Field>
        <Field label="Payer type"><select value={caseInput.payerType} onChange={(event) => update("payerType", event.target.value as VadEcmoCaseInput["payerType"])}><option value="medicare">Medicare</option><option value="medicaid">Medicaid</option><option value="commercial">Commercial</option><option value="other">Other</option></select></Field>
        <Field label="Payer"><input value={caseInput.payerName} onChange={(event) => update("payerName", event.target.value)} placeholder="Payer name" /></Field>
        <Field label="Jurisdiction / plan"><input value={caseInput.payerJurisdiction} onChange={(event) => update("payerJurisdiction", event.target.value)} placeholder="MAC, state, or plan" /></Field>
      </div><div className="vad-review-row"><ReviewToggle label="Date-effective payer policy verified" value={caseInput.payerPolicyVerified} onChange={(value) => update("payerPolicyVerified", value)} /><ReviewToggle label="Policy current for every service date" value={caseInput.payerPolicyCurrent} onChange={(value) => update("payerPolicyCurrent", value)} /></div></section>

      <section className="vad-card vad-upload-card"><header><div><span className="vad-step">02</span><div><h2>Operative, perfusion, and device records</h2><p>Visual OCR scans printed and handwritten source documents.</p></div></div><FileSearch size={22} /></header><button type="button" className="vad-dropzone" onClick={() => fileRef.current?.click()} disabled={busy === "documents"}>{busy === "documents" ? <Loader2 className="spin" size={30} /> : <FileUp size={30} />}<strong>{busy === "documents" ? "Scanning every page…" : "Upload VAD / ECMO records"}</strong><span>PDF, PNG, or JPEG · handwriting-aware extraction · facts remain unverified</span></button><input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg" multiple hidden onChange={(event) => uploadDocuments(event.target.files)} />{documents.length > 0 && <div className="vad-documents">{documents.map((document, index) => <article key={`${document.fileName}-${index}`}><FileSearch size={17} /><div><strong>{document.fileName}</strong><span>{document.extractionMethod} · {document.services.length} service candidate{document.services.length === 1 ? "" : "s"}</span></div><em>VERIFY</em></article>)}</div>}</section>

      <section className="vad-card"><header><div><span className="vad-step">03</span><div><h2>Medicare durable-LVAD coverage evidence</h2><p>NCD 20.9.1 applies only when the payer, device, phase, and indication make it applicable.</p></div></div><ShieldCheck size={22} /></header><div className="vad-grid four">
        <Field label="Indication"><select value={caseInput.coverage.indication} onChange={(event) => updateCoverage("indication", event.target.value as VadEcmoCaseInput["coverage"]["indication"])}><option value="unknown">Review</option><option value="post-cardiotomy">Post-cardiotomy</option><option value="heart-failure-short-term">HF short-term support</option><option value="heart-failure-long-term">HF long-term support</option><option value="other">Other</option></select></Field>
        <Field label="LVEF %"><input type="number" min="0" max="100" value={caseInput.coverage.lvefPercent ?? ""} onChange={(event) => updateCoverage("lvefPercent", event.target.value ? Number(event.target.value) : undefined)} /></Field>
        <Field label="Cardiac index"><input type="number" min="0" step="0.1" value={caseInput.coverage.cardiacIndex ?? ""} onChange={(event) => updateCoverage("cardiacIndex", event.target.value ? Number(event.target.value) : undefined)} /></Field>
        <Field label="OMM days / last 60"><input type="number" min="0" max="60" value={caseInput.coverage.optimalMedicalManagementDaysOfLast60 ?? ""} onChange={(event) => updateCoverage("optimalMedicalManagementDaysOfLast60", event.target.value ? Number(event.target.value) : undefined)} /></Field>
        <Field label="Advanced HF days"><input type="number" min="0" value={caseInput.coverage.advancedHeartFailureDays ?? ""} onChange={(event) => updateCoverage("advancedHeartFailureDays", event.target.value ? Number(event.target.value) : undefined)} /></Field>
        <Field label="Temporary support days"><input type="number" min="0" value={caseInput.coverage.temporaryMechanicalSupportDays ?? ""} onChange={(event) => updateCoverage("temporaryMechanicalSupportDays", event.target.value ? Number(event.target.value) : undefined)} /></Field>
      </div><div className="vad-review-grid coverage"><ReviewToggle label="FDA approved and on label" value={caseInput.coverage.fdaApprovedAndOnLabel} onChange={(value) => updateCoverage("fdaApprovedAndOnLabel", value)} /><ReviewToggle label="NYHA Class IV documented" value={caseInput.coverage.nyhaClassIV} onChange={(value) => updateCoverage("nyhaClassIV", value)} /><ReviewToggle label="Inotrope dependent" value={caseInput.coverage.inotropeDependent} onChange={(value) => updateCoverage("inotropeDependent", value)} /><ReviewToggle label="Failing optimal management" value={caseInput.coverage.failingOptimalMedicalManagement} onChange={(value) => updateCoverage("failingOptimalMedicalManagement", value)} /><ReviewToggle label="Qualified multidisciplinary team" value={caseInput.coverage.multidisciplinaryTeamConfirmed} onChange={(value) => updateCoverage("multidisciplinaryTeamConfirmed", value)} /><ReviewToggle label="Credentialed facility" value={caseInput.coverage.credentialedFacilityConfirmed} onChange={(value) => updateCoverage("credentialedFacilityConfirmed", value)} /><ReviewToggle label="Informed decision support" value={caseInput.coverage.informedDecisionSupportConfirmed} onChange={(value) => updateCoverage("informedDecisionSupportConfirmed", value)} /></div></section>

      <section className="vad-card"><header><div><span className="vad-step">04</span><div><h2>Provider-documented diagnoses</h2><p>Shock, failure, complications, and device status are never inferred from support use.</p></div></div><button type="button" className="vad-add" onClick={() => update("diagnoses", [...caseInput.diagnoses, blankDiagnosis()])}><Plus size={15} /> Add diagnosis</button></header>{caseInput.diagnoses.length === 0 ? <div className="vad-empty">No diagnosis evidence added.</div> : <div className="vad-diagnoses">{caseInput.diagnoses.map((row) => <article key={row.id}><input value={row.code} onChange={(event) => updateDiagnosis(row.id, "code", event.target.value.toUpperCase())} placeholder="ICD-10-CM" /><input value={row.description || ""} onChange={(event) => updateDiagnosis(row.id, "description", event.target.value)} placeholder="Provider wording" /><ReviewToggle label="Provider documented" value={row.providerDocumented} onChange={(value) => updateDiagnosis(row.id, "providerDocumented", value)} /><ReviewToggle label="Clinically supported" value={row.clinicallySupported} onChange={(value) => updateDiagnosis(row.id, "clinicallySupported", value)} /><button type="button" className="vad-icon-button" onClick={() => update("diagnoses", caseInput.diagnoses.filter((item) => item.id !== row.id))}><Trash2 size={15} /></button></article>)}</div>}</section>

      <section className="vad-card vad-ledger"><header><div><span className="vad-step">05</span><div><h2>Mechanical-support episode ledger</h2><p>One documented service record for each phase, date, and reporting clinician.</p></div></div><button type="button" className="vad-add" onClick={() => update("services", [...caseInput.services, blankService()])}><Plus size={15} /> Add service</button></header><div className="vad-services">{caseInput.services.map((service, index) => <article className="vad-service" key={service.id}><div className="vad-service-title"><div><span>{String(index + 1).padStart(2, "0")}</span><strong>{service.supportKind.replaceAll("-", " ")} · {service.phase.replaceAll("-", " ")}</strong></div>{caseInput.services.length > 1 && <button type="button" className="vad-icon-button" onClick={() => update("services", caseInput.services.filter((item) => item.id !== service.id))}><Trash2 size={15} /></button>}</div><div className="vad-grid service-grid">
          <Field label="Service date"><input type="date" value={service.serviceDate} onChange={(event) => updateService(service.id, "serviceDate", event.target.value)} /></Field>
          <Field label="Support system"><select value={service.supportKind} onChange={(event) => updateService(service.id, "supportKind", event.target.value as VadEcmoServiceInput["supportKind"])}><option value="ecmo">ECMO / ECLS</option><option value="extracorporeal-vad">Extracorporeal VAD</option><option value="implantable-vad">Implantable VAD</option><option value="percutaneous-vad">Percutaneous VAD</option></select></Field>
          <Field label="Phase"><select value={service.phase} onChange={(event) => updateService(service.id, "phase", event.target.value as VadEcmoServiceInput["phase"])}><option value="initiation">Initiation</option><option value="daily-management">Daily management</option><option value="insertion">Insertion / cannulation</option><option value="reposition">Reposition</option><option value="removal">Removal / decannulation</option><option value="replacement">Replacement</option><option value="interrogation">Interrogation</option></select></Field>
          <Field label="ECMO mode"><select value={service.ecmoMode} onChange={(event) => updateService(service.id, "ecmoMode", event.target.value as VadEcmoServiceInput["ecmoMode"])}><option value="unknown">Review</option><option value="vv">Veno-venous (VV)</option><option value="va">Veno-arterial (VA)</option></select></Field>
          <Field label="Access / approach"><select value={service.approach} onChange={(event) => updateService(service.id, "approach", event.target.value as VadEcmoServiceInput["approach"])}><option value="unknown">Review</option><option value="peripheral-percutaneous">Peripheral percutaneous</option><option value="peripheral-open">Peripheral open</option><option value="central-open">Central sternotomy/thoracotomy</option><option value="open">Open</option><option value="percutaneous">Percutaneous</option><option value="percutaneous-endoscopic">Percutaneous endoscopic</option></select></Field>
          <Field label="Configuration"><select value={service.configuration} onChange={(event) => updateService(service.id, "configuration", event.target.value as VadEcmoServiceInput["configuration"])}><option value="unknown">Review</option><option value="single-ventricle">Single ventricle</option><option value="biventricular">Biventricular</option><option value="arterial-only">Arterial only</option><option value="arterial-and-venous">Arterial + venous</option></select></Field>
          <Field label="Reporting clinician"><input value={service.reportingClinician} onChange={(event) => updateService(service.id, "reportingClinician", event.target.value)} placeholder="Name / NPI / role" /></Field>
          <Field label="Same-day procedure codes" hint="Comma separated; current NCCI check"><input value={service.sameDayProcedureCodes.join(", ")} onChange={(event) => updateService(service.id, "sameDayProcedureCodes", event.target.value.split(",").map((code) => code.trim()).filter(Boolean))} placeholder="33975, 93750" /></Field>
        </div><div className="vad-review-grid"><ReviewToggle label="Service performed" value={service.servicePerformed} onChange={(value) => updateService(service.id, "servicePerformed", value)} /><ReviewToggle label="Source verified" value={service.sourceVerified} onChange={(value) => updateService(service.id, "sourceVerified", value)} /><ReviewToggle label="Clinician eligible to report" value={service.clinicianEligible} onChange={(value) => updateService(service.id, "clinicianEligible", value)} /><ReviewToggle label="Initiation / management documented" value={service.managementDocumented} onChange={(value) => updateService(service.id, "managementDocumented", value)} /><ReviewToggle label="Intraoperative support" value={service.intraoperative} onChange={(value) => updateService(service.id, "intraoperative", value)} /><ReviewToggle label="Cardiopulmonary bypass used" value={service.cardiopulmonaryBypassUsed} onChange={(value) => updateService(service.id, "cardiopulmonaryBypassUsed", value)} /><ReviewToggle label="Interrogation in person" value={service.interrogationInPerson} onChange={(value) => updateService(service.id, "interrogationInPerson", value)} /><ReviewToggle label="Analysis / report documented" value={service.interrogationAnalysisReport} onChange={(value) => updateService(service.id, "interrogationAnalysisReport", value)} /></div></article>)}</div></section>
    </main>

    <aside className="vad-results"><div className="vad-results-head"><div><Sparkles size={18} /><span>SUPPORT CODING WORKSHEET</span></div><em>v{VAD_ECMO_ENGINE_VERSION}</em></div>{!result ? <div className="vad-results-empty"><div><HeartPulse size={35} /></div><h3>Build from the episode evidence.</h3><p>The same device can map differently by mode, age, access, phase, configuration, bypass, and claim scope.</p><ul><li><Activity size={15} /> VV / VA logic</li><li><Stethoscope size={15} /> Clinician evidence</li><li><Layers3 size={15} /> CPT / PCS boundary</li><li><Database size={15} /> NCD + NCCI controls</li></ul></div> : <div className="vad-output"><div className={`vad-status ${result.evaluation.status}`}><span>{result.evaluation.status === "hold" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}{result.evaluation.status.toUpperCase()}</span><small>{result.evaluation.status === "ready" ? "Ready for human approval" : "Resolve review gates"}</small></div><div className="vad-output-section"><h3>Code candidates <span>{result.evaluation.claimCodes.length}</span></h3>{result.evaluation.services.map((service) => service.candidates.map((item, index) => <article className={`vad-code-line ${item.status}`} key={`${service.id}-${index}`}><div><span>{service.serviceDate}</span><strong>{item.code || "HELD"}</strong><em>{item.system}</em></div><p>{item.rationale}</p>{item.blockers.slice(0, 3).map((blocker) => <small key={blocker}><AlertTriangle size={12} /> {blocker}</small>)}</article>))}</div><div className="vad-output-section"><h3>Coverage <span>{result.evaluation.coverage.status}</span></h3>{result.evaluation.coverage.findings.map((finding) => <p className="vad-finding" key={finding}>{finding}</p>)}</div><div className="vad-output-section"><h3>Diagnosis evidence</h3>{result.evaluation.diagnoses.map((diagnosis) => <div className={`vad-dx-line ${diagnosis.status}`} key={diagnosis.id}><strong>{diagnosis.code}</strong><span>{diagnosis.status}</span></div>)}</div>{result.ncci && <div className="vad-ncci"><ShieldCheck size={17} /><div><strong>NCCI response attached</strong><span>{result.ncci.unavailable ? "Lookup unavailable — manual review required" : "Current edit response returned"}</span></div></div>}<div className="vad-safety"><Info size={16} /><p>Candidate worksheet only. It does not diagnose, establish coverage, replace licensed CPT/current PCS tables, determine an MS-DRG, authorize a modifier, or submit a claim.</p></div></div>}<button type="button" className="vad-build" onClick={buildWorksheet} disabled={busy === "worksheet"}>{busy === "worksheet" ? <Loader2 className="spin" size={18} /> : <ShieldCheck size={18} />}{busy === "worksheet" ? "Building worksheet…" : "Build VAD / ECMO worksheet"}</button></aside>
    </div>
  </div>;
}

export default VadEcmoWorkspace;
