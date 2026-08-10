import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle, BadgeCheck, Building2, CalendarDays, CheckCircle2, ChevronRight,
  ClipboardCheck, Database, FileText, FileUp, HeartHandshake, Info, Loader2,
  Pill, ReceiptText, ShieldCheck, Sparkles, Stethoscope, Video,
} from "lucide-react";
import {
  OTP_ENGINE_VERSION,
  evaluateOtpCase,
  type OtpCaseInput,
  type OtpDomainResult,
  type OtpEvaluation,
  type OtpMedication,
  type OtpStatus,
} from "../../../shared/otp-mat-coding";

const TODAY = new Date().toISOString().slice(0, 10);
const MEDICATIONS: Array<[OtpMedication, string, string]> = [
  ["methadone", "Methadone", "Weekly · G2067"],
  ["buprenorphine-oral", "Oral buprenorphine", "Weekly · G2068"],
  ["buprenorphine-injectable-weekly", "Injectable buprenorphine", "Weekly · G0533"],
  ["buprenorphine-injectable-monthly", "Injectable buprenorphine", "Monthly · G2069"],
  ["naltrexone", "Naltrexone", "Weekly · G2073"],
  ["no-drug", "No drug furnished", "Weekly · G2074"],
  ["not-otherwise-specified", "Medication NOS", "MAC-priced · G2075"],
];

const initialCase: OtpCaseInput = {
  serviceDate: TODAY,
  payerMode: "medicare-ffs",
  claimEntity: "professional",
  siteType: "freestanding",
  diagnosisCodes: [],
  organizationNpi: "",
  orderingNpi: "",
  program: { samhsaCertified: null, accredited: null, medicareEnrolled: null, deaAndStateAuthorized: null },
  medication: "methadone",
  drugComponentFurnished: null,
  nondrugComponentFurnished: null,
  newPatient: null,
  intakePerformed: false,
  periodicAssessmentPerformed: false,
  additionalCounselingMinutes: 0,
  counselingBeyondBundlePlan: null,
  coordinatedCareMinutes: 0,
  navigationMinutes: 0,
  peerRecoveryMinutes: 0,
  intensiveOutpatient: { requested: false, practitionerCertified: null, services: [] },
  takeHome: { additionalDays: 0, noOverlapWithBundleDates: null, practitionerAuthorized: null },
  overdoseMedication: { product: "none" },
  telecom: { mode: "none", service: "none", federalStateRequirementsMet: null },
  duplicateBundle: { detected: false, reason: "none", recordsExchanged: null, modifier59Supported: null },
};

type UploadedDocument = {
  fileName: string;
  documentType: string;
  extractionMethod: string;
  requiresManualReview: boolean;
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

const diagnosisList = (value: string) => Array.from(new Set(value.split(/[,;\n\s]+/).map((code) => code.trim().toUpperCase()).filter(Boolean)));
const money = (value: number | null) => value == null ? "MAC pricing required" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 100);

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="otp-field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}

function Toggle({ checked, onChange, label, detail }: { checked: boolean; onChange: (value: boolean) => void; label: string; detail?: string }) {
  return <label className={`otp-toggle${checked ? " active" : ""}`}>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    <span className="otp-toggle-check">{checked ? <CheckCircle2 size={15} /> : null}</span>
    <span><strong>{label}</strong>{detail ? <small>{detail}</small> : null}</span>
  </label>;
}

function StatusPill({ status }: { status: OtpStatus }) {
  return <span className={`otp-status status-${status}`}>{status.replace("not-applicable", "n/a")}</span>;
}

function DomainCard({ result }: { result: OtpDomainResult }) {
  return <article className={`otp-domain domain-${result.status}`}>
    <header><strong>{result.title}</strong><StatusPill status={result.status} /></header>
    {result.reasons.slice(0, 2).map((reason) => <p className="reason" key={reason}><CheckCircle2 size={14} />{reason}</p>)}
    {result.blockers.slice(0, 3).map((blocker) => <p className="blocker" key={blocker}><AlertTriangle size={14} />{blocker}</p>)}
    <footer><Database size={12} />{result.sourceIds.join(" · ")}</footer>
  </article>;
}

export function OtpMatWorkspace() {
  const [caseInput, setCaseInput] = useState<OtpCaseInput>(initialCase);
  const [diagnosisText, setDiagnosisText] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [result, setResult] = useState<OtpEvaluation | null>(null);
  const [building, setBuilding] = useState(false);
  const [serverNotice, setServerNotice] = useState<string | null>(null);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof OtpCaseInput>(key: K, value: OtpCaseInput[K]) => setCaseInput((current) => ({ ...current, [key]: value }));
  const updateProgram = (key: keyof OtpCaseInput["program"], value: boolean | null) => setCaseInput((current) => ({ ...current, program: { ...current.program, [key]: value } }));
  const updateTakeHome = (key: keyof NonNullable<OtpCaseInput["takeHome"]>, value: unknown) => setCaseInput((current) => ({ ...current, takeHome: { additionalDays: 0, noOverlapWithBundleDates: null, practitionerAuthorized: null, ...current.takeHome, [key]: value } }));
  const updateTelecom = (key: keyof NonNullable<OtpCaseInput["telecom"]>, value: unknown) => setCaseInput((current) => ({ ...current, telecom: { mode: "none", service: "none", ...current.telecom, [key]: value } }));
  const updateDuplicate = (key: keyof NonNullable<OtpCaseInput["duplicateBundle"]>, value: unknown) => setCaseInput((current) => ({ ...current, duplicateBundle: { detected: false, reason: "none", ...current.duplicateBundle, [key]: value } }));
  const updateOverdose = (key: keyof NonNullable<OtpCaseInput["overdoseMedication"]>, value: unknown) => setCaseInput((current) => ({ ...current, overdoseMedication: { product: "none", ...current.overdoseMedication, [key]: value } }));

  const primaryPreview = useMemo(() => evaluateOtpCase({ ...caseInput, diagnosisCodes: diagnosisList(diagnosisText) }), [caseInput, diagnosisText]);

  function setIopServiceCount(count: number) {
    const safe = Math.max(0, Math.min(30, count));
    setCaseInput((current) => ({
      ...current,
      intensiveOutpatient: {
        requested: current.intensiveOutpatient?.requested || false,
        practitionerCertified: current.intensiveOutpatient?.practitionerCertified ?? null,
        services: Array.from({ length: safe }, (_, index) => ({
          id: `service-${index + 1}`,
          serviceDate: current.serviceDate,
          category: "counseling" as const,
          countedElsewhere: false,
        })),
      },
    }));
  }

  async function uploadDocuments(fileList: FileList | null) {
    if (!fileList?.length) return;
    setDocumentBusy(true);
    setDocumentError(null);
    const formData = new FormData();
    Array.from(fileList).forEach((file) => formData.append("documents", file));
    try {
      const payload = await authenticatedFetch("/api/otp-mat/documents/extract", { method: "POST", body: formData });
      setDocuments(payload.documents || []);
      setServerNotice(payload.notice || null);
    } catch (error: any) {
      setDocumentError(error?.message || "Document processing failed.");
    } finally {
      setDocumentBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function buildWorksheet() {
    const reviewed: OtpCaseInput = { ...caseInput, diagnosisCodes: diagnosisList(diagnosisText) };
    setCaseInput(reviewed);
    setBuilding(true);
    setServerNotice(null);
    const local = evaluateOtpCase(reviewed);
    try {
      const payload = await authenticatedFetch("/api/otp-mat/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseInput: reviewed, stateCode }),
      });
      setResult(payload.evaluation);
      setServerNotice("CMS/MAC evidence was checked. Supporting matches never replace the national OTP, state, and payer gates shown below.");
    } catch (error: any) {
      setResult(local);
      setServerNotice(`The rules engine completed locally. Connected evidence was unavailable: ${error?.message || "network error"}`);
    } finally {
      setBuilding(false);
    }
  }

  return <div className="otp-page">
    <section className="otp-hero">
      <img src="/assets/specialty/otp-mat-bundle-hero-v1.png" alt="Patient and clinician discussing medication treatment in a private outpatient setting" />
      <div className="otp-hero-overlay" />
      <div className="otp-hero-copy">
        <span className="specialty-eyebrow"><HeartHandshake size={15} /> OTP / MOUD coding & billing</span>
        <h1>Patient-centered treatment.<br /><em>Defensible billing.</em></h1>
        <p>Assemble Medicare opioid treatment program bundles, take-home supply, recovery supports, telecom evidence, and claim context without turning clinical decisions into billing shortcuts.</p>
        <div className="otp-hero-meta"><span><BadgeCheck size={15} /> CY 2026 rules</span><span><ShieldCheck size={15} /> Human approval</span><span><Database size={15} /> CMS + SAMHSA</span></div>
      </div>
      <div className="otp-version">Engine {OTP_ENGINE_VERSION}</div>
    </section>

    <div className="otp-workspace-grid">
      <div className="otp-input-column">
        <section className="otp-panel tool-panel">
          <div className="otp-panel-heading"><div><span>01</span><h2>Episode and claim identity</h2></div><ReceiptText size={20} /></div>
          <div className="otp-form-grid three">
            <Field label="Service date"><input type="date" value={caseInput.serviceDate} onChange={(event) => update("serviceDate", event.target.value)} /></Field>
            <Field label="Payer"><select value={caseInput.payerMode} onChange={(event) => update("payerMode", event.target.value as OtpCaseInput["payerMode"])}><option value="medicare-ffs">Medicare FFS</option><option value="medicare-advantage">Medicare Advantage</option><option value="medicaid">Medicaid</option><option value="commercial">Commercial</option><option value="self-pay">Self-pay</option></select></Field>
            <Field label="Service state"><input maxLength={2} placeholder="TX" value={stateCode} onChange={(event) => setStateCode(event.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} /></Field>
            <Field label="Claim path"><select value={caseInput.claimEntity} onChange={(event) => update("claimEntity", event.target.value as OtpCaseInput["claimEntity"])}><option value="professional">Professional · CMS-1500 / 837P</option><option value="institutional">Institutional · CMS-1450 / 837I</option></select></Field>
            <Field label="Site"><select value={caseInput.siteType} onChange={(event) => update("siteType", event.target.value as OtpCaseInput["siteType"])}><option value="freestanding">Freestanding OTP</option><option value="provider-based">Provider-based OTP</option><option value="hospital-based">Hospital-based OTP</option><option value="cah-based">CAH-based OTP</option><option value="mobile-unit">Mobile unit</option></select></Field>
            <Field label="Documented OUD diagnosis" hint="No diagnosis is inferred or repaired."><input placeholder="F11.20" value={diagnosisText} onChange={(event) => setDiagnosisText(event.target.value)} /></Field>
            <Field label="OTP organization NPI"><input inputMode="numeric" maxLength={10} value={caseInput.organizationNpi || ""} onChange={(event) => update("organizationNpi", event.target.value.replace(/\D/g, ""))} /></Field>
            <Field label="Ordering practitioner NPI"><input inputMode="numeric" maxLength={10} value={caseInput.orderingNpi || ""} onChange={(event) => update("orderingNpi", event.target.value.replace(/\D/g, ""))} /></Field>
          </div>
        </section>

        <section className="otp-panel tool-panel">
          <div className="otp-panel-heading"><div><span>02</span><h2>Program eligibility</h2></div><Building2 size={20} /></div>
          <p className="otp-section-copy">Medicare OTP payment starts with the program—not the medication. Keep effective certification, accreditation, enrollment, and state authority as separate evidence.</p>
          <div className="otp-toggle-grid">
            <Toggle checked={caseInput.program.samhsaCertified === true} onChange={(value) => updateProgram("samhsaCertified", value ? true : null)} label="SAMHSA certified" />
            <Toggle checked={caseInput.program.accredited === true} onChange={(value) => updateProgram("accredited", value ? true : null)} label="Accreditation current" />
            <Toggle checked={caseInput.program.medicareEnrolled === true} onChange={(value) => updateProgram("medicareEnrolled", value ? true : null)} label="Medicare OTP enrollment" />
            <Toggle checked={caseInput.program.deaAndStateAuthorized === true} onChange={(value) => updateProgram("deaAndStateAuthorized", value ? true : null)} label="DEA and state authority" />
          </div>
        </section>

        <section className="otp-panel tool-panel">
          <div className="otp-panel-heading"><div><span>03</span><h2>Medication and weekly bundle</h2></div><Pill size={20} /></div>
          <div className="otp-medication-grid">{MEDICATIONS.map(([value, title, detail]) => <button type="button" key={value} className={caseInput.medication === value ? "active" : ""} onClick={() => update("medication", value)}><Pill size={17} /><span><strong>{title}</strong><small>{detail}</small></span></button>)}</div>
          <div className="otp-toggle-grid">
            <Toggle checked={caseInput.drugComponentFurnished === true} onChange={(value) => update("drugComponentFurnished", value ? true : null)} label="Drug component furnished" />
            <Toggle checked={caseInput.nondrugComponentFurnished === true} onChange={(value) => update("nondrugComponentFurnished", value ? true : null)} label="Non-drug service furnished" />
            <Toggle checked={caseInput.medicationSwitchedDuringWeek === true} onChange={(value) => update("medicationSwitchedDuringWeek", value)} label="Medication switched this week" detail="Only one primary weekly bundle may release" />
          </div>
          {caseInput.medicationSwitchedDuringWeek ? <div className="otp-form-grid two"><Field label="Medication furnished most days"><select value={caseInput.medicationUsedMostOfWeek || ""} onChange={(event) => update("medicationUsedMostOfWeek", (event.target.value || null) as OtpMedication | null)}><option value="">Resolve from dosing record</option>{MEDICATIONS.slice(0, 5).map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></Field></div> : null}
          <div className="otp-live-preview"><Sparkles size={17} /><div><strong>{primaryPreview.primaryCode || "Resolve primary code"}</strong><span>{MEDICATIONS.find(([value]) => value === (caseInput.medicationUsedMostOfWeek || caseInput.medication))?.[1]} · one primary bundle only</span></div></div>
        </section>

        <section className="otp-panel tool-panel">
          <div className="otp-panel-heading"><div><span>04</span><h2>Assessments, recovery supports and supply</h2></div><Stethoscope size={20} /></div>
          <div className="otp-toggle-grid">
            <Toggle checked={caseInput.intakePerformed === true} onChange={(value) => update("intakePerformed", value)} label="Intake activities performed" />
            <Toggle checked={caseInput.periodicAssessmentPerformed === true} onChange={(value) => update("periodicAssessmentPerformed", value)} label="Periodic assessment performed" />
            <Toggle checked={caseInput.newPatient === true} onChange={(value) => update("newPatient", value ? true : null)} label="New patient" />
            <Toggle checked={caseInput.counselingBeyondBundlePlan === true} onChange={(value) => update("counselingBeyondBundlePlan", value ? true : null)} label="Counseling beyond bundle plan" />
          </div>
          <div className="otp-form-grid three">
            <Field label="Additional counseling minutes"><input type="number" min="0" step="30" value={caseInput.additionalCounselingMinutes || 0} onChange={(event) => update("additionalCounselingMinutes", Number(event.target.value) || 0)} /></Field>
            <Field label="Coordinated care minutes"><input type="number" min="0" step="30" value={caseInput.coordinatedCareMinutes || 0} onChange={(event) => update("coordinatedCareMinutes", Number(event.target.value) || 0)} /></Field>
            <Field label="Navigation minutes"><input type="number" min="0" step="30" value={caseInput.navigationMinutes || 0} onChange={(event) => update("navigationMinutes", Number(event.target.value) || 0)} /></Field>
            <Field label="Peer recovery minutes"><input type="number" min="0" step="30" value={caseInput.peerRecoveryMinutes || 0} onChange={(event) => update("peerRecoveryMinutes", Number(event.target.value) || 0)} /></Field>
            <Field label="Additional take-home days"><input type="number" min="0" max="21" value={caseInput.takeHome?.additionalDays || 0} onChange={(event) => updateTakeHome("additionalDays", Number(event.target.value) || 0)} /></Field>
            <Field label="Overdose-reversal medication"><select value={caseInput.overdoseMedication?.product || "none"} onChange={(event) => updateOverdose("product", event.target.value)}><option value="none">None</option><option value="g2215-nasal">Nasal naloxone · G2215</option><option value="g1028-nasal-8mg">8 mg nasal naloxone 2-pack · G1028</option><option value="g2216-injectable">Injectable naloxone · G2216</option><option value="g0532-nalmefene">Nasal nalmefene · G0532</option></select></Field>
          </div>
          {(caseInput.takeHome?.additionalDays || 0) > 0 ? <div className="otp-toggle-grid"><Toggle checked={caseInput.takeHome?.noOverlapWithBundleDates === true} onChange={(value) => updateTakeHome("noOverlapWithBundleDates", value ? true : null)} label="No overlap with weekly bundle dates" /><Toggle checked={caseInput.takeHome?.practitionerAuthorized === true} onChange={(value) => updateTakeHome("practitionerAuthorized", value ? true : null)} label="Practitioner authorization documented" detail="Clinical decision—not calculated by billing units" /></div> : null}
          <div className="otp-iop-box">
            <div><strong>Intensive outpatient pathway · G0137</strong><p>Nine qualifying, non-duplicated services over seven contiguous days, with practitioner certification.</p></div>
            <Toggle checked={caseInput.intensiveOutpatient?.requested === true} onChange={(value) => setCaseInput((current) => ({ ...current, intensiveOutpatient: { requested: value, practitionerCertified: current.intensiveOutpatient?.practitionerCertified ?? null, services: current.intensiveOutpatient?.services || [] } }))} label="Evaluate IOP bundle" />
            {caseInput.intensiveOutpatient?.requested ? <div className="otp-form-grid two"><Field label="Eligible service count" hint="Do not include services counted toward another bundle/add-on."><input type="number" min="0" max="30" value={caseInput.intensiveOutpatient.services.length} onChange={(event) => setIopServiceCount(Number(event.target.value) || 0)} /></Field><Toggle checked={caseInput.intensiveOutpatient.practitionerCertified === true} onChange={(value) => setCaseInput((current) => ({ ...current, intensiveOutpatient: { requested: true, practitionerCertified: value ? true : null, services: current.intensiveOutpatient?.services || [] } }))} label="P/NPP certification documented" /></div> : null}
          </div>
        </section>

        <section className="otp-panel tool-panel">
          <div className="otp-panel-heading"><div><span>05</span><h2>Telecom and special situations</h2></div><Video size={20} /></div>
          <div className="otp-form-grid three">
            <Field label="Delivery mode"><select value={caseInput.telecom?.mode || "none"} onChange={(event) => updateTelecom("mode", event.target.value)}><option value="none">In person / no telecom</option><option value="audio-video">Audio-video</option><option value="audio-only">Audio-only</option></select></Field>
            <Field label="Telecom service"><select value={caseInput.telecom?.service || "none"} onChange={(event) => updateTelecom("service", event.target.value)}><option value="none">None</option><option value="intake">Intake · G2076</option><option value="periodic-assessment">Periodic assessment · G2077</option><option value="additional-counseling">Additional counseling · G2080</option></select></Field>
            <Field label="Locality adjustment" hint="Non-drug component only; leave blank for national values."><input type="number" min="0" step="0.001" placeholder="1.000" value={caseInput.localityAdjustment || ""} onChange={(event) => update("localityAdjustment", Number(event.target.value) || null)} /></Field>
          </div>
          {caseInput.telecom?.mode !== "none" ? <div className="otp-toggle-grid">
            <Toggle checked={caseInput.telecom?.federalStateRequirementsMet === true} onChange={(value) => updateTelecom("federalStateRequirementsMet", value ? true : null)} label="Federal and state requirements verified" />
            {caseInput.telecom?.mode === "audio-only" ? <>
              <Toggle checked={caseInput.telecom?.audioVideoUnavailable === true} onChange={(value) => updateTelecom("audioVideoUnavailable", value ? true : null)} label="Audio-video unavailable / infeasible" />
              {caseInput.medication === "methadone" && caseInput.telecom?.service === "intake" ? <Toggle checked={caseInput.telecom?.patientWithDeaPractitioner === true} onChange={(value) => updateTelecom("patientWithDeaPractitioner", value ? true : null)} label="Patient physically with DEA practitioner" /> : null}
            </> : null}
          </div> : null}
          <div className="otp-claim-note"><Info size={16} /><span>Medicare professional OTP telecom claims keep <strong>POS 58</strong>; the eligible service line receives modifier <strong>95</strong> or <strong>93</strong>. POS 02/10 is not substituted.</span></div>
          <Toggle checked={caseInput.duplicateBundle?.detected === true} onChange={(value) => updateDuplicate("detected", value)} label="Another 7-day bundle was detected" />
          {caseInput.duplicateBundle?.detected ? <><div className="otp-form-grid two"><Field label="Limited exception"><select value={caseInput.duplicateBundle.reason} onChange={(event) => updateDuplicate("reason", event.target.value)}><option value="none">Resolve overlap</option><option value="guest-dosing">Guest dosing</option><option value="transfer">Transfer between OTPs</option><option value="holiday-sync">Holiday / schedule synchronization</option><option value="other">Other</option></select></Field></div><div className="otp-toggle-grid"><Toggle checked={caseInput.duplicateBundle.recordsExchanged === true} onChange={(value) => updateDuplicate("recordsExchanged", value ? true : null)} label="Records exchanged" /><Toggle checked={caseInput.duplicateBundle.modifier59Supported === true} onChange={(value) => updateDuplicate("modifier59Supported", value ? true : null)} label="Modifier 59 exception documented" /></div></> : null}
        </section>

        <section className="otp-panel tool-panel">
          <div className="otp-panel-heading"><div><span>06</span><h2>Document evidence</h2></div><FileUp size={20} /></div>
          <button type="button" className="otp-upload" disabled={documentBusy} onClick={() => fileRef.current?.click()}>{documentBusy ? <Loader2 className="spin" size={22} /> : <FileText size={22} />}<span><strong>{documentBusy ? "Processing documents…" : "Upload treatment plan, dosing, assessment, or service records"}</strong><small>PDF, PNG, JPEG or TXT · source-page verification remains mandatory</small></span><ChevronRight size={18} /></button>
          <input ref={fileRef} hidden multiple type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain" onChange={(event) => uploadDocuments(event.target.files)} />
          {documentError ? <div className="otp-alert danger"><AlertTriangle size={16} />{documentError}</div> : null}
          {documents.length ? <div className="otp-documents">{documents.map((doc) => <article key={doc.fileName}><FileText size={18} /><div><strong>{doc.fileName}</strong><span>{doc.documentType.replace(/-/g, " ")} · {doc.extractionMethod.replace(/_/g, " ")}</span>{doc.requiresManualReview ? <small>Manual source-page verification required</small> : null}</div></article>)}</div> : null}
        </section>
      </div>

      <aside className="otp-results-column">
        <section className="otp-panel otp-build-card tool-panel">
          <span className="specialty-eyebrow"><ClipboardCheck size={14} /> Auditable decision set</span>
          <h2>Build billing worksheet</h2>
          <p>Resolve eligibility, one primary bundle, add-ons, telecommunications, claim context, and payment independently.</p>
          <button type="button" className="otp-build-button" onClick={buildWorksheet} disabled={building}>{building ? <Loader2 className="spin" size={18} /> : <ShieldCheck size={18} />}{building ? "Evaluating evidence…" : "Build OTP billing worksheet"}</button>
          {serverNotice ? <div className="otp-alert"><Info size={15} />{serverNotice}</div> : null}
        </section>
        {result ? <>
          <section className="otp-domain-list">{result.domains.map((item) => <DomainCard result={item} key={item.domain} />)}</section>
          <section className="otp-panel tool-panel">
            <div className="otp-panel-heading compact"><div><h2>Claim lines</h2></div><ReceiptText size={19} /></div>
            <div className="otp-claim-context"><span>{result.claimFormat}</span>{Object.entries(result.claimContext).map(([key, value]) => <span key={key}>{key.replace(/([A-Z])/g, " $1")}: <strong>{value}</strong></span>)}</div>
            <div className="otp-lines">{result.lines.length ? result.lines.map((line, index) => <article key={`${line.hcpcs}-${index}`}><div><strong>{line.hcpcs}{line.modifier ? `-${line.modifier}` : ""}</strong><span>{line.description}</span></div><div><strong>{line.units} unit{line.units === 1 ? "" : "s"}</strong><span>{money(line.estimatedAmountCents)}</span></div></article>) : <p>No releasable claim lines. Resolve the holds above.</p>}</div>
            <div className="otp-payment-total"><span>Estimated reference total</span><strong>{money(result.payment.estimatedTotalCents)}</strong><small>{result.payment.localityApplied ? "Locality factor applied to non-drug components" : "National CMS amounts; locality not applied"}</small></div>
            <p className="otp-human-gate"><ShieldCheck size={15} /> Human coder approval remains mandatory. Export and autonomous claim submission are disabled.</p>
          </section>
        </> : <section className="otp-empty tool-panel"><HeartHandshake size={30} /><h3>Clinical care and billing stay separate</h3><p>Complete the episode evidence to see each CMS gate, claim line, and payment limitation without using billing logic to authorize treatment.</p></section>}
      </aside>
    </div>
  </div>;
}

export default OtpMatWorkspace;
