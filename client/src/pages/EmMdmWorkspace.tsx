import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle, BadgeCheck, BarChart3, BookOpenCheck, BrainCircuit, CheckCircle2,
  ChevronRight, ClipboardCheck, Clock3, Database, FileSearch, FileText, FileUp,
  Info, Layers3, Loader2, ReceiptText, ShieldCheck, Sparkles, Stethoscope,
  TimerReset, UserRoundCheck,
} from "lucide-react";
import {
  EM_MDM_ENGINE_VERSION,
  evaluateEmMdmCase,
  type EmDomainResult,
  type EmLevel,
  type EmMdmCaseInput,
  type EmMdmEvaluation,
  type EmStatus,
} from "../../../shared/em-mdm-coding";

const TODAY = new Date().toISOString().slice(0, 10);
const LEVELS: EmLevel[] = ["straightforward", "low", "moderate", "high"];

const initialCase: EmMdmCaseInput = {
  serviceDate: TODAY,
  payerMode: "medicare-ffs",
  siteType: "office",
  placeOfService: "11",
  patientType: "unknown",
  priorProfessionalServiceWithin3Years: null,
  sameGroupAndExactSpecialty: null,
  patientStatusVerified: null,
  selectionBasis: "mdm",
  diagnosisCodes: [],
  billingNpi: "",
  medicallyAppropriateHistoryExam: null,
  serviceMedicallyNecessary: null,
  currentCptEditionVerified: null,
  problems: { minorSelfLimited: 0, stableChronic: 0, acuteUncomplicated: 0, stableAcute: 0, chronicExacerbation: 0, undiagnosedUncertainPrognosis: 0, acuteSystemicSymptoms: 0, acuteComplicatedInjury: 0, chronicSevereExacerbation: 0, threatToLifeOrBodilyFunction: 0, clinicianCharacterizationVerified: null },
  data: { externalNoteSourceIds: [], tests: [], independentHistorianRequired: false, independentHistorianReasonDocumented: null, independentInterpretationPerformed: false, interpretationSeparatelyReported: false, externalDiscussionPerformed: false, externalDiscussionPartnerDocumented: null },
  risk: { minimalManagement: false, otcMedicationManagement: false, minorProcedureWithoutRiskFactors: false, physicalOrOccupationalTherapy: false, ivFluidsWithoutAdditives: false, prescriptionDrugManagement: false, minorProcedureWithRiskFactors: false, electiveMajorSurgeryWithoutRiskFactors: false, diagnosisOrTreatmentLimitedBySdoh: false, intensiveDrugToxicityMonitoring: false, electiveMajorSurgeryWithRiskFactors: false, emergencyMajorSurgery: false, hospitalizationOrEscalation: false, deescalationBecausePoorPrognosis: false, parenteralControlledSubstance: false, managementDecisionDocumented: null },
  time: { totalQhpMinutes: 0, separatelyReportedServiceMinutes: 0, overlappingTeamMinutes: 0, clinicalStaffMinutesIncluded: 0, totalTimeDocumented: null, dateOfServiceOnly: null },
  sameDay: { serviceType: "none", procedureGlobalDays: "none", significantSeparateEmDocumented: null, decisionForMajorSurgeryDocumented: null },
  g2211: { requested: false, longitudinalRelationship: "none", relationshipDocumented: null },
};

type UploadedDocument = { fileName: string; documentType: string; extractionMethod: string; requiresManualReview: boolean; candidateFlags?: Record<string, boolean>; warnings: string[] };

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
const pretty = (value: string) => value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="em-field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}

function Toggle({ checked, onChange, label, detail }: { checked: boolean; onChange: (value: boolean) => void; label: string; detail?: string }) {
  return <label className={`em-toggle${checked ? " active" : ""}`}>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    <span className="em-toggle-check">{checked ? <CheckCircle2 size={15} /> : null}</span>
    <span><strong>{label}</strong>{detail ? <small>{detail}</small> : null}</span>
  </label>;
}

function CountField({ label, value, onChange, tier }: { label: string; value: number; onChange: (value: number) => void; tier: EmLevel }) {
  return <div className={`em-count-field tier-${tier}`}><div><span>{label}</span><small>{pretty(tier)}</small></div><div><button type="button" onClick={() => onChange(Math.max(0, value - 1))}>−</button><strong>{value}</strong><button type="button" onClick={() => onChange(Math.min(9, value + 1))}>+</button></div></div>;
}

function StatusPill({ status }: { status: EmStatus }) {
  return <span className={`em-status status-${status}`}>{status.replace("not-applicable", "n/a")}</span>;
}

function LevelRail({ level }: { level: EmLevel }) {
  const rank = LEVELS.indexOf(level);
  return <div className="em-level-rail">{LEVELS.map((item, index) => <span className={index <= rank ? "active" : ""} key={item}>{item.slice(0, 3)}</span>)}</div>;
}

function DomainCard({ result }: { result: EmDomainResult }) {
  return <article className={`em-domain domain-${result.status}`}>
    <header><div><strong>{result.title}</strong>{result.level ? <LevelRail level={result.level} /> : null}</div><StatusPill status={result.status} /></header>
    {result.reasons.slice(0, 2).map((reason) => <p className="reason" key={reason}><CheckCircle2 size={14} />{reason}</p>)}
    {result.blockers.slice(0, 3).map((blocker) => <p className="blocker" key={blocker}><AlertTriangle size={14} />{blocker}</p>)}
    <footer><Database size={12} />{result.sourceIds.join(" · ")}</footer>
  </article>;
}

export function EmMdmWorkspace() {
  const [caseInput, setCaseInput] = useState<EmMdmCaseInput>(initialCase);
  const [diagnosisText, setDiagnosisText] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [result, setResult] = useState<EmMdmEvaluation | null>(null);
  const [building, setBuilding] = useState(false);
  const [serverNotice, setServerNotice] = useState<string | null>(null);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof EmMdmCaseInput>(key: K, value: EmMdmCaseInput[K]) => setCaseInput((current) => ({ ...current, [key]: value }));
  const updateProblem = (key: keyof EmMdmCaseInput["problems"], value: number | boolean | null) => setCaseInput((current) => ({ ...current, problems: { ...current.problems, [key]: value } }));
  const updateData = (key: keyof EmMdmCaseInput["data"], value: unknown) => setCaseInput((current) => ({ ...current, data: { ...current.data, [key]: value } }));
  const updateRisk = (key: keyof EmMdmCaseInput["risk"], value: boolean | null) => setCaseInput((current) => ({ ...current, risk: { ...current.risk, [key]: value } }));
  const updateTime = (key: keyof EmMdmCaseInput["time"], value: number | boolean | null) => setCaseInput((current) => ({ ...current, time: { ...current.time, [key]: value } }));
  const updateSameDay = (key: keyof EmMdmCaseInput["sameDay"], value: unknown) => setCaseInput((current) => ({ ...current, sameDay: { ...current.sameDay, [key]: value } }));
  const updateG2211 = (key: keyof EmMdmCaseInput["g2211"], value: unknown) => setCaseInput((current) => ({ ...current, g2211: { ...current.g2211, [key]: value } }));

  const preview = useMemo(() => evaluateEmMdmCase({ ...caseInput, diagnosisCodes: diagnosisList(diagnosisText) }), [caseInput, diagnosisText]);

  function setExternalNoteCount(count: number) {
    updateData("externalNoteSourceIds", Array.from({ length: Math.max(0, Math.min(9, count)) }, (_, index) => `source-${index + 1}`));
  }

  function setUniqueTestCount(count: number) {
    updateData("tests", Array.from({ length: Math.max(0, Math.min(12, count)) }, (_, index) => ({ id: `test-${index + 1}`, resultReviewed: true })));
  }

  async function uploadDocuments(fileList: FileList | null) {
    if (!fileList?.length) return;
    setDocumentBusy(true);
    setDocumentError(null);
    const formData = new FormData();
    Array.from(fileList).forEach((file) => formData.append("documents", file));
    try {
      const payload = await authenticatedFetch("/api/em-mdm/documents/extract", { method: "POST", body: formData });
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
    const reviewed = { ...caseInput, diagnosisCodes: diagnosisList(diagnosisText) };
    setCaseInput(reviewed);
    setBuilding(true);
    setServerNotice(null);
    const local = evaluateEmMdmCase(reviewed);
    try {
      const payload = await authenticatedFetch("/api/em-mdm/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseInput: reviewed, stateCode }) });
      setResult(payload.evaluation);
      setServerNotice("Connected CMS/MAC evidence was checked as supporting context. It did not set or override the E/M level.");
    } catch (error: any) {
      setResult(local);
      setServerNotice(`The deterministic worksheet completed locally. Connected evidence was unavailable: ${error?.message || "network error"}`);
    } finally {
      setBuilding(false);
    }
  }

  const riskOptions: Array<[keyof EmMdmCaseInput["risk"], string, EmLevel]> = [
    ["minimalManagement", "Minimal management", "straightforward"], ["otcMedicationManagement", "OTC medication management", "low"],
    ["minorProcedureWithoutRiskFactors", "Minor procedure · no risk factors", "low"], ["physicalOrOccupationalTherapy", "PT / OT management", "low"],
    ["ivFluidsWithoutAdditives", "IV fluids · no additives", "low"], ["prescriptionDrugManagement", "Prescription drug management", "moderate"],
    ["minorProcedureWithRiskFactors", "Minor procedure · risk factors", "moderate"], ["electiveMajorSurgeryWithoutRiskFactors", "Elective major surgery · no risk factors", "moderate"],
    ["diagnosisOrTreatmentLimitedBySdoh", "Treatment significantly limited by SDOH", "moderate"], ["intensiveDrugToxicityMonitoring", "Drug therapy needing intensive toxicity monitoring", "high"],
    ["electiveMajorSurgeryWithRiskFactors", "Elective major surgery · risk factors", "high"], ["emergencyMajorSurgery", "Emergency major surgery", "high"],
    ["hospitalizationOrEscalation", "Hospitalization / escalation", "high"], ["deescalationBecausePoorPrognosis", "De-escalation due to poor prognosis", "high"],
    ["parenteralControlledSubstance", "Parenteral controlled substance", "high"],
  ];

  return <div className="em-page">
    <section className="em-hero">
      <img src="/assets/specialty/em-mdm-calculator-hero-v1.png" alt="Clinician and medical coder reviewing an outpatient encounter together" />
      <div className="em-hero-overlay" />
      <div className="em-hero-copy">
        <span className="specialty-eyebrow"><BrainCircuit size={15} /> Office / outpatient E/M intelligence</span>
        <h1>Evidence in.<br /><em>Defensible level out.</em></h1>
        <p>Compare medical decision making with reportable date-of-service time, then audit patient status, prolonged services, same-day modifiers, and longitudinal complexity without turning documentation into a point game.</p>
        <div className="em-hero-meta"><span><BadgeCheck size={15} /> May 2026 CMS</span><span><ShieldCheck size={15} /> CPT license boundary</span><span><BarChart3 size={15} /> 2 of 3 MDM</span></div>
      </div>
      <div className="em-version">Engine {EM_MDM_ENGINE_VERSION}</div>
    </section>

    <div className="em-workspace-grid">
      <div className="em-input-column">
        <section className="em-panel tool-panel">
          <div className="em-panel-heading"><div><span>01</span><h2>Encounter identity and code family</h2></div><UserRoundCheck size={20} /></div>
          <div className="em-form-grid four">
            <Field label="Service date"><input type="date" value={caseInput.serviceDate} onChange={(event) => update("serviceDate", event.target.value)} /></Field>
            <Field label="Payer"><select value={caseInput.payerMode} onChange={(event) => update("payerMode", event.target.value as EmMdmCaseInput["payerMode"])}><option value="medicare-ffs">Medicare FFS</option><option value="medicare-advantage">Medicare Advantage</option><option value="medicaid">Medicaid</option><option value="commercial">Commercial</option><option value="self-pay">Self-pay</option></select></Field>
            <Field label="Patient type"><select value={caseInput.patientType} onChange={(event) => update("patientType", event.target.value as EmMdmCaseInput["patientType"])}><option value="unknown">Verify status</option><option value="new">New patient</option><option value="established">Established patient</option></select></Field>
            <Field label="Selection basis"><select value={caseInput.selectionBasis} onChange={(event) => update("selectionBasis", event.target.value as EmMdmCaseInput["selectionBasis"])}><option value="mdm">MDM</option><option value="time">Total time</option><option value="both">Compare both</option></select></Field>
            <Field label="Site"><select value={caseInput.siteType} onChange={(event) => update("siteType", event.target.value as EmMdmCaseInput["siteType"])}><option value="office">Office</option><option value="hospital-outpatient">Hospital outpatient</option><option value="rhc">Rural Health Clinic</option><option value="fqhc">FQHC</option></select></Field>
            <Field label="Place of service"><select value={caseInput.placeOfService} onChange={(event) => update("placeOfService", event.target.value as EmMdmCaseInput["placeOfService"])}><option value="11">11 · Office</option><option value="19">19 · Off-campus outpatient hospital</option><option value="22">22 · On-campus outpatient hospital</option><option value="02">02 · Telehealth, not home</option><option value="10">10 · Telehealth, patient home</option></select></Field>
            <Field label="Service state"><input maxLength={2} placeholder="TX" value={stateCode} onChange={(event) => setStateCode(event.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} /></Field>
            <Field label="Billing practitioner NPI"><input inputMode="numeric" maxLength={10} value={caseInput.billingNpi || ""} onChange={(event) => update("billingNpi", event.target.value.replace(/\D/g, ""))} /></Field>
            <Field label="Documented diagnosis codes" hint="No diagnosis is inferred or repaired."><input placeholder="E11.9, I10" value={diagnosisText} onChange={(event) => setDiagnosisText(event.target.value)} /></Field>
          </div>
          <div className="em-toggle-grid three"><Toggle checked={caseInput.priorProfessionalServiceWithin3Years === true} onChange={(value) => update("priorProfessionalServiceWithin3Years", value ? true : false)} label="Professional service within 3 years" /><Toggle checked={caseInput.sameGroupAndExactSpecialty === true} onChange={(value) => update("sameGroupAndExactSpecialty", value ? true : false)} label="Same group + exact specialty/subspecialty" /><Toggle checked={caseInput.patientStatusVerified === true} onChange={(value) => update("patientStatusVerified", value ? true : null)} label="Patient status verified" /></div>
        </section>

        <section className="em-panel tool-panel">
          <div className="em-panel-heading"><div><span>02</span><h2>Problems actually addressed</h2></div><Stethoscope size={20} /></div>
          <p className="em-section-copy">Count only problems evaluated or treated at this encounter. The physician/QHP—not the coder—characterizes stability, progression, prognosis, and threat.</p>
          <div className="em-count-grid">
            <CountField label="Minor / self-limited" value={caseInput.problems.minorSelfLimited} onChange={(value) => updateProblem("minorSelfLimited", value)} tier="straightforward" />
            <CountField label="Stable chronic" value={caseInput.problems.stableChronic} onChange={(value) => updateProblem("stableChronic", value)} tier="low" />
            <CountField label="Acute uncomplicated" value={caseInput.problems.acuteUncomplicated} onChange={(value) => updateProblem("acuteUncomplicated", value)} tier="low" />
            <CountField label="Stable acute" value={caseInput.problems.stableAcute} onChange={(value) => updateProblem("stableAcute", value)} tier="low" />
            <CountField label="Chronic exacerbation / progression" value={caseInput.problems.chronicExacerbation} onChange={(value) => updateProblem("chronicExacerbation", value)} tier="moderate" />
            <CountField label="New problem · uncertain prognosis" value={caseInput.problems.undiagnosedUncertainPrognosis} onChange={(value) => updateProblem("undiagnosedUncertainPrognosis", value)} tier="moderate" />
            <CountField label="Acute with systemic symptoms" value={caseInput.problems.acuteSystemicSymptoms} onChange={(value) => updateProblem("acuteSystemicSymptoms", value)} tier="moderate" />
            <CountField label="Acute complicated injury" value={caseInput.problems.acuteComplicatedInjury} onChange={(value) => updateProblem("acuteComplicatedInjury", value)} tier="moderate" />
            <CountField label="Severe chronic exacerbation" value={caseInput.problems.chronicSevereExacerbation} onChange={(value) => updateProblem("chronicSevereExacerbation", value)} tier="high" />
            <CountField label="Threat to life / bodily function" value={caseInput.problems.threatToLifeOrBodilyFunction} onChange={(value) => updateProblem("threatToLifeOrBodilyFunction", value)} tier="high" />
          </div>
          <Toggle checked={caseInput.problems.clinicianCharacterizationVerified === true} onChange={(value) => updateProblem("clinicianCharacterizationVerified", value ? true : null)} label="Clinician characterization verified against the assessment and plan" />
        </section>

        <section className="em-panel tool-panel">
          <div className="em-panel-heading"><div><span>03</span><h2>Data reviewed and analyzed</h2></div><FileSearch size={20} /></div>
          <div className="em-form-grid three"><Field label="Unique external note sources"><input type="number" min="0" max="9" value={caseInput.data.externalNoteSourceIds.length} onChange={(event) => setExternalNoteCount(Number(event.target.value) || 0)} /></Field><Field label="Unique tests ordered/reviewed" hint="Order + result review of the same test count once."><input type="number" min="0" max="12" value={caseInput.data.tests.length} onChange={(event) => setUniqueTestCount(Number(event.target.value) || 0)} /></Field></div>
          <div className="em-toggle-grid">
            <Toggle checked={caseInput.data.independentHistorianRequired} onChange={(value) => updateData("independentHistorianRequired", value)} label="Independent historian required" />
            {caseInput.data.independentHistorianRequired ? <Toggle checked={caseInput.data.independentHistorianReasonDocumented === true} onChange={(value) => updateData("independentHistorianReasonDocumented", value ? true : null)} label="Reason for historian documented" /> : null}
            <Toggle checked={caseInput.data.independentInterpretationPerformed} onChange={(value) => updateData("independentInterpretationPerformed", value)} label="Independent interpretation performed" />
            {caseInput.data.independentInterpretationPerformed ? <Toggle checked={caseInput.data.interpretationSeparatelyReported} onChange={(value) => updateData("interpretationSeparatelyReported", value)} label="Interpretation separately reported" detail="If selected, it cannot also count toward MDM data" /> : null}
            <Toggle checked={caseInput.data.externalDiscussionPerformed} onChange={(value) => updateData("externalDiscussionPerformed", value)} label="External management/test discussion" />
            {caseInput.data.externalDiscussionPerformed ? <Toggle checked={caseInput.data.externalDiscussionPartnerDocumented === true} onChange={(value) => updateData("externalDiscussionPartnerDocumented", value ? true : null)} label="External discussion partner documented" /> : null}
          </div>
        </section>

        <section className="em-panel tool-panel">
          <div className="em-panel-heading"><div><span>04</span><h2>Risk of patient management</h2></div><ShieldCheck size={20} /></div>
          <p className="em-section-copy">Select the management decisions actually made. The diagnosis alone does not determine this element.</p>
          <div className="em-risk-grid">{riskOptions.map(([key, label, tier]) => <button type="button" key={key} className={`${caseInput.risk[key] ? "active" : ""} tier-${tier}`} onClick={() => updateRisk(key, !caseInput.risk[key])}><span>{pretty(tier)}</span><strong>{label}</strong>{caseInput.risk[key] ? <CheckCircle2 size={16} /> : null}</button>)}</div>
          <Toggle checked={caseInput.risk.managementDecisionDocumented === true} onChange={(value) => updateRisk("managementDecisionDocumented", value ? true : null)} label="Management decision and patient-specific risk verified in the note" />
        </section>

        <section className="em-panel tool-panel">
          <div className="em-panel-heading"><div><span>05</span><h2>Total time and prolonged services</h2></div><Clock3 size={20} /></div>
          <div className="em-form-grid four"><Field label="Total physician/QHP minutes"><input type="number" min="0" value={caseInput.time.totalQhpMinutes} onChange={(event) => updateTime("totalQhpMinutes", Number(event.target.value) || 0)} /></Field><Field label="Separate-service minutes"><input type="number" min="0" value={caseInput.time.separatelyReportedServiceMinutes} onChange={(event) => updateTime("separatelyReportedServiceMinutes", Number(event.target.value) || 0)} /></Field><Field label="Overlapping team minutes"><input type="number" min="0" value={caseInput.time.overlappingTeamMinutes} onChange={(event) => updateTime("overlappingTeamMinutes", Number(event.target.value) || 0)} /></Field><Field label="Clinical-staff minutes included"><input type="number" min="0" value={caseInput.time.clinicalStaffMinutesIncluded} onChange={(event) => updateTime("clinicalStaffMinutesIncluded", Number(event.target.value) || 0)} /></Field></div>
          <div className="em-time-summary"><TimerReset size={18} /><div><strong>{preview.reportableMinutes} reportable minutes</strong><span>After excluding separately reported, overlapping, and clinical-staff time</span></div></div>
          <div className="em-toggle-grid"><Toggle checked={caseInput.time.totalTimeDocumented === true} onChange={(value) => updateTime("totalTimeDocumented", value ? true : null)} label="Total time documented" /><Toggle checked={caseInput.time.dateOfServiceOnly === true} onChange={(value) => updateTime("dateOfServiceOnly", value ? true : null)} label="Only date-of-service work counted" /></div>
        </section>

        <section className="em-panel tool-panel">
          <div className="em-panel-heading"><div><span>06</span><h2>Same-day services and G2211</h2></div><Layers3 size={20} /></div>
          <div className="em-form-grid three"><Field label="Other same-day service"><select value={caseInput.sameDay.serviceType} onChange={(event) => updateSameDay("serviceType", event.target.value)}><option value="none">None</option><option value="minor-procedure">Minor procedure</option><option value="major-procedure">Major procedure</option><option value="preventive">Part B preventive service</option><option value="annual-wellness">Annual Wellness Visit</option><option value="vaccine-administration">Vaccine administration</option><option value="other">Other service</option></select></Field><Field label="Procedure global period"><select value={caseInput.sameDay.procedureGlobalDays} onChange={(event) => updateSameDay("procedureGlobalDays", event.target.value)}><option value="none">Not applicable</option><option value="0">0 days</option><option value="10">10 days</option><option value="90">90 days</option><option value="unknown">Verify</option></select></Field></div>
          {caseInput.sameDay.serviceType !== "none" ? <div className="em-toggle-grid"><Toggle checked={caseInput.sameDay.significantSeparateEmDocumented === true} onChange={(value) => updateSameDay("significantSeparateEmDocumented", value ? true : null)} label="Significant separately identifiable E/M documented" /><Toggle checked={caseInput.sameDay.decisionForMajorSurgeryDocumented === true} onChange={(value) => updateSameDay("decisionForMajorSurgeryDocumented", value ? true : null)} label="Decision for major surgery documented" /></div> : null}
          <Toggle checked={caseInput.g2211.requested} onChange={(value) => updateG2211("requested", value)} label="Evaluate Medicare G2211" detail="Longitudinal visit complexity—not a complexity score or automatic add-on" />
          {caseInput.g2211.requested ? <><div className="em-form-grid two"><Field label="Relationship pathway"><select value={caseInput.g2211.longitudinalRelationship} onChange={(event) => updateG2211("longitudinalRelationship", event.target.value)}><option value="none">Resolve relationship</option><option value="continuing-focal-point">Continuing focal point for care</option><option value="ongoing-serious-complex">Ongoing care for serious / complex condition</option></select></Field></div><Toggle checked={caseInput.g2211.relationshipDocumented === true} onChange={(value) => updateG2211("relationshipDocumented", value ? true : null)} label="Longitudinal relationship documented" /></> : null}
        </section>

        <section className="em-panel tool-panel">
          <div className="em-panel-heading"><div><span>07</span><h2>Claim and source safeguards</h2></div><BookOpenCheck size={20} /></div>
          <div className="em-toggle-grid three"><Toggle checked={caseInput.medicallyAppropriateHistoryExam === true} onChange={(value) => update("medicallyAppropriateHistoryExam", value ? true : null)} label="Medically appropriate history/exam" detail="Required when performed; does not set level" /><Toggle checked={caseInput.serviceMedicallyNecessary === true} onChange={(value) => update("serviceMedicallyNecessary", value ? true : null)} label="Service and level medically necessary" /><Toggle checked={caseInput.currentCptEditionVerified === true} onChange={(value) => update("currentCptEditionVerified", value ? true : null)} label="Current licensed CPT edition verified" /></div>
          <button type="button" className="em-upload" disabled={documentBusy} onClick={() => fileRef.current?.click()}>{documentBusy ? <Loader2 className="spin" size={22} /> : <FileText size={22} />}<span><strong>{documentBusy ? "Processing encounter records…" : "Upload encounter note and supporting records"}</strong><small>PDF, PNG, JPEG or TXT · OCR/search flags never auto-select MDM</small></span><ChevronRight size={18} /></button>
          <input ref={fileRef} hidden multiple type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain" onChange={(event) => uploadDocuments(event.target.files)} />
          {documentError ? <div className="em-alert danger"><AlertTriangle size={16} />{documentError}</div> : null}
          {documents.length ? <div className="em-documents">{documents.map((doc) => <article key={doc.fileName}><FileText size={18} /><div><strong>{doc.fileName}</strong><span>{pretty(doc.documentType)} · {pretty(doc.extractionMethod)}</span><small>Manual verification required · {Object.values(doc.candidateFlags || {}).filter(Boolean).length} search flag(s)</small></div></article>)}</div> : null}
        </section>
      </div>

      <aside className="em-results-column">
        <section className="em-panel em-live-card tool-panel">
          <span className="specialty-eyebrow"><Sparkles size={14} /> Live evidence model</span>
          <div className="em-matrix"><article><span>Problems</span><strong>{pretty(preview.elementLevels.problems)}</strong><LevelRail level={preview.elementLevels.problems} /></article><article><span>Data</span><strong>{pretty(preview.elementLevels.data)}</strong><LevelRail level={preview.elementLevels.data} /></article><article><span>Risk</span><strong>{pretty(preview.elementLevels.risk)}</strong><LevelRail level={preview.elementLevels.risk} /></article></div>
          <div className="em-recommendation"><span>2 of 3 MDM</span><strong>{pretty(preview.overallMdmLevel)}</strong><small>{preview.mdmPath.code || "Verify patient status and evidence"}</small></div>
        </section>
        <section className="em-panel em-build-card tool-panel">
          <span className="specialty-eyebrow"><ClipboardCheck size={14} /> Auditable decision set</span><h2>Build E/M worksheet</h2><p>Compare each supported basis and release only the path selected, documented, medically necessary, and license-verified.</p>
          <button type="button" className="em-build-button" onClick={buildWorksheet} disabled={building}>{building ? <Loader2 className="spin" size={18} /> : <ShieldCheck size={18} />}{building ? "Evaluating evidence…" : "Build E/M coding worksheet"}</button>
          {serverNotice ? <div className="em-alert"><Info size={15} />{serverNotice}</div> : null}
        </section>
        {result ? <><section className="em-path-compare"><article className={result.selectedPath?.basis === "mdm" ? "selected" : ""}><span>MDM path</span><strong>{result.mdmPath.code || "Hold"}</strong><small>{pretty(result.mdmPath.level)} · {result.mdmPath.supported ? "supported" : "review"}</small></article><article className={result.selectedPath?.basis === "time" ? "selected" : ""}><span>Time path</span><strong>{result.timePath.code || "Hold"}</strong><small>{result.reportableMinutes} min · {result.timePath.supported ? "supported" : "review"}</small></article></section><section className="em-domain-list">{result.domains.map((item) => <DomainCard result={item} key={item.domain} />)}</section><section className="em-panel tool-panel"><div className="em-panel-heading compact"><div><h2>Coder-review lines</h2></div><ReceiptText size={19} /></div><div className="em-lines">{result.claimLines.length ? result.claimLines.map((line, index) => <article key={`${line.code}-${index}`}><div><strong>{line.code}{line.modifiers.length ? `-${line.modifiers.join("-")}` : ""}</strong><span>{line.description}</span></div><div><strong>{line.units} unit{line.units === 1 ? "" : "s"}</strong><span>{line.codeSystem}</span></div></article>) : <p>No releasable line. Resolve the holds above.</p>}</div><p className="em-license-note"><BookOpenCheck size={15} /> Official CPT descriptors and the complete MDM table remain in the licensed adapter. This preview contains original paraphrases only.</p><p className="em-human-gate"><ShieldCheck size={15} /> Human coder approval is mandatory. Autonomous submission is disabled.</p></section></> : <section className="em-empty tool-panel"><BrainCircuit size={30} /><h3>Not a point calculator</h3><p>The engine evaluates distinct evidence categories, prevents double counting, and shows why each element and reporting path passes or stops.</p></section>}
      </aside>
    </div>
  </div>;
}

export default EmMdmWorkspace;
