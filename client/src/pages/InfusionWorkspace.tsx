import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle, BadgeCheck, Beaker, CheckCircle2, Clock3, Database, FileCheck2, FileSearch,
  FileUp, FlaskConical, GitBranch, Info, Layers3, Loader2, Plus, Search, ShieldCheck, Sparkles,
  Trash2, Workflow,
} from "lucide-react";
import {
  INFUSION_ENGINE_VERSION,
  type InfusionAdministrationInput,
  type InfusionCaseInput,
  type InfusionDrugCatalogEntry,
  type InfusionEvaluation,
  type ReviewState,
} from "../../../shared/infusion-coding";

type ExtractedDocument = {
  fileName: string;
  extractionMethod: string;
  patientName?: string | null;
  serviceDate?: string | null;
  administrations: Array<Partial<InfusionAdministrationInput> & { confidence?: number; evidence?: string; page?: number }>;
  warnings: string[];
};
type EvaluationPayload = { evaluation: InfusionEvaluation; ncci?: any };

const newId = () => `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const blankAdministration = (): InfusionAdministrationInput => ({
  id: newId(), drugName: "", hcpcsCode: "", dose: undefined, doseUnit: "MG", discardedDose: 0,
  category: "therapeutic", method: "infusion", startTime: "09:00", stopTime: "10:00", accessSite: "Peripheral IV",
  medicallyNecessary: null, carrierFluidOnly: false, providerPresentForPush: null, singleDoseContainer: null,
  jwJzPolicyApplies: null, separatelyPayableDrug: null,
});
const initialCase: InfusionCaseInput = { serviceDate: "2026-08-10", setting: "hospital-outpatient", separateAccessSitesMedicallyNecessary: null, administrations: [blankAdministration()] };

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
  return <label className="inf-field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}

function ReviewToggle({ value, onChange, label }: { value: ReviewState; onChange: (value: ReviewState) => void; label: string }) {
  return <div className={`inf-review-toggle ${value === true ? "yes" : value === false ? "no" : "review"}`}>
    <strong>{label}</strong><div>
      <button type="button" className={value === true ? "active" : ""} onClick={() => onChange(true)}>Yes</button>
      <button type="button" className={value === false ? "active" : ""} onClick={() => onChange(false)}>No</button>
      <button type="button" className={value === null ? "active" : ""} onClick={() => onChange(null)}>Review</button>
    </div>
  </div>;
}

export function InfusionWorkspace() {
  const [caseInput, setCaseInput] = useState<InfusionCaseInput>(initialCase);
  const [documents, setDocuments] = useState<ExtractedDocument[]>([]);
  const [result, setResult] = useState<EvaluationPayload | null>(null);
  const [matches, setMatches] = useState<Record<string, InfusionDrugCatalogEntry[]>>({});
  const [busy, setBusy] = useState<"documents" | "worksheet" | string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof InfusionCaseInput>(key: K, value: InfusionCaseInput[K]) => setCaseInput((current) => ({ ...current, [key]: value }));
  const updateRow = <K extends keyof InfusionAdministrationInput>(id: string, key: K, value: InfusionAdministrationInput[K]) => setCaseInput((current) => ({ ...current, administrations: current.administrations.map((row) => row.id === id ? { ...row, [key]: value } : row) }));
  const removeRow = (id: string) => setCaseInput((current) => ({ ...current, administrations: current.administrations.filter((row) => row.id !== id) }));
  const verifiedRows = useMemo(() => caseInput.administrations.filter((row) => row.medicallyNecessary === true && row.separatelyPayableDrug === true && (row.method === "injection" || Boolean(row.startTime && row.stopTime))).length, [caseInput.administrations]);

  async function uploadDocuments(fileList: FileList | null) {
    if (!fileList?.length) return;
    setBusy("documents"); setError(null); setNotice(null);
    const body = new FormData(); Array.from(fileList).forEach((file) => body.append("documents", file));
    try {
      const payload = await authenticatedFetch("/api/infusion/documents/extract", { method: "POST", body });
      const received: ExtractedDocument[] = payload.documents || [];
      setDocuments(received);
      const extractedRows = received.flatMap((document) => (document.administrations || []).map((item) => ({
        ...blankAdministration(), ...item, id: newId(), sourceDocumentId: document.fileName,
        medicallyNecessary: null, carrierFluidOnly: item.category === "hydration" ? null : false,
        providerPresentForPush: item.method === "push" ? null : true, singleDoseContainer: null, jwJzPolicyApplies: null, separatelyPayableDrug: null,
      } as InfusionAdministrationInput)));
      if (extractedRows.length) setCaseInput((current) => ({ ...current, serviceDate: received.find((document) => document.serviceDate)?.serviceDate || current.serviceDate, administrations: [...current.administrations.filter((row) => row.drugName.trim()), ...extractedRows] }));
      setNotice(`${received.length} document${received.length === 1 ? "" : "s"} processed. ${extractedRows.length} administration candidate${extractedRows.length === 1 ? "" : "s"} require source verification.`);
    } catch (uploadError: any) { setError(uploadError?.message || "Document processing failed."); }
    finally { setBusy(null); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function searchDrug(row: InfusionAdministrationInput) {
    const query = row.hcpcsCode?.trim() || row.drugName.trim();
    if (query.length < 2) { setError("Enter a drug name or HCPCS code before searching."); return; }
    setBusy(`search-${row.id}`); setError(null);
    try { const payload = await authenticatedFetch(`/api/infusion/drugs?q=${encodeURIComponent(query)}`); setMatches((current) => ({ ...current, [row.id]: payload.results || [] })); }
    catch (lookupError: any) { setError(lookupError?.message || "Drug lookup failed."); }
    finally { setBusy(null); }
  }

  function chooseDrug(rowId: string, entry: InfusionDrugCatalogEntry) {
    updateRow(rowId, "hcpcsCode", entry.code);
    setMatches((current) => ({ ...current, [rowId]: [] }));
  }

  async function buildWorksheet() {
    setBusy("worksheet"); setError(null); setNotice(null); setResult(null);
    const reviewed = { ...caseInput, administrations: caseInput.administrations.filter((row) => row.drugName.trim()) };
    setCaseInput(reviewed);
    try {
      const payload = await authenticatedFetch("/api/infusion/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseInput: reviewed }) });
      setResult(payload); setNotice("Worksheet built from documented timing, access, dose, and CMS Q3 2026 drug-unit evidence. Human release review remains required.");
    } catch (buildError: any) { setError(buildError?.message || "The infusion worksheet could not be built."); }
    finally { setBusy(null); }
  }

  return <div className="inf-page">
    <section className="inf-hero">
      <img src="/assets/specialty/infusion-hierarchy-hero-v1.png" alt="Oncology infusion nurse and patient reviewing a treatment timeline" />
      <div className="inf-hero-shade" />
      <div className="inf-hero-copy">
        <span className="specialty-eyebrow"><FlaskConical size={15} /> Infusion coding intelligence</span>
        <h1>Every minute mapped.<br /><em>Every unit traceable.</em></h1>
        <p>A compliance-first workspace for administration hierarchy, verified start/stop timing, sequential and concurrent services, CMS drug billing units, JW/JZ review, and NCCI validation.</p>
        <div className="inf-hero-meta"><span><BadgeCheck size={15} /> 2026 NCCI</span><span><Database size={15} /> 890 HCPCS entries</span><span><ShieldCheck size={15} /> Human release only</span></div>
      </div>
      <span className="inf-version">Engine {INFUSION_ENGINE_VERSION}</span>
    </section>

    <div className="inf-policy-strip">
      <div><GitBranch size={18} /><span><strong>Initial service is contextual</strong>Facility hierarchy and physician-office chronology are evaluated separately.</span></div>
      <div><Clock3 size={18} /><span><strong>Documented time drives codes</strong>No start/stop evidence means no timed-service release.</span></div>
      <div><Beaker size={18} /><span><strong>Drug units stay separate</strong>Administration CPT and HCPCS drug units are calculated on distinct lines.</span></div>
    </div>

    <div className="inf-workspace-grid">
      <main className="inf-input-column">
        <section className="inf-panel">
          <header className="inf-panel-heading"><div><span>01</span><h2>Encounter and billing context</h2></div><Workflow size={20} /></header>
          <p className="inf-section-copy">The site and billing entity change how the initial service is selected. This module supports physician-office and hospital-outpatient Part B workflows.</p>
          <div className="inf-form-grid three">
            <Field label="Date of service" hint="Current drug file: July–September 2026"><input type="date" value={caseInput.serviceDate} onChange={(event) => update("serviceDate", event.target.value)} /></Field>
            <Field label="Billing setting"><select value={caseInput.setting} onChange={(event) => update("setting", event.target.value as InfusionCaseInput["setting"])}><option value="hospital-outpatient">Hospital outpatient facility</option><option value="physician-office">Physician office</option><option value="asc">Ambulatory surgical center</option><option value="inpatient">Hospital inpatient</option></select></Field>
            <ReviewToggle label="Separate medically necessary IV sites" value={caseInput.separateAccessSitesMedicallyNecessary} onChange={(value) => update("separateAccessSitesMedicallyNecessary", value)} />
          </div>
        </section>

        <section className="inf-panel">
          <header className="inf-panel-heading"><div><span>02</span><h2>Source records</h2></div><FileSearch size={20} /></header>
          <p className="inf-section-copy">Upload MARs, infusion flowsheets, orders, or pump records. Visual OCR reads native and handwritten content, but extracted values remain unverified candidates.</p>
          <input ref={fileRef} hidden type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.txt" onChange={(event) => uploadDocuments(event.target.files)} />
          <button type="button" className="inf-upload" onClick={() => fileRef.current?.click()} disabled={busy === "documents"}>{busy === "documents" ? <Loader2 className="animate-spin" /> : <FileUp />}<span><strong>Scan infusion documentation</strong><small>PDF, image, handwriting, medication administration records, and nursing flowsheets</small></span></button>
          {documents.length ? <div className="inf-documents">{documents.map((document) => <article key={document.fileName}><FileCheck2 size={17} /><div><strong>{document.fileName}</strong><span>{document.extractionMethod} · {document.administrations?.length || 0} candidates{document.patientName ? ` · ${document.patientName}` : ""}</span>{document.warnings?.slice(0, 2).map((warning) => <small key={warning}>{warning}</small>)}</div></article>)}</div> : null}
        </section>

        <section className="inf-panel">
          <header className="inf-panel-heading"><div><span>03</span><h2>Administration timeline</h2></div><Clock3 size={20} /></header>
          <p className="inf-section-copy">Enter or verify one row for each actual administration. Orders and planned therapies do not belong in the final worksheet.</p>
          <div className="inf-admin-list">{caseInput.administrations.map((row, index) => <article className="inf-admin-card" key={row.id}>
            <header><div><span>{String(index + 1).padStart(2, "0")}</span><strong>{row.drugName || "New administration"}</strong>{row.sourceDocumentId ? <small>OCR candidate · {row.sourceDocumentId}</small> : <small>Manual entry</small>}</div><button type="button" onClick={() => removeRow(row.id)} aria-label={`Remove ${row.drugName || "administration"}`}><Trash2 size={15} /></button></header>
            <div className="inf-form-grid four">
              <Field label="Drug or fluid"><input value={row.drugName} onChange={(event) => updateRow(row.id, "drugName", event.target.value)} placeholder="e.g., pembrolizumab" /></Field>
              <Field label="HCPCS drug code"><div className="inf-code-search"><input value={row.hcpcsCode || ""} onChange={(event) => updateRow(row.id, "hcpcsCode", event.target.value.toUpperCase())} placeholder="J-code" /><button type="button" onClick={() => searchDrug(row)} disabled={busy === `search-${row.id}`} aria-label="Search CMS drug file">{busy === `search-${row.id}` ? <Loader2 className="animate-spin" size={15} /> : <Search size={15} />}</button></div></Field>
              <Field label="Drug class"><select value={row.category} onChange={(event) => updateRow(row.id, "category", event.target.value as InfusionAdministrationInput["category"])}><option value="chemotherapy">Chemotherapy / highly complex</option><option value="therapeutic">Therapeutic / diagnostic</option><option value="hydration">Therapeutic hydration</option></select></Field>
              <Field label="Method"><select value={row.method} onChange={(event) => updateRow(row.id, "method", event.target.value as InfusionAdministrationInput["method"])}><option value="infusion">IV infusion</option><option value="push">IV push</option><option value="injection">IM / SQ injection</option></select></Field>
            </div>
            {matches[row.id]?.length ? <div className="inf-match-list">{matches[row.id].map((entry) => <button type="button" key={entry.code} onClick={() => chooseDrug(row.id, entry)}><strong>{entry.code}</strong><span>{entry.shortDescription}</span><small>{entry.dosageText} · ${entry.paymentLimit?.toFixed(3) ?? "N/A"}</small></button>)}</div> : null}
            <div className="inf-form-grid six inf-spaced">
              <Field label="Dose"><input type="number" min="0" step="any" value={row.dose ?? ""} onChange={(event) => updateRow(row.id, "dose", event.target.value ? Number(event.target.value) : undefined)} /></Field>
              <Field label="Dose unit"><select value={row.doseUnit || "MG"} onChange={(event) => updateRow(row.id, "doseUnit", event.target.value)}><option>MCG</option><option>MG</option><option>G</option><option>ML</option><option>UNIT</option><option>IU</option><option>DOSE</option><option>EA</option></select></Field>
              <Field label="Discarded dose"><input type="number" min="0" step="any" value={row.discardedDose ?? 0} onChange={(event) => updateRow(row.id, "discardedDose", Number(event.target.value || 0))} /></Field>
              <Field label="Start time"><input type="time" value={row.startTime || ""} disabled={row.method === "injection"} onChange={(event) => updateRow(row.id, "startTime", event.target.value)} /></Field>
              <Field label="Stop time"><input type="time" value={row.stopTime || ""} disabled={row.method === "injection"} onChange={(event) => updateRow(row.id, "stopTime", event.target.value)} /></Field>
              <Field label="Access site"><input value={row.accessSite} disabled={row.method === "injection"} onChange={(event) => updateRow(row.id, "accessSite", event.target.value)} placeholder="Peripheral IV" /></Field>
            </div>
            <div className="inf-verification-grid">
              <ReviewToggle label="Medically necessary" value={row.medicallyNecessary} onChange={(value) => updateRow(row.id, "medicallyNecessary", value)} />
              <ReviewToggle label="Carrier / patency fluid only" value={row.carrierFluidOnly} onChange={(value) => updateRow(row.id, "carrierFluidOnly", value)} />
              <ReviewToggle label="Professional present for push" value={row.providerPresentForPush} onChange={(value) => updateRow(row.id, "providerPresentForPush", value)} />
              <ReviewToggle label="Single-dose container" value={row.singleDoseContainer} onChange={(value) => updateRow(row.id, "singleDoseContainer", value)} />
              <ReviewToggle label="JW / JZ policy applies" value={row.jwJzPolicyApplies} onChange={(value) => updateRow(row.id, "jwJzPolicyApplies", value)} />
              <ReviewToggle label="Separately payable Part B drug" value={row.separatelyPayableDrug} onChange={(value) => updateRow(row.id, "separatelyPayableDrug", value)} />
            </div>
          </article>)}</div>
          <button type="button" className="inf-add-row" onClick={() => update("administrations", [...caseInput.administrations, blankAdministration()])}><Plus size={15} /> Add administration</button>
        </section>
      </main>

      <aside className="inf-results-column">
        <section className="inf-panel inf-live-card">
          <header className="inf-panel-heading compact"><div><span><Sparkles size={13} /></span><h2>Release readiness</h2></div></header>
          <div className="inf-readiness"><article><strong>{caseInput.administrations.filter((row) => row.drugName.trim()).length}</strong><span>administrations</span></article><article><strong>{verifiedRows}</strong><span>verified</span></article><article><strong>{documents.length}</strong><span>documents</span></article></div>
          <div className="inf-rule"><ShieldCheck size={17} /><span><strong>Nothing is auto-submitted</strong>OCR, hierarchy, unit conversion, and edit results remain coder-review evidence.</span></div>
        </section>
        <section className="inf-panel inf-build-card">
          <FlaskConical size={25} /><h2>Build the coding worksheet</h2><p>Calculate the administration timeline and drug-unit lines, then inspect every hold and NCCI result before release.</p>
          <button type="button" className="inf-build-button" onClick={buildWorksheet} disabled={busy === "worksheet"}>{busy === "worksheet" ? <Loader2 className="animate-spin" size={17} /> : <Sparkles size={17} />} Build infusion worksheet</button>
          {notice ? <div className="inf-alert"><CheckCircle2 size={16} />{notice}</div> : null}{error ? <div className="inf-alert danger"><AlertTriangle size={16} />{error}</div> : null}
        </section>

        {result ? <>
          <section className="inf-panel">
            <header className="inf-panel-heading compact"><div><span><Layers3 size={13} /></span><h2>Administration codes</h2></div><b className={`inf-status ${result.evaluation.status}`}>{result.evaluation.status}</b></header>
            <p className="inf-result-context">{result.evaluation.initialSelectionMode.replace("-", " ")} · {result.evaluation.pricingQuarter}</p>
            <div className="inf-line-list">{result.evaluation.administrationLines.length ? result.evaluation.administrationLines.map((line, index) => <article key={`${line.code}-${index}`}><span>{line.role}</span><strong>{line.code}</strong><b>× {line.units}</b><small>{line.rationale}</small></article>) : <p>No administration code is releasable yet.</p>}</div>
          </section>
          <section className="inf-panel">
            <header className="inf-panel-heading compact"><div><span><Beaker size={13} /></span><h2>Drug billing units</h2></div></header>
            <div className="inf-drug-lines">{result.evaluation.drugLines.length ? result.evaluation.drugLines.map((line, index) => <article key={`${line.code}-${line.modifier}-${index}`}><div><strong>{line.code}{line.modifier ? `-${line.modifier}` : ""}</strong><span>{line.doseRepresented}</span></div><b>{line.units} unit{line.units === 1 ? "" : "s"}</b><small>{line.referenceAllowance === null ? "Reference price held" : `Q3 reference $${line.referenceAllowance.toFixed(3)}`}</small>{line.issues.map((issue) => <p key={issue}>{issue}</p>)}</article>) : <p>No verified HCPCS drug-unit lines.</p>}</div>
            <div className="inf-allowance"><span>CMS Q3 reference total</span><strong>{result.evaluation.referenceAllowanceTotal === null ? "Held" : `$${result.evaluation.referenceAllowanceTotal.toFixed(3)}`}</strong><small>Not a coverage or payment guarantee.</small></div>
          </section>
          <section className="inf-panel">
            <header className="inf-panel-heading compact"><div><span><FileCheck2 size={13} /></span><h2>Edit and release review</h2></div></header>
            <div className="inf-release-list">{result.evaluation.blockers.map((item) => <p className="blocker" key={item}><AlertTriangle size={14} />{item}</p>)}{result.evaluation.warnings.map((item) => <p key={item}><Info size={14} />{item}</p>)}{result.ncci?.counts ? <p className={result.ncci.counts.edits ? "blocker" : "ok"}><GitBranch size={14} />NCCI: {result.ncci.counts.edits} edit{result.ncci.counts.edits === 1 ? "" : "s"} across {result.ncci.pairCount} pairs.</p> : result.ncci?.unavailable ? <p className="blocker"><AlertTriangle size={14} />NCCI verification unavailable: {result.ncci.message}</p> : <p><BadgeCheck size={14} />No multi-code NCCI pair check required.</p>}</div>
          </section>
        </> : <section className="inf-empty"><FlaskConical size={30} /><h3>Timeline awaiting review</h3><p>Verify the encounter and each administration, then build the worksheet.</p></section>}
      </aside>
    </div>
  </div>;
}
