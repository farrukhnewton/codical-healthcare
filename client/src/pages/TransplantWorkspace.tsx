import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Building2, CheckCircle2, ChevronRight, ClipboardCheck, Database,
  FileText, FileUp, HeartPulse, Info, Loader2, Network, Pill, ReceiptText, ShieldCheck, Stethoscope,
} from "lucide-react";
import {
  TRANSPLANT_ENGINE_VERSION,
  evaluateTransplantCase,
  type ProgramApprovalRecord,
  type TransplantCaseInput,
  type TransplantDomainResult,
  type TransplantEvaluation,
  type TransplantOrgan,
  type TransplantStatus,
} from "../../../shared/transplant-coding";

const TODAY = new Date().toISOString().slice(0, 10);
const ORGANS: Array<[TransplantOrgan, string]> = [
  ["kidney", "Kidney"], ["liver", "Liver"], ["heart", "Heart"], ["lung", "Lung"],
  ["heart-lung", "Heart-lung"], ["pancreas", "Pancreas"], ["intestine", "Intestine"],
  ["multivisceral", "Multivisceral"], ["combined", "Other combined-organ"],
];

const initialCase: TransplantCaseInput = {
  serviceDate: TODAY,
  organ: "kidney",
  ageCategory: "adult",
  payerMode: "medicare-ffs",
  purpose: "transplant",
  diagnosisCodes: [],
  programApprovals: [],
  clinical: {
    endStageOrganFailure: null,
    transplantIndicationDocumented: null,
    wholeOrganTransplant: null,
    pancreasPath: "unknown",
    insulinDependentDiabetes: null,
    betaCellFailureDocumented: null,
    medicallyUncontrollableHyperglycemia: null,
    secondaryComplications: null,
    irreversibleIntestinalFailure: null,
    failedParenteralNutrition: null,
    lifeThreateningParenteralNutritionComplication: null,
    originalTransplantCovered: null,
    followUpIndependentlyReasonableNecessary: null,
  },
  operative: { finalOperativeReport: false, organImplanted: false, backbenchDocumented: false, reconstructionDocumented: false },
  acquisition: { costItems: [], sacReconciled: null },
  donor: undefined,
  drug: undefined,
};

type UploadedDocument = {
  fileName: string;
  documentType: string;
  pageCount: number | null;
  extractionMethod: string;
  requiresManualReview: boolean;
  textPreview: string;
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

function diagnosisList(value: string) {
  return Array.from(new Set(value.split(/[,;\n\s]+/).map((code) => code.trim().toUpperCase()).filter(Boolean)));
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="transplant-field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}

function Toggle({ checked, onChange, label, detail }: { checked: boolean; onChange: (value: boolean) => void; label: string; detail?: string }) {
  return <label className={`transplant-toggle${checked ? " active" : ""}`}>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    <span className="transplant-toggle-check">{checked ? <CheckCircle2 size={15} /> : null}</span>
    <span><strong>{label}</strong>{detail ? <small>{detail}</small> : null}</span>
  </label>;
}

function StatusPill({ status }: { status: TransplantStatus }) {
  return <span className={`transplant-status status-${status}`}>{status.replace("not-applicable", "n/a")}</span>;
}

function DomainCard({ result }: { result: TransplantDomainResult }) {
  return <article className={`transplant-domain domain-${result.status}`}>
    <header><strong>{result.title}</strong><StatusPill status={result.status} /></header>
    {result.reasons.slice(0, 2).map((reason) => <p className="reason" key={reason}><CheckCircle2 size={14} />{reason}</p>)}
    {result.blockers.slice(0, 3).map((blocker) => <p className="blocker" key={blocker}><AlertTriangle size={14} />{blocker}</p>)}
    {result.sourceIds.length ? <footer><Database size={12} />{result.sourceIds.join(" · ")}</footer> : null}
  </article>;
}

export function TransplantWorkspace() {
  const [caseInput, setCaseInput] = useState<TransplantCaseInput>(initialCase);
  const [diagnosisText, setDiagnosisText] = useState("");
  const [approvedOrgans, setApprovedOrgans] = useState<TransplantOrgan[]>([]);
  const [result, setResult] = useState<TransplantEvaluation | null>(null);
  const [building, setBuilding] = useState(false);
  const [serverNotice, setServerNotice] = useState<string | null>(null);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof TransplantCaseInput>(key: K, value: TransplantCaseInput[K]) => setCaseInput((current) => ({ ...current, [key]: value }));
  const updateClinical = (key: keyof NonNullable<TransplantCaseInput["clinical"]>, value: unknown) => setCaseInput((current) => ({ ...current, clinical: { ...current.clinical, [key]: value } }));
  const updateOperative = (key: keyof NonNullable<TransplantCaseInput["operative"]>, value: unknown) => setCaseInput((current) => ({ ...current, operative: { ...current.operative, [key]: value } }));
  const updateDonor = (key: keyof NonNullable<TransplantCaseInput["donor"]>, value: unknown) => setCaseInput((current) => ({ ...current, donor: { ...current.donor, [key]: value } }));
  const updateDrug = (key: keyof NonNullable<TransplantCaseInput["drug"]>, value: unknown) => setCaseInput((current) => ({ ...current, drug: { ...current.drug, [key]: value } }));

  const requiredPrograms = useMemo<TransplantOrgan[]>(() => {
    const prereqs: Partial<Record<TransplantOrgan, TransplantOrgan[]>> = { pancreas: ["kidney"], intestine: ["liver"], multivisceral: ["liver"], "heart-lung": ["heart", "lung"] };
    return Array.from(new Set([caseInput.organ, ...(prereqs[caseInput.organ] || [])]));
  }, [caseInput.organ]);

  function toggleProgram(organ: TransplantOrgan, enabled: boolean) {
    setApprovedOrgans((current) => enabled ? Array.from(new Set([...current, organ])) : current.filter((value) => value !== organ));
  }

  async function uploadDocuments(files: FileList | null) {
    if (!files?.length) return;
    setDocumentBusy(true);
    setDocumentError(null);
    try {
      const body = new FormData();
      Array.from(files).slice(0, 8).forEach((file) => body.append("documents", file));
      const payload = await authenticatedFetch("/api/transplant/documents/extract", { method: "POST", body });
      setDocuments(payload.documents || []);
    } catch (error: any) {
      setDocumentError(error?.message || "Document processing failed.");
    } finally {
      setDocumentBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function buildWorksheet() {
    setBuilding(true);
    setServerNotice(null);
    const programApprovals: ProgramApprovalRecord[] = approvedOrgans.map((organ) => ({
      organ,
      ageCategory: caseInput.ageCategory,
      effectiveFrom: "2026-01-01",
      status: "approved",
      source: "pecos",
      ccn: caseInput.facilityCcn,
    }));
    const reviewed: TransplantCaseInput = { ...caseInput, diagnosisCodes: diagnosisList(diagnosisText), programApprovals };
    const local = evaluateTransplantCase(reviewed);
    setResult(local);
    try {
      const remote = await authenticatedFetch("/api/transplant/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseInput: reviewed }),
      });
      setResult(remote.evaluation);
    } catch (error: any) {
      setServerNotice(`The deterministic worksheet was built locally. Server evidence was unavailable: ${error?.message || "network error"}`);
    } finally {
      setBuilding(false);
    }
  }

  const applicableDomains = result ? [result.program, result.coverage, result.professional, result.facility, result.acquisition, result.donor, result.drug, result.claimReadiness] : [];

  return <div className="transplant-page specialty-page">
    <header className="transplant-hero tool-panel">
      <img src="/assets/specialty/transplant-lifecycle-hero-v1.png" alt="Transplant care team coordinating a complex hospital workflow" />
      <div className="transplant-hero-overlay" />
      <div className="transplant-hero-copy">
        <span className="specialty-eyebrow"><HeartPulse size={15} /> Organ transplant lifecycle coding</span>
        <h1>One episode. Eight decisions. No hidden assumptions.</h1>
        <p>Coordinate program approval, coverage, professional and facility coding, acquisition, donor billing, drug benefits, and claim readiness without collapsing their rules.</p>
        <div className="transplant-hero-tags"><span><ShieldCheck size={14} /> Human approval required</span><span><Network size={14} /> PECOS-aware</span><span>Engine {TRANSPLANT_ENGINE_VERSION}</span></div>
      </div>
    </header>

    <section className="transplant-safety-strip"><Info size={17} /><span>This workspace creates auditable candidates only. It does not infer diagnoses, reproduce unlicensed CPT content, determine final coverage, or submit claims.</span></section>

    <div className="transplant-workspace-grid">
      <div className="transplant-evidence-column">
        <section className="transplant-panel tool-panel">
          <div className="transplant-panel-heading"><div><span>01</span><h2>Episode and program record</h2></div><Building2 size={20} /></div>
          <div className="transplant-form-grid three">
            <Field label="Date of service"><input type="date" value={caseInput.serviceDate} onChange={(event) => update("serviceDate", event.target.value)} /></Field>
            <Field label="Episode purpose"><select value={caseInput.purpose} onChange={(event) => update("purpose", event.target.value as TransplantCaseInput["purpose"])}><option value="transplant">Transplant procedure</option><option value="follow-up">Post-transplant follow-up</option><option value="donor">Donor service / complication</option><option value="organ-acquisition">Organ acquisition</option><option value="immunosuppressive-drug">Immunosuppressive drug</option></select></Field>
            <Field label="Organ"><select value={caseInput.organ} onChange={(event) => update("organ", event.target.value as TransplantOrgan)}>{ORGANS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>
            <Field label="Program category"><select value={caseInput.ageCategory} onChange={(event) => update("ageCategory", event.target.value as TransplantCaseInput["ageCategory"])}><option value="adult">Adult</option><option value="pediatric">Pediatric</option></select></Field>
            <Field label="Payer"><select value={caseInput.payerMode} onChange={(event) => update("payerMode", event.target.value as TransplantCaseInput["payerMode"])}><option value="medicare-ffs">Medicare FFS</option><option value="medicare-advantage">Medicare Advantage</option><option value="medicaid">Medicaid</option><option value="commercial">Commercial</option><option value="self-pay">Self-pay</option></select></Field>
            <Field label="Billing facility CCN" hint="Compared with the historical program record"><input value={caseInput.facilityCcn || ""} onChange={(event) => update("facilityCcn", event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6 digits" /></Field>
          </div>
          {caseInput.purpose === "transplant" ? <div className="transplant-program-box"><strong>PECOS approvals effective on date of service</strong><p>Confirm the exact organ and each prerequisite; hospital-level approval alone is not enough.</p><div className="transplant-toggle-grid">{requiredPrograms.map((organ) => <Toggle key={organ} checked={approvedOrgans.includes(organ)} onChange={(value) => toggleProgram(organ, value)} label={`${ORGAN_LABEL(organ)} program verified`} detail={organ === caseInput.organ ? `${caseInput.ageCategory} exact-organ record` : "Required prerequisite program"} />)}</div></div> : null}
        </section>

        <section className="transplant-panel tool-panel">
          <div className="transplant-panel-heading"><div><span>02</span><h2>Clinical and coverage evidence</h2></div><Stethoscope size={20} /></div>
          <div className="transplant-toggle-grid">
            <Toggle checked={caseInput.clinical?.endStageOrganFailure === true} onChange={(value) => updateClinical("endStageOrganFailure", value ? true : null)} label="End-stage organ failure documented" />
            <Toggle checked={caseInput.clinical?.transplantIndicationDocumented === true} onChange={(value) => updateClinical("transplantIndicationDocumented", value ? true : null)} label="Transplant indication documented" />
          </div>
          {caseInput.organ === "pancreas" ? <><div className="transplant-form-grid three"><Field label="Pancreas pathway"><select value={caseInput.clinical?.pancreasPath || "unknown"} onChange={(event) => updateClinical("pancreasPath", event.target.value)}><option value="unknown">Select pathway</option><option value="spk">Simultaneous pancreas-kidney</option><option value="pak">Pancreas after kidney</option><option value="pta">Pancreas alone</option><option value="islet">Islet cell / trial review</option></select></Field></div><div className="transplant-toggle-grid"><Toggle checked={caseInput.clinical?.wholeOrganTransplant === true} onChange={(value) => updateClinical("wholeOrganTransplant", value ? true : null)} label="Whole-organ transplant" /><Toggle checked={caseInput.clinical?.insulinDependentDiabetes === true} onChange={(value) => updateClinical("insulinDependentDiabetes", value ? true : null)} label="Insulin-dependent diabetes" /><Toggle checked={caseInput.clinical?.betaCellFailureDocumented === true} onChange={(value) => updateClinical("betaCellFailureDocumented", value ? true : null)} label="Beta-cell failure documented" /><Toggle checked={caseInput.clinical?.medicallyUncontrollableHyperglycemia === true} onChange={(value) => updateClinical("medicallyUncontrollableHyperglycemia", value ? true : null)} label="Medically uncontrollable hyperglycemia" /><Toggle checked={caseInput.clinical?.secondaryComplications === true} onChange={(value) => updateClinical("secondaryComplications", value ? true : null)} label="Secondary complications documented" /></div></> : null}
          {caseInput.organ === "intestine" || caseInput.organ === "multivisceral" ? <div className="transplant-toggle-grid"><Toggle checked={caseInput.clinical?.irreversibleIntestinalFailure === true} onChange={(value) => updateClinical("irreversibleIntestinalFailure", value ? true : null)} label="Irreversible intestinal failure" /><Toggle checked={caseInput.clinical?.failedParenteralNutrition === true} onChange={(value) => updateClinical("failedParenteralNutrition", value ? true : null)} label="Parenteral nutrition failed" /><Toggle checked={caseInput.clinical?.lifeThreateningParenteralNutritionComplication === true} onChange={(value) => updateClinical("lifeThreateningParenteralNutritionComplication", value ? true : null)} label="Life-threatening PN complication" /></div> : null}
          {caseInput.purpose === "follow-up" ? <div className="transplant-toggle-grid"><Toggle checked={caseInput.clinical?.originalTransplantCovered === true} onChange={(value) => updateClinical("originalTransplantCovered", value ? true : null)} label="Original transplant was covered" /><Toggle checked={caseInput.clinical?.followUpIndependentlyReasonableNecessary === true} onChange={(value) => updateClinical("followUpIndependentlyReasonableNecessary", value ? true : null)} label="Follow-up independently reasonable and necessary" /></div> : null}
          <Field label="Source-supported ICD-10-CM diagnoses" hint="The engine validates shape only and never invents rejection or complication diagnoses."><textarea rows={3} value={diagnosisText} onChange={(event) => setDiagnosisText(event.target.value)} placeholder="Example: N18.6, Z94.0" /></Field>
        </section>

        <section className="transplant-panel tool-panel">
          <div className="transplant-panel-heading"><div><span>03</span><h2>Operative, inpatient, acquisition, and donor facts</h2></div><ReceiptText size={20} /></div>
          <div className="transplant-toggle-grid"><Toggle checked={Boolean(caseInput.operative?.finalOperativeReport)} onChange={(value) => updateOperative("finalOperativeReport", value)} label="Final signed operative report" /><Toggle checked={Boolean(caseInput.operative?.organImplanted)} onChange={(value) => updateOperative("organImplanted", value)} label="Implantation confirmed" /><Toggle checked={Boolean(caseInput.operative?.backbenchDocumented)} onChange={(value) => updateOperative("backbenchDocumented", value)} label="Backbench work documented" /><Toggle checked={Boolean(caseInput.operative?.reconstructionDocumented)} onChange={(value) => updateOperative("reconstructionDocumented", value)} label="Reconstruction documented" /></div>
          <div className="transplant-form-grid three"><Field label="Licensed professional code" hint="Optional adapter output; no descriptor is stored"><input value={caseInput.operative?.licensedProfessionalCode || ""} onChange={(event) => updateOperative("licensedProfessionalCode", event.target.value.trim())} placeholder="Licensed adapter" /></Field><Field label="ICD-10-PCS candidate"><input value={caseInput.operative?.icd10PcsCode || ""} onChange={(event) => updateOperative("icd10PcsCode", event.target.value.toUpperCase())} /></Field><Field label="PCS version"><input value={caseInput.operative?.icd10PcsVersion || ""} onChange={(event) => updateOperative("icd10PcsVersion", event.target.value)} placeholder="FY2026" /></Field><Field label="Discharge date"><input type="date" value={caseInput.operative?.dischargeDate || ""} onChange={(event) => updateOperative("dischargeDate", event.target.value)} /></Field><Field label="MS-DRG/MCE grouper"><input value={caseInput.operative?.msDrgGrouperVersion || ""} onChange={(event) => updateOperative("msDrgGrouperVersion", event.target.value)} placeholder="FY2026 v43" /></Field></div>
          <div className="transplant-subpanel"><strong>Acquisition ledger</strong><div className="transplant-toggle-grid"><Toggle checked={caseInput.acquisition?.sacReconciled === true} onChange={(value) => setCaseInput((current) => ({ ...current, acquisition: { ...current.acquisition, sacReconciled: value ? true : null, costItems: current.acquisition?.costItems || [] } }))} label="Organ-specific SAC reconciled" detail="Kept separate from billed transplant services" /></div><button type="button" className="transplant-inline-action" onClick={() => setCaseInput((current) => ({ ...current, acquisition: { sacReconciled: current.acquisition?.sacReconciled, costItems: [{ id: "reviewed-ledger", description: "Reviewed direct organ-acquisition ledger", amountCents: 0, category: "direct-organ", organ: current.organ, sourcePointer: "manual-review" }] } }))}><ReceiptText size={15} /> Mark reviewed ledger present</button></div>
        </section>

        {caseInput.purpose === "donor" ? <section className="transplant-panel tool-panel">
          <div className="transplant-panel-heading"><div><span>04</span><h2>Donor billing and linkage</h2></div><Network size={20} /></div>
          <div className="transplant-form-grid two"><Field label="Donor pathway"><select value={caseInput.donor?.donorType || "living"} onChange={(event) => updateDonor("donorType", event.target.value)}><option value="living">Living donor</option><option value="deceased">Deceased donor</option><option value="paired-exchange">Paired exchange</option></select></Field><Field label="Donated organ"><select value={caseInput.donor?.organ || caseInput.organ} onChange={(event) => updateDonor("organ", event.target.value)}>{ORGANS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field></div>
          <div className="transplant-toggle-grid"><Toggle checked={caseInput.donor?.recipientAccountLinked === true} onChange={(value) => updateDonor("recipientAccountLinked", value ? true : null)} label="Recipient acquisition account linked" /><Toggle checked={caseInput.donor?.kidneyComplication === true} onChange={(value) => updateDonor("kidneyComplication", value)} label="Kidney donor complication workflow" /><Toggle checked={caseInput.donor?.occurrenceCode36 === true} onChange={(value) => updateDonor("occurrenceCode36", value)} label="Occurrence code 36 supported" /><Toggle checked={caseInput.donor?.patientRelationship39 === true} onChange={(value) => updateDonor("patientRelationship39", value)} label="Patient relationship 39 supported" />{caseInput.donor?.donorType === "paired-exchange" ? <Toggle checked={caseInput.donor?.pairedExchangeReconciled === true} onChange={(value) => updateDonor("pairedExchangeReconciled", value ? true : null)} label="Paired-exchange accounts reconciled" /> : null}</div>
        </section> : null}

        {caseInput.purpose === "immunosuppressive-drug" ? <section className="transplant-panel tool-panel">
          <div className="transplant-panel-heading"><div><span>04</span><h2>Immunosuppressive drug benefit</h2></div><Pill size={20} /></div>
          <div className="transplant-form-grid three"><Field label="Benefit pathway"><select value={caseInput.drug?.pathway || "other"} onChange={(event) => updateDrug("pathway", event.target.value)}><option value="other">Select / other</option><option value="ordinary-part-b">Ordinary Part B</option><option value="part-b-id">Part B-ID</option><option value="part-d">Part D</option></select></Field><Field label="Days supply"><input type="number" min="1" value={caseInput.drug?.daysSupply || ""} onChange={(event) => updateDrug("daysSupply", Number(event.target.value) || null)} /></Field><Field label="Supply sequence"><select value={caseInput.drug?.refillSequence || ""} onChange={(event) => updateDrug("refillSequence", event.target.value || null)}><option value="">Select</option><option value="initial">Initial</option><option value="subsequent">Subsequent</option><option value="replacement">Replacement</option></select></Field></div>
          <div className="transplant-toggle-grid"><Toggle checked={caseInput.drug?.medicationDocumentedAsImmunosuppressive === true} onChange={(value) => updateDrug("medicationDocumentedAsImmunosuppressive", value ? true : null)} label="Continuous immunosuppressive therapy documented" />{caseInput.drug?.pathway === "part-b-id" ? <><Toggle checked={caseInput.drug?.kidneyTransplant === true} onChange={(value) => updateDrug("kidneyTransplant", value ? true : null)} label="Qualifying kidney transplant" /><Toggle checked={caseInput.drug?.medicareEntitlementEndedAfter36Months === true} onChange={(value) => updateDrug("medicareEntitlementEndedAfter36Months", value ? true : null)} label="ESRD Medicare ended after 36 months" /><Toggle checked={caseInput.drug?.noDisqualifyingCoverage === true} onChange={(value) => updateDrug("noDisqualifyingCoverage", value ? true : null)} label="No disqualifying other coverage" /><Toggle checked={caseInput.drug?.partBidEnrolled === true} onChange={(value) => updateDrug("partBidEnrolled", value ? true : null)} label="Part B-ID enrollment verified" /></> : null}</div>
        </section> : null}

        <section className="transplant-panel tool-panel">
          <div className="transplant-panel-heading"><div><span>05</span><h2>Document evidence</h2></div><FileUp size={20} /></div>
          <button type="button" className="transplant-upload" disabled={documentBusy} onClick={() => fileRef.current?.click()}>{documentBusy ? <Loader2 className="spin" size={22} /> : <FileText size={22} />}<span><strong>{documentBusy ? "Processing documents…" : "Upload operative, discharge, donor, cost, or pharmacy records"}</strong><small>PDF, PNG, JPEG, or TXT · native text first · scanned content held for approved OCR and manual verification</small></span><ChevronRight size={18} /></button>
          <input ref={fileRef} hidden multiple type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain" onChange={(event) => uploadDocuments(event.target.files)} />
          {documentError ? <div className="transplant-alert danger"><AlertTriangle size={16} />{documentError}</div> : null}
          {documents.length ? <div className="transplant-documents">{documents.map((doc) => <article key={doc.fileName}><FileText size={18} /><div><strong>{doc.fileName}</strong><span>{doc.documentType.replace(/-/g, " ")} · {doc.extractionMethod.replace(/_/g, " ")}</span>{doc.requiresManualReview ? <small>Manual source-page verification required</small> : null}</div></article>)}</div> : null}
        </section>
      </div>

      <aside className="transplant-results-column">
        <section className="transplant-panel transplant-build-card tool-panel">
          <span className="specialty-eyebrow"><ClipboardCheck size={14} /> Lifecycle decision set</span><h2>Build an auditable worksheet</h2><p>Every domain keeps its own reason, blocker, source lineage, and claim lane.</p>
          <button type="button" className="transplant-build-button" onClick={buildWorksheet} disabled={building}>{building ? <Loader2 className="spin" size={18} /> : <ShieldCheck size={18} />}{building ? "Evaluating gates…" : "Build transplant worksheet"}</button>
          {serverNotice ? <div className="transplant-alert"><Info size={15} />{serverNotice}</div> : null}
        </section>
        {result ? <><section className="transplant-domain-list">{applicableDomains.map((domain) => <DomainCard result={domain} key={domain.domain} />)}</section><section className="transplant-panel tool-panel"><div className="transplant-panel-heading compact"><div><h2>Claim preview lanes</h2></div><Network size={19} /></div><div className="transplant-lanes">{result.claimLanes.map((lane) => <article key={lane.lane}><header><strong>{lane.lane}</strong><StatusPill status={lane.status} /></header>{lane.lines.length ? lane.lines.map((line, index) => <p key={index}><span>{line.codeSystem}</span>{line.code || "Resolve from effective adapter"}</p>) : <small>No releasable line.</small>}</article>)}</div><p className="transplant-human-gate"><ShieldCheck size={15} /> Human coder approval remains mandatory. Export and autonomous submission are disabled.</p></section></> : <section className="transplant-empty tool-panel"><HeartPulse size={28} /><h3>Decisions remain separated</h3><p>Complete the evidence on the left to see program, coverage, coding, acquisition, donor, drug, and readiness results independently.</p></section>}
      </aside>
    </div>
  </div>;
}

function ORGAN_LABEL(organ: TransplantOrgan) {
  return ORGANS.find(([value]) => value === organ)?.[1] || organ;
}

export default TransplantWorkspace;
