import { useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, Ambulance, CheckCircle2, ChevronRight, ClipboardCheck,
  FileCode2, FileUp, Info, Loader2, MapPin, Route, ShieldCheck, Siren, Stethoscope,
} from "lucide-react";
import {
  ALS2_PROCEDURE_LABELS, AMBULANCE_ENGINE_VERSION, ORIGIN_DESTINATION_LABELS,
  evaluateAmbulanceCase, roundAmbulanceMileage,
  type Als2Procedure, type AmbulanceCaseInput, type AmbulanceEvaluation,
  type AmbulanceOriginDestination, type AmbulanceRurality, type AmbulanceStatus,
} from "../../../shared/ambulance-coding";

const TODAY = new Date().toISOString().slice(0, 10);
const OD_OPTIONS = Object.entries(ORIGIN_DESTINATION_LABELS) as Array<[AmbulanceOriginDestination, string]>;
const ALS2_OPTIONS = Object.entries(ALS2_PROCEDURE_LABELS) as Array<[Als2Procedure, string]>;

type NemsisResult = {
  detectedVersion: string | null;
  recordNumber: string | null;
  patientName: string | null;
  symptoms: string[];
  medications: Array<{ name: string }>;
  procedures: Array<{ name: string }>;
  validation: Array<{ severity: string; message: string }>;
};

type RemoteEvaluation = {
  evaluation: AmbulanceEvaluation;
  paymentEstimate?: { status: string; estimatedAllowed: number | null; warning: string };
  cmsEvidence?: { pairs?: unknown[] };
};

const initialCase: AmbulanceCaseInput = {
  serviceDate: TODAY,
  payerMode: "medicare-fs",
  entityType: "independent-supplier",
  provision: "direct",
  transportMode: "ground",
  responseType: "emergency",
  outcome: "transported",
  origin: "S",
  destination: "H",
  pointOfPickupZip: "",
  rurality: "unknown",
  loadedMiles: "",
  patientCount: 1,
  medicalNecessity: null,
  destinationAppropriate: null,
  nearestAppropriateFacility: null,
  diagnosisCodes: [],
  contraindicationToOtherTransport: "",
  alsAssessment: false,
  alsIntervention: false,
  medications: [],
  als2Procedures: [],
  sct: { interfacility: false, criticallyIllOrInjured: false, ongoingCareRequired: false, beyondStateParamedicScope: null },
  rsnat: { repetitive: false, scheduled: false, physicianCertificationStatement: false, priorAuthorizationStatus: "unknown" },
  air: { groundTransportInappropriate: null, rapidTransportRequired: null, distanceOrObstacleDocumented: null },
  signatureStatus: "missing",
  abnStatus: "unknown",
};

function diagnosisList(value: string) {
  return Array.from(new Set(value.split(/[,;\n\s]+/).map((code) => code.trim().toUpperCase()).filter(Boolean)));
}

async function authenticatedFetch(path: string, init: RequestInit) {
  const { supabase } = await import("@/lib/supabase");
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error("Your session expired. Sign in again and retry.");
  const response = await fetch(path, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${data.session.access_token}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `Request failed (${response.status})`);
  return payload;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="ambulance-field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}

function Toggle({ checked, onChange, label, detail }: { checked: boolean; onChange: (value: boolean) => void; label: string; detail?: string }) {
  return (
    <label className={`ambulance-toggle${checked ? " active" : ""}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="ambulance-toggle-check">{checked ? <CheckCircle2 size={15} /> : null}</span>
      <span><strong>{label}</strong>{detail ? <small>{detail}</small> : null}</span>
    </label>
  );
}

function StatusPill({ status }: { status: AmbulanceStatus }) {
  return <span className={`ambulance-status status-${status}`}>{status.replace("not-applicable", "n/a")}</span>;
}

export function AmbulanceWorkspace() {
  const [caseInput, setCaseInput] = useState<AmbulanceCaseInput>(initialCase);
  const [diagnosisText, setDiagnosisText] = useState("");
  const [ivAdministrationText, setIvAdministrationText] = useState("");
  const [result, setResult] = useState<RemoteEvaluation | null>(null);
  const [building, setBuilding] = useState(false);
  const [serverNotice, setServerNotice] = useState<string | null>(null);
  const [nemsis, setNemsis] = useState<NemsisResult | null>(null);
  const [nemsisBusy, setNemsisBusy] = useState(false);
  const [nemsisError, setNemsisError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const mileagePreview = useMemo(() => roundAmbulanceMileage(caseInput.loadedMiles), [caseInput.loadedMiles]);
  const update = <K extends keyof AmbulanceCaseInput>(key: K, value: AmbulanceCaseInput[K]) => setCaseInput((current) => ({ ...current, [key]: value }));
  const updateNested = (key: "sct" | "rsnat" | "air", field: string, value: unknown) => setCaseInput((current) => ({
    ...current,
    [key]: { ...(current[key] as Record<string, unknown>), [field]: value },
  }));

  async function importNemsis(file: File) {
    setNemsisBusy(true);
    setNemsisError(null);
    try {
      const body = new FormData();
      body.append("nemsisFile", file);
      const payload = await authenticatedFetch("/api/ambulance/nemsis/import", { method: "POST", body });
      setNemsis(payload.imported);
    } catch (error: any) {
      setNemsisError(error?.message || "NEMSIS import failed.");
    } finally {
      setNemsisBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function buildWorksheet() {
    setBuilding(true);
    setServerNotice(null);
    const reviewed: AmbulanceCaseInput = {
      ...caseInput,
      diagnosisCodes: diagnosisList(diagnosisText),
      medications: ivAdministrationText.split(/\n+/).map((value) => value.trim()).filter(Boolean).slice(0, 12).map((medication) => ({
        medication,
        route: "iv-push" as const,
        documented: true,
        standardProtocolDose: true,
        splitDose: false,
      })),
    };
    const local = evaluateAmbulanceCase(reviewed);
    setResult({ evaluation: local, paymentEstimate: { status: "unavailable", estimatedAllowed: null, warning: "A versioned CMS locality rate is required for an estimate." } });
    try {
      const remote = await authenticatedFetch("/api/ambulance/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseInput: reviewed }),
      });
      setResult(remote);
    } catch (error: any) {
      setServerNotice(`The deterministic worksheet was built locally. CMS evidence lookup was unavailable: ${error?.message || "network error"}`);
    } finally {
      setBuilding(false);
    }
  }

  const evaluation = result?.evaluation;
  const domains = evaluation ? [evaluation.levelOfService, evaluation.medicalNecessity, evaluation.coverage, evaluation.payment, evaluation.claimReadiness] : [];

  return (
    <div className="ambulance-page specialty-page">
      <header className="ambulance-hero tool-panel">
        <img src="/assets/specialty/ambulance-coding-hero-v1.png" alt="Modern ambulance outside a hospital emergency entrance" />
        <div className="ambulance-hero-overlay" />
        <div className="ambulance-hero-copy">
          <span className="specialty-eyebrow"><Ambulance size={15} /> Ambulance coding & billing</span>
          <h1>Evidence first. Every transport decision traceable.</h1>
          <p>Build a coder-ready professional or institutional claim preview from documented transport facts, CMS policy, and versioned fee-schedule evidence.</p>
          <div className="ambulance-hero-tags"><span><ShieldCheck size={14} /> Human approval required</span><span><FileCode2 size={14} /> NEMSIS-aware</span><span>Engine {AMBULANCE_ENGINE_VERSION}</span></div>
        </div>
      </header>

      <section className="ambulance-safety-strip" aria-label="Safety boundary">
        <Info size={17} /> <span>This workspace suggests codes and claim lines; it never invents diagnoses or submits a claim autonomously.</span>
      </section>

      <div className="ambulance-workspace-grid">
        <div className="ambulance-evidence-column">
          <section className="ambulance-panel tool-panel">
            <div className="ambulance-panel-heading"><div><span>01</span><h2>Import transport evidence</h2></div><FileUp size={20} /></div>
            <button type="button" className="ambulance-upload" onClick={() => fileRef.current?.click()} disabled={nemsisBusy}>
              {nemsisBusy ? <Loader2 className="spin" size={23} /> : <FileCode2 size={23} />}
              <span><strong>{nemsisBusy ? "Validating NEMSIS XML…" : "Import NEMSIS EMSDataSet"}</strong><small>Safe XML parsing, hash, field-level provenance, and validation findings</small></span>
              <ChevronRight size={18} />
            </button>
            <input ref={fileRef} type="file" accept=".xml,text/xml,application/xml" hidden onChange={(event) => event.target.files?.[0] && importNemsis(event.target.files[0])} />
            {nemsisError ? <div className="ambulance-alert danger"><AlertTriangle size={16} />{nemsisError}</div> : null}
            {nemsis ? (
              <div className="ambulance-import-summary">
                <div><strong>{nemsis.recordNumber || "PCR number not mapped"}</strong><span>NEMSIS {nemsis.detectedVersion || "version unresolved"}</span></div>
                <dl><div><dt>Patient</dt><dd>{nemsis.patientName || "Not mapped"}</dd></div><div><dt>Symptoms</dt><dd>{nemsis.symptoms.length}</dd></div><div><dt>Medications</dt><dd>{nemsis.medications.length}</dd></div><div><dt>Procedures</dt><dd>{nemsis.procedures.length}</dd></div></dl>
                {nemsis.validation.slice(0, 2).map((item, index) => <p key={index}><Info size={14} />{item.message}</p>)}
              </div>
            ) : null}
          </section>

          <section className="ambulance-panel tool-panel">
            <div className="ambulance-panel-heading"><div><span>02</span><h2>Transport and claim path</h2></div><Route size={20} /></div>
            <div className="ambulance-form-grid three">
              <Field label="Date of service"><input type="date" value={caseInput.serviceDate} onChange={(event) => update("serviceDate", event.target.value)} /></Field>
              <Field label="Payer mode"><select value={caseInput.payerMode} onChange={(event) => update("payerMode", event.target.value as AmbulanceCaseInput["payerMode"])}><option value="medicare-fs">Medicare fee-for-service</option><option value="medicare-advantage">Medicare Advantage</option><option value="medicaid">Medicaid</option><option value="commercial">Commercial</option><option value="self-pay">Self-pay</option></select></Field>
              <Field label="Billing entity"><select value={caseInput.entityType} onChange={(event) => update("entityType", event.target.value as AmbulanceCaseInput["entityType"])}><option value="independent-supplier">Independent supplier · 837P</option><option value="institutional-provider">Institutional provider · 837I</option></select></Field>
              <Field label="Transport mode"><select value={caseInput.transportMode} onChange={(event) => update("transportMode", event.target.value as AmbulanceCaseInput["transportMode"])}><option value="ground">Ground</option><option value="fixed-wing">Fixed wing</option><option value="rotary-wing">Rotary wing</option></select></Field>
              <Field label="Response"><select value={caseInput.responseType} onChange={(event) => update("responseType", event.target.value as AmbulanceCaseInput["responseType"])}><option value="emergency">Emergency response</option><option value="non-emergency">Non-emergency</option></select></Field>
              <Field label="Transport outcome"><select value={caseInput.outcome} onChange={(event) => update("outcome", event.target.value as AmbulanceCaseInput["outcome"])}><option value="transported">Transported</option><option value="pronounced-before-dispatch">Death before dispatch</option><option value="pronounced-after-dispatch-before-load">Death after dispatch, before load</option><option value="pronounced-after-load">Death after pickup</option></select></Field>
            </div>
          </section>

          <section className="ambulance-panel tool-panel">
            <div className="ambulance-panel-heading"><div><span>03</span><h2>Trip, mileage, and patient condition</h2></div><MapPin size={20} /></div>
            <div className="ambulance-form-grid three">
              <Field label="Origin"><select value={caseInput.origin} onChange={(event) => update("origin", event.target.value as AmbulanceOriginDestination)}>{OD_OPTIONS.filter(([code]) => code !== "X").map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}</select></Field>
              <Field label="Destination"><select value={caseInput.destination} onChange={(event) => update("destination", event.target.value as AmbulanceOriginDestination)}>{OD_OPTIONS.map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}</select></Field>
              <Field label="Point-of-pickup ZIP" hint="Controls locality and rurality"><input inputMode="numeric" maxLength={5} placeholder="5-digit ZIP" value={caseInput.pointOfPickupZip} onChange={(event) => update("pointOfPickupZip", event.target.value.replace(/\D/g, "").slice(0, 5))} /></Field>
              <Field label="CMS ZIP designation"><select value={caseInput.rurality} onChange={(event) => update("rurality", event.target.value as AmbulanceRurality)}><option value="unknown">Resolve from imported CMS file</option><option value="urban">Urban</option><option value="rural">Rural</option><option value="super-rural">Super-rural</option></select></Field>
              <Field label="Loaded miles" hint={`Reportable units: ${mileagePreview}`}><input type="number" min="0" step="0.01" value={caseInput.loadedMiles} onChange={(event) => update("loadedMiles", event.target.value)} /></Field>
              <Field label="Patients in vehicle"><input type="number" min="1" max="4" value={caseInput.patientCount} onChange={(event) => update("patientCount", Number(event.target.value))} /></Field>
            </div>
            <div className="ambulance-toggle-grid">
              <Toggle checked={caseInput.medicalNecessity === true} onChange={(value) => update("medicalNecessity", value ? true : null)} label="Ambulance medically necessary" detail="Based on the condition at the time of transport" />
              <Toggle checked={caseInput.destinationAppropriate === true} onChange={(value) => update("destinationAppropriate", value ? true : null)} label="Covered destination supported" />
              <Toggle checked={caseInput.nearestAppropriateFacility === true} onChange={(value) => update("nearestAppropriateFacility", value ? true : null)} label="Nearest appropriate facility" />
            </div>
            <div className="ambulance-form-grid two">
              <Field label="Why other transport was contraindicated"><textarea rows={3} value={caseInput.contraindicationToOtherTransport || ""} onChange={(event) => update("contraindicationToOtherTransport", event.target.value)} placeholder="Document the patient's condition and why car, wheelchair van, or other transport was unsafe." /></Field>
              <Field label="Supported diagnoses / symptoms" hint="No diagnosis is generated by the engine"><textarea rows={3} value={diagnosisText} onChange={(event) => setDiagnosisText(event.target.value)} placeholder="Example: R07.9, R06.02" /></Field>
            </div>
          </section>

          <section className="ambulance-panel tool-panel">
            <div className="ambulance-panel-heading"><div><span>04</span><h2>Level-of-service evidence</h2></div><Stethoscope size={20} /></div>
            <div className="ambulance-toggle-grid">
              <Toggle checked={Boolean(caseInput.alsAssessment)} onChange={(value) => update("alsAssessment", value)} label="ALS assessment documented" detail="Emergency dispatch and assessment rules still apply" />
              <Toggle checked={Boolean(caseInput.alsIntervention)} onChange={(value) => update("alsIntervention", value)} label="Medically necessary ALS intervention" />
            </div>
            <Field label="Qualifying separate IV administrations" hint="Enter one documented medication administration per line. IV push/bolus or continuous infusion only; exclude crystalloids and split doses."><textarea rows={3} value={ivAdministrationText} onChange={(event) => setIvAdministrationText(event.target.value)} placeholder={"Example:\nEpinephrine 1 mg IVP 14:03\nEpinephrine 1 mg IVP 14:07\nEpinephrine 1 mg IVP 14:11"} /></Field>
            <div className="ambulance-procedure-grid">
              {ALS2_OPTIONS.map(([key, label]) => <Toggle key={key} checked={(caseInput.als2Procedures || []).includes(key)} onChange={(checked) => update("als2Procedures", checked ? [...(caseInput.als2Procedures || []), key] : (caseInput.als2Procedures || []).filter((item) => item !== key))} label={label} />)}
            </div>
            <div className="ambulance-subsection"><h3>Specialty care transport gate</h3><div className="ambulance-toggle-grid"><Toggle checked={Boolean(caseInput.sct?.interfacility)} onChange={(value) => updateNested("sct", "interfacility", value)} label="Ground interfacility transport" /><Toggle checked={Boolean(caseInput.sct?.criticallyIllOrInjured)} onChange={(value) => updateNested("sct", "criticallyIllOrInjured", value)} label="Critically ill or injured" /><Toggle checked={Boolean(caseInput.sct?.ongoingCareRequired)} onChange={(value) => updateNested("sct", "ongoingCareRequired", value)} label="Ongoing specialty care required" /><Toggle checked={caseInput.sct?.beyondStateParamedicScope === true} onChange={(value) => updateNested("sct", "beyondStateParamedicScope", value ? true : null)} label="Beyond effective state paramedic scope" /></div></div>
            {caseInput.transportMode !== "ground" ? <div className="ambulance-subsection"><h3>Air transport gate</h3><div className="ambulance-toggle-grid"><Toggle checked={caseInput.air?.groundTransportInappropriate === true} onChange={(value) => updateNested("air", "groundTransportInappropriate", value ? true : null)} label="Ground transport inappropriate" /><Toggle checked={caseInput.air?.rapidTransportRequired === true} onChange={(value) => updateNested("air", "rapidTransportRequired", value ? true : null)} label="Rapid transport required" /><Toggle checked={caseInput.air?.distanceOrObstacleDocumented === true} onChange={(value) => updateNested("air", "distanceOrObstacleDocumented", value ? true : null)} label="Distance or obstacle documented" /></div></div> : null}
            <div className="ambulance-form-grid two compact">
              <Field label="Signature path"><select value={caseInput.signatureStatus} onChange={(event) => update("signatureStatus", event.target.value as AmbulanceCaseInput["signatureStatus"])}><option value="missing">Unresolved</option><option value="complete">Beneficiary signature</option><option value="representative">Representative signature</option><option value="crew-attestation">Crew attestation path</option></select></Field>
              <Field label="ABN status"><select value={caseInput.abnStatus} onChange={(event) => update("abnStatus", event.target.value as AmbulanceCaseInput["abnStatus"])}><option value="unknown">Unknown</option><option value="not-required">Not required</option><option value="signed">Signed</option><option value="missing">Required, missing</option></select></Field>
            </div>
          </section>

          <button type="button" className="ambulance-build-button" onClick={buildWorksheet} disabled={building}>
            {building ? <Loader2 className="spin" size={20} /> : <ClipboardCheck size={20} />}
            {building ? "Building evidence-backed worksheet…" : "Build coding & claim worksheet"}
            <ChevronRight size={19} />
          </button>
        </div>

        <aside className="ambulance-result-column">
          <div className="ambulance-result-sticky">
            <div className="ambulance-result-heading"><div><span>CODER WORKSHEET</span><h2>{evaluation ? `${evaluation.claimFormat} claim preview` : "Waiting for reviewed evidence"}</h2></div><Siren size={23} /></div>
            {!evaluation ? <div className="ambulance-empty"><Activity size={38} /><h3>Five decisions, kept separate</h3><p>Level of service, medical necessity, coverage, payment, and claim readiness will appear here with their own evidence and holds.</p></div> : (
              <>
                {serverNotice ? <div className="ambulance-alert"><Info size={16} />{serverNotice}</div> : null}
                <div className="ambulance-domain-list">
                  {domains.map((item) => <article key={item.title}><div><h3>{item.title}</h3><StatusPill status={item.status} /></div><p>{item.summary}</p>{item.missing.length ? <ul>{item.missing.slice(0, 3).map((entry) => <li key={entry}>{entry}</li>)}</ul> : null}</article>)}
                </div>
                <section className="ambulance-claim-preview">
                  <div className="ambulance-preview-meta"><span>POS <strong>{evaluation.placeOfService}</strong></span><span>O/D <strong>{evaluation.originDestinationModifier || "HOLD"}</strong></span><span>Coder approval <strong>Required</strong></span></div>
                  <div className="ambulance-line-table" role="table" aria-label="Suggested ambulance claim lines">
                    <div className="ambulance-line-head" role="row"><span>HCPCS</span><span>Modifiers</span><span>Units</span></div>
                    {evaluation.lines.length ? evaluation.lines.map((line) => <div key={`${line.hcpcs}-${line.category}`} className="ambulance-line" role="row"><span><strong>{line.hcpcs}</strong><small>{line.description}</small></span><span>{line.modifiers.join(" · ") || "—"}</span><span>{line.units}</span></div>) : <p className="ambulance-no-lines">No billable line released.</p>}
                  </div>
                  <div className="ambulance-diagnosis"><span>Supported diagnoses</span><strong>{evaluation.diagnosisCodes.join(", ") || "None entered — query, do not infer"}</strong></div>
                </section>
                {evaluation.queries.length ? <section className="ambulance-query-box"><h3><AlertTriangle size={17} /> Documentation queries</h3><ul>{evaluation.queries.map((query) => <li key={query}>{query}</li>)}</ul></section> : null}
                <section className="ambulance-source-box"><h3><ShieldCheck size={17} /> Source lineage</h3>{evaluation.sourceLineage.map((source) => <p key={source.id}><strong>{source.title}</strong><span>Effective-date review: {source.effectiveOn}</span></p>)}</section>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default AmbulanceWorkspace;
