import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Baby, BadgeCheck, CalendarDays, CheckCircle2, ClipboardCheck, Database,
  FileSearch, FileUp, HeartPulse, Info, Layers3, Loader2, Plus, Scale, ShieldCheck,
  Sparkles, Stethoscope, Trash2, UserRoundCheck,
} from "lucide-react";
import {
  NICU_ENGINE_VERSION,
  nicuAgeOnDate,
  type NicuCaseInput,
  type NicuDailyInput,
  type NicuDiagnosisEvidence,
  type NicuEvaluation,
  type NicuProcedureEvidence,
  type NicuReviewState,
} from "../../../shared/nicu-coding";

type ExtractedDocument = {
  fileName: string;
  extractionMethod: string;
  patientName?: string | null;
  dateOfBirth?: string | null;
  admissionDate?: string | null;
  birthWeightGrams?: number | null;
  days: Array<Record<string, any>>;
  diagnoses: Array<Record<string, any>>;
  warnings: string[];
};

type WorksheetPayload = { evaluation: NicuEvaluation; ncci?: any };
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const blankProcedure = (): NicuProcedureEvidence => ({ id: id("procedure"), code: "", description: "", performed: null, separatelyIdentifiable: null });
const blankDiagnosis = (): NicuDiagnosisEvidence => ({ id: id("diagnosis"), code: "", description: "", providerDocumented: null, clinicallySignificant: null, presentOnAdmission: "unknown" });
const blankDay = (serviceDate = "2026-08-10"): NicuDailyInput => ({
  id: id("day"), serviceDate, presentWeightGrams: 1400, careLevel: "critical",
  criticalStatusDocumented: null, intensiveServicesDocumented: null, recoveringLowBirthWeightInfant: null,
  directingProviderId: "", directingProviderRole: "physician", providerDirectedCare: null,
  bedsideExamDocumented: null, planOfCareDirected: null, anotherProviderReportedPerDiem: null,
  sameDayIntensiveToCriticalTransfer: false, differentGroupAtCriticalTransfer: false,
  dischargeManagementMinutes: undefined, procedures: [],
});
const initialCase: NicuCaseInput = {
  patientName: "", dateOfBirth: "2026-08-01", admissionDate: "2026-08-01", admissionOrigin: "birth-hospital",
  birthWeightGrams: 1300, claimScope: "practitioner", payerType: "medicaid", payerName: "", payerJurisdiction: "",
  payerPolicyVerified: null, payerPolicyCurrent: null, diagnoses: [], days: [blankDay()],
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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="nicu-field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}

function ReviewToggle({ value, onChange, label }: { value: NicuReviewState; onChange: (value: NicuReviewState) => void; label: string }) {
  return <div className={`nicu-review ${value === true ? "yes" : value === false ? "no" : "pending"}`}>
    <strong>{label}</strong>
    <div>
      <button type="button" className={value === true ? "active" : ""} onClick={() => onChange(true)}>Yes</button>
      <button type="button" className={value === false ? "active" : ""} onClick={() => onChange(false)}>No</button>
      <button type="button" className={value === null ? "active" : ""} onClick={() => onChange(null)}>Review</button>
    </div>
  </div>;
}

export function NicuWorkspace() {
  const [caseInput, setCaseInput] = useState<NicuCaseInput>(initialCase);
  const [documents, setDocuments] = useState<ExtractedDocument[]>([]);
  const [result, setResult] = useState<WorksheetPayload | null>(null);
  const [busy, setBusy] = useState<"documents" | "worksheet" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof NicuCaseInput>(key: K, value: NicuCaseInput[K]) => setCaseInput((current) => ({ ...current, [key]: value }));
  const updateDay = <K extends keyof NicuDailyInput>(dayId: string, key: K, value: NicuDailyInput[K]) => setCaseInput((current) => ({ ...current, days: current.days.map((day) => day.id === dayId ? { ...day, [key]: value } : day) }));
  const ageSummary = useMemo(() => caseInput.days.map((day) => ({ id: day.id, ...nicuAgeOnDate(caseInput.dateOfBirth, day.serviceDate) })), [caseInput.dateOfBirth, caseInput.days]);

  const uploadDocuments = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy("documents"); setError(null); setNotice(null);
    try {
      const body = new FormData(); Array.from(files).forEach((file) => body.append("documents", file));
      const payload = await authenticatedFetch("/api/nicu/documents/extract", { method: "POST", body });
      const incoming = payload.documents as ExtractedDocument[];
      setDocuments((current) => [...current, ...incoming]);
      setCaseInput((current) => {
        const next = { ...current };
        const first = incoming[0];
        if (first?.patientName) next.patientName = first.patientName;
        if (first?.dateOfBirth) next.dateOfBirth = first.dateOfBirth;
        if (first?.admissionDate) next.admissionDate = first.admissionDate;
        if (first?.birthWeightGrams) next.birthWeightGrams = first.birthWeightGrams;
        const extractedDays = incoming.flatMap((document) => document.days.map((row) => ({
          ...blankDay(row.serviceDate || current.admissionDate),
          presentWeightGrams: row.presentWeightGrams,
          careLevel: row.careLevel || "routine",
          directingProviderId: row.directingProvider || "",
          directingProviderRole: row.providerRole || "unknown",
          criticalStatusDocumented: row.criticalStatusText ? null : null,
          intensiveServicesDocumented: row.intensiveServicesText ? null : null,
          recoveringLowBirthWeightInfant: row.recoveringLowBirthWeightText ? null : null,
          providerDirectedCare: row.planDirectionText ? null : null,
          bedsideExamDocumented: row.bedsideExamText ? null : null,
          planOfCareDirected: row.planDirectionText ? null : null,
          dischargeManagementMinutes: row.dischargeMinutes,
          sourceDocumentId: document.fileName,
          procedures: (row.procedureCodes || []).map((code: string) => ({ ...blankProcedure(), code, sourceDocumentId: document.fileName })),
        })));
        const extractedDiagnoses = incoming.flatMap((document) => document.diagnoses.map((row) => ({ ...blankDiagnosis(), code: row.code, description: row.description || "", sourceDocumentId: document.fileName })));
        if (extractedDays.length) next.days = extractedDays;
        if (extractedDiagnoses.length) next.diagnoses = extractedDiagnoses;
        return next;
      });
      setNotice(`${incoming.length} document${incoming.length === 1 ? "" : "s"} scanned. OCR facts were added as unverified candidates.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Document processing failed."); }
    finally { setBusy(null); if (fileRef.current) fileRef.current.value = ""; }
  };

  const buildWorksheet = async () => {
    setBusy("worksheet"); setError(null); setNotice(null);
    try {
      const payload = await authenticatedFetch("/api/nicu/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseInput }) });
      setResult(payload);
      setNotice("Daily worksheet built. Resolve every hold and complete licensed CPT, NCCI, and payer review before release.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "NICU worksheet failed."); }
    finally { setBusy(null); }
  };

  const addDiagnosis = () => update("diagnoses", [...caseInput.diagnoses, blankDiagnosis()]);
  const updateDiagnosis = <K extends keyof NicuDiagnosisEvidence>(diagnosisId: string, key: K, value: NicuDiagnosisEvidence[K]) => update("diagnoses", caseInput.diagnoses.map((row) => row.id === diagnosisId ? { ...row, [key]: value } : row));
  const addProcedure = (dayId: string) => updateDay(dayId, "procedures", [...(caseInput.days.find((day) => day.id === dayId)?.procedures || []), blankProcedure()]);
  const updateProcedure = <K extends keyof NicuProcedureEvidence>(dayId: string, procedureId: string, key: K, value: NicuProcedureEvidence[K]) => updateDay(dayId, "procedures", (caseInput.days.find((day) => day.id === dayId)?.procedures || []).map((row) => row.id === procedureId ? { ...row, [key]: value } : row));

  return <div className="nicu-page">
    <section className="nicu-hero">
      <div className="nicu-hero-copy">
        <div className="nicu-kicker"><Baby size={15} /> NICU DAILY CODER <span>NEW</span></div>
        <h1>Turn every NICU day into a defensible evidence record.</h1>
        <p>Age-band transitions, present-weight tiers, directing-provider evidence, perinatal diagnoses, procedures, NCCI, and payer release controls in one longitudinal workspace.</p>
        <div className="nicu-hero-badges"><span><ShieldCheck size={15} /> No clinical inference</span><span><CalendarDays size={15} /> Per-day sequence</span><span><UserRoundCheck size={15} /> Human release</span></div>
      </div>
      <div className="nicu-hero-art" aria-hidden="true"><img src="/assets/specialty/nicu-daily-coder-hero-v1.png" alt="" /></div>
    </section>

    {(error || notice) && <div className={`nicu-banner ${error ? "error" : "success"}`}>{error ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}<span>{error || notice}</span></div>}

    <div className="nicu-layout">
      <main className="nicu-main">
        <section className="nicu-card">
          <header><div><span className="nicu-step">01</span><div><h2>Encounter and payer context</h2><p>Calendar age, claim scope, admission origin, and policy jurisdiction control the workflow.</p></div></div><BadgeCheck size={22} /></header>
          <div className="nicu-grid four">
            <Field label="Patient name" hint="Used only for source matching"><input value={caseInput.patientName} onChange={(event) => update("patientName", event.target.value)} placeholder="Patient full name" /></Field>
            <Field label="Date of birth"><input type="date" value={caseInput.dateOfBirth} onChange={(event) => update("dateOfBirth", event.target.value)} /></Field>
            <Field label="Admission date"><input type="date" value={caseInput.admissionDate} onChange={(event) => update("admissionDate", event.target.value)} /></Field>
            <Field label="Admission origin"><select value={caseInput.admissionOrigin} onChange={(event) => update("admissionOrigin", event.target.value as NicuCaseInput["admissionOrigin"])}><option value="birth-hospital">Birth hospital</option><option value="transfer-in">Transfer in</option><option value="readmission">Readmission</option></select></Field>
            <Field label="Birth weight (g)" hint="Never used for daily weight tier"><input type="number" min="1" value={caseInput.birthWeightGrams || ""} onChange={(event) => update("birthWeightGrams", Number(event.target.value) || undefined)} /></Field>
            <Field label="Claim scope"><select value={caseInput.claimScope} onChange={(event) => update("claimScope", event.target.value as NicuCaseInput["claimScope"])}><option value="practitioner">Professional / practitioner</option><option value="facility">Facility / institutional</option></select></Field>
            <Field label="Payer type"><select value={caseInput.payerType} onChange={(event) => update("payerType", event.target.value as NicuCaseInput["payerType"])}><option value="medicaid">Medicaid</option><option value="chip">CHIP</option><option value="commercial">Commercial</option><option value="medicare">Medicare</option><option value="other">Other</option></select></Field>
            <Field label="Payer and jurisdiction"><div className="nicu-split"><input value={caseInput.payerName} onChange={(event) => update("payerName", event.target.value)} placeholder="Payer name" /><input value={caseInput.payerJurisdiction} onChange={(event) => update("payerJurisdiction", event.target.value)} placeholder="State / plan" /></div></Field>
          </div>
          <div className="nicu-review-row"><ReviewToggle label="Date-effective payer policy verified" value={caseInput.payerPolicyVerified} onChange={(value) => update("payerPolicyVerified", value)} /><ReviewToggle label="Policy current for all service dates" value={caseInput.payerPolicyCurrent} onChange={(value) => update("payerPolicyCurrent", value)} /></div>
        </section>

        <section className="nicu-card nicu-upload-card">
          <header><div><span className="nicu-step">02</span><div><h2>Source documents and visual OCR</h2><p>Scan handwritten progress notes, daily weights, flowsheets, transfers, procedures, and discharge records.</p></div></div><FileSearch size={22} /></header>
          <button type="button" className="nicu-dropzone" onClick={() => fileRef.current?.click()} disabled={busy === "documents"}>
            {busy === "documents" ? <Loader2 className="spin" size={30} /> : <FileUp size={30} />}<strong>{busy === "documents" ? "Scanning every page…" : "Upload NICU records"}</strong><span>PDF, PNG, or JPEG · visual handwriting review · all extracted facts remain unverified</span>
          </button>
          <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg" multiple hidden onChange={(event) => uploadDocuments(event.target.files)} />
          {documents.length > 0 && <div className="nicu-documents">{documents.map((document, index) => <article key={`${document.fileName}-${index}`}><FileSearch size={17} /><div><strong>{document.fileName}</strong><span>{document.extractionMethod} · {document.days.length} daily candidate{document.days.length === 1 ? "" : "s"}</span></div><em>VERIFY</em></article>)}</div>}
        </section>

        <section className="nicu-card">
          <header><div><span className="nicu-step">03</span><div><h2>Provider-documented diagnoses</h2><p>Age, weight, monitoring, treatment, and NICU location never create a diagnosis.</p></div></div><button type="button" className="nicu-add" onClick={addDiagnosis}><Plus size={16} /> Add diagnosis</button></header>
          {caseInput.diagnoses.length === 0 ? <div className="nicu-empty"><ClipboardCheck size={24} /><span>No diagnoses added. Add only provider-documented, clinically significant conditions.</span></div> : <div className="nicu-diagnoses">{caseInput.diagnoses.map((row) => <article key={row.id}>
            <input className="code" value={row.code} onChange={(event) => updateDiagnosis(row.id, "code", event.target.value.toUpperCase())} placeholder="ICD-10-CM" />
            <input value={row.description || ""} onChange={(event) => updateDiagnosis(row.id, "description", event.target.value)} placeholder="Documented diagnosis" />
            <ReviewToggle label="Provider documented" value={row.providerDocumented} onChange={(value) => updateDiagnosis(row.id, "providerDocumented", value)} />
            <ReviewToggle label="Clinically significant" value={row.clinicallySignificant} onChange={(value) => updateDiagnosis(row.id, "clinicallySignificant", value)} />
            <button type="button" className="nicu-icon-button" onClick={() => update("diagnoses", caseInput.diagnoses.filter((item) => item.id !== row.id))} aria-label="Remove diagnosis"><Trash2 size={16} /></button>
          </article>)}</div>}
        </section>

        <section className="nicu-card nicu-ledger-card">
          <header><div><span className="nicu-step">04</span><div><h2>Longitudinal daily evidence ledger</h2><p>One date, one directing-provider record, with age calculated from DOB and current weight captured for that day.</p></div></div><button type="button" className="nicu-add" onClick={() => update("days", [...caseInput.days, blankDay(caseInput.days.at(-1)?.serviceDate || caseInput.admissionDate)])}><Plus size={16} /> Add day</button></header>
          <div className="nicu-days">{caseInput.days.map((day, index) => {
            const age = ageSummary.find((item) => item.id === day.id);
            return <article className="nicu-day" key={day.id}>
              <div className="nicu-day-title"><div><span>DAY {String(index + 1).padStart(2, "0")}</span><strong>{day.serviceDate || "Date required"}</strong><em>{age?.ageDays === null ? "Invalid age" : `${age?.ageDays} days · ${age?.ageBand}`}</em></div>{caseInput.days.length > 1 && <button type="button" className="nicu-icon-button" onClick={() => update("days", caseInput.days.filter((item) => item.id !== day.id))}><Trash2 size={16} /></button>}</div>
              <div className="nicu-grid four compact">
                <Field label="Service date"><input type="date" value={day.serviceDate} onChange={(event) => updateDay(day.id, "serviceDate", event.target.value)} /></Field>
                <Field label="Present weight (g)" hint="Today's weight, not birth weight"><input type="number" min="1" value={day.presentWeightGrams || ""} onChange={(event) => updateDay(day.id, "presentWeightGrams", Number(event.target.value) || undefined)} /></Field>
                <Field label="Daily care level"><select value={day.careLevel} onChange={(event) => updateDay(day.id, "careLevel", event.target.value as NicuDailyInput["careLevel"])}><option value="critical">Critical</option><option value="intensive">Intensive / recovering</option><option value="routine">Below intensive</option><option value="discharge">Discharge</option><option value="comfort-care">Comfort care</option></select></Field>
                <Field label="Directing provider"><div className="nicu-split provider"><input value={day.directingProviderId} onChange={(event) => updateDay(day.id, "directingProviderId", event.target.value)} placeholder="Name / NPI" /><select value={day.directingProviderRole} onChange={(event) => updateDay(day.id, "directingProviderRole", event.target.value as NicuDailyInput["directingProviderRole"])}><option value="physician">Physician</option><option value="npp">NPP</option><option value="unknown">Unknown</option></select></div></Field>
                {day.careLevel === "discharge" && <Field label="Discharge management minutes"><input type="number" min="1" value={day.dischargeManagementMinutes || ""} onChange={(event) => updateDay(day.id, "dischargeManagementMinutes", Number(event.target.value) || undefined)} /></Field>}
              </div>
              <div className="nicu-review-grid">
                {day.careLevel === "critical" && <ReviewToggle label="Critical status explicitly documented" value={day.criticalStatusDocumented} onChange={(value) => updateDay(day.id, "criticalStatusDocumented", value)} />}
                {day.careLevel === "intensive" && <><ReviewToggle label="Intensive services documented" value={day.intensiveServicesDocumented} onChange={(value) => updateDay(day.id, "intensiveServicesDocumented", value)} /><ReviewToggle label="Recovering low-birth-weight infant" value={day.recoveringLowBirthWeightInfant} onChange={(value) => updateDay(day.id, "recoveringLowBirthWeightInfant", value)} /></>}
                <ReviewToggle label="Provider directed the care" value={day.providerDirectedCare} onChange={(value) => updateDay(day.id, "providerDirectedCare", value)} />
                <ReviewToggle label="Bedside exam documented" value={day.bedsideExamDocumented} onChange={(value) => updateDay(day.id, "bedsideExamDocumented", value)} />
                <ReviewToggle label="Plan of care directed" value={day.planOfCareDirected} onChange={(value) => updateDay(day.id, "planOfCareDirected", value)} />
                <ReviewToggle label="Another provider reported per diem" value={day.anotherProviderReportedPerDiem} onChange={(value) => updateDay(day.id, "anotherProviderReportedPerDiem", value)} />
              </div>
              <div className="nicu-procedures-head"><strong>Procedures performed</strong><button type="button" onClick={() => addProcedure(day.id)}><Plus size={14} /> Add procedure</button></div>
              {day.procedures.length > 0 && <div className="nicu-procedures">{day.procedures.map((procedure) => <div key={procedure.id}><input value={procedure.code} onChange={(event) => updateProcedure(day.id, procedure.id, "code", event.target.value.toUpperCase())} placeholder="CPT/HCPCS" /><input value={procedure.description || ""} onChange={(event) => updateProcedure(day.id, procedure.id, "description", event.target.value)} placeholder="Source description" /><ReviewToggle label="Performed" value={procedure.performed} onChange={(value) => updateProcedure(day.id, procedure.id, "performed", value)} /><button type="button" className="nicu-icon-button" onClick={() => updateDay(day.id, "procedures", day.procedures.filter((item) => item.id !== procedure.id))}><Trash2 size={15} /></button></div>)}</div>}
            </article>;
          })}</div>
        </section>
      </main>

      <aside className="nicu-results">
        <div className="nicu-results-head"><div><Sparkles size={18} /><span>DAILY CODING WORKSHEET</span></div><em>v{NICU_ENGINE_VERSION}</em></div>
        {!result ? <div className="nicu-results-empty"><div><HeartPulse size={34} /></div><h3>Evidence first. Codes second.</h3><p>Complete daily facts and verification controls, then build the longitudinal worksheet.</p><p>The worksheet does not establish critical illness, coverage, or permission to submit a claim.</p><ul><li><Scale size={15} /> Present weight tiering</li><li><Stethoscope size={15} /> Directing-provider gates</li><li><Layers3 size={15} /> NCCI and procedure review</li><li><Database size={15} /> Source provenance</li></ul></div> : <div className="nicu-output">
          <div className={`nicu-status ${result.evaluation.status}`}><span>{result.evaluation.status === "hold" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}{result.evaluation.status.toUpperCase()}</span><small>{result.evaluation.status === "ready" ? "Ready for human approval" : "Resolve review gates"}</small></div>
          <div className="nicu-output-section"><h3>Daily candidates <span>{result.evaluation.days.length}</span></h3>{result.evaluation.days.map((day) => <article className={`nicu-code-line ${day.status}`} key={day.id}><div><span>{day.serviceDate}</span><strong>{day.code || "HELD"}</strong><em>{day.codeRole}</em></div><p>{day.rationale}</p>{day.blockers.slice(0, 3).map((blocker) => <small key={blocker}><AlertTriangle size={12} /> {blocker}</small>)}</article>)}</div>
          <div className="nicu-output-section"><h3>Diagnosis evidence <span>{result.evaluation.diagnoses.length}</span></h3>{result.evaluation.diagnoses.length ? result.evaluation.diagnoses.map((diagnosis) => <div className={`nicu-dx-line ${diagnosis.status}`} key={diagnosis.id}><strong>{diagnosis.code}</strong><span>{diagnosis.status}</span></div>) : <p className="nicu-muted">No diagnosis evidence was supplied.</p>}</div>
          {result.evaluation.days.some((day) => day.procedureReviews.length) && <div className="nicu-output-section"><h3>Procedure disposition</h3>{result.evaluation.days.flatMap((day) => day.procedureReviews).map((procedure) => <div className={`nicu-dx-line ${procedure.status}`} key={procedure.id}><strong>{procedure.code || "INVALID"}</strong><span>{procedure.status}</span></div>)}</div>}
          {result.ncci && <div className="nicu-ncci"><ShieldCheck size={17} /><div><strong>NCCI response attached</strong><span>{result.ncci.unavailable ? "Lookup unavailable — manual review required" : "Date-effective edit review returned for this code set"}</span></div></div>}
          <div className="nicu-safety"><Info size={16} /><p>Candidate worksheet only. It does not establish critical illness, coverage, facility payment, modifier eligibility, or permission to submit a claim.</p></div>
        </div>}
        <button type="button" className="nicu-build" onClick={buildWorksheet} disabled={busy === "worksheet"}>{busy === "worksheet" ? <Loader2 className="spin" size={18} /> : <ShieldCheck size={18} />}{busy === "worksheet" ? "Building daily worksheet…" : "Build NICU daily worksheet"}</button>
      </aside>
    </div>
  </div>;
}

export default NicuWorkspace;
