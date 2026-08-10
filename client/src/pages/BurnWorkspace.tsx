import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Check, ChevronRight, ClipboardCheck, FileDown, FileScan, Flame, Info, Loader2,
  Plus, RotateCcw, Ruler, ScanLine, ShieldCheck, Sparkles, Trash2, UploadCloud, UserRound,
} from "lucide-react";
import { BurnBodyMap, burnMapSelectionKey } from "@/components/burn/BurnBodyMap";
import { scanBurnDocument, type BurnOcrProgress } from "@/lib/burn-ocr";
import {
  analyzeBurnCase, BURN_ENGINE_VERSION, BURN_REGIONS, BURN_SERVICE_LABELS,
  type BurnAnalysis, type BurnDepth, type BurnRegionId, type BurnRegionInput, type BurnServiceInput,
  type BurnServiceType, type BurnSurface, type EncounterType, type InjuryType, type SiteGroup,
} from "../../../shared/burn-coding";

const REGION_OPTIONS = Object.entries(BURN_REGIONS) as Array<[BurnRegionId, (typeof BURN_REGIONS)[BurnRegionId]]>;
const ANTERIOR_ONLY = new Set<BurnRegionId>(["anterior_trunk", "perineum"]);
const POSTERIOR_ONLY = new Set<BurnRegionId>(["posterior_trunk", "right_buttock", "left_buttock"]);
const surfaceOptions = (regionId: BurnRegionId): BurnSurface[] => ANTERIOR_ONLY.has(regionId) ? ["anterior"] : POSTERIOR_ONLY.has(regionId) ? ["posterior"] : ["anterior", "posterior"];
const REGION_SURFACE_OPTIONS = REGION_OPTIONS.flatMap(([regionId]) => surfaceOptions(regionId).map((surface) => ({ regionId, surface })));
const defaultSurface = (regionId: BurnRegionId): BurnSurface => POSTERIOR_ONLY.has(regionId) ? "posterior" : "anterior";
const STANDARD_SITE_GROUPS: Array<{ value: SiteGroup; label: string }> = [{ value: "trunk_limbs", label: "Trunk / arms / legs" }, { value: "special_sites", label: "Face / scalp / neck / hands / feet / genitalia" }];
const FULL_THICKNESS_SITE_GROUPS: Array<{ value: SiteGroup; label: string }> = [{ value: "trunk_limbs", label: "Trunk" }, { value: "scalp_arms_legs", label: "Scalp / arms / legs" }, { value: "special_sites", label: "Forehead / cheeks / chin / mouth / neck / axillae / genitalia / hands / feet" }, { value: "nose_ears_eyelids_lips", label: "Nose / ears / eyelids / lips" }];
const TODAY = new Date().toISOString().slice(0, 10);

type ExtractedBurn = {
  patientName?: string; patientAge?: number; serviceDate?: string;
  diagnoses?: Array<{ code: string; description?: string; page: number; confidence: number; evidence: string }>;
  regions?: Array<BurnRegionInput & { page?: number; confidence?: number; evidence?: string }>;
  procedures?: Array<BurnServiceInput & { page?: number; confidence?: number; evidence?: string }>;
  product?: { name?: string; hcpcs?: string; packageSizeCm2?: number; appliedAreaCm2?: number; discardedAreaCm2?: number };
  warnings?: string[]; patientMatch?: { databaseStatus?: string };
};
type CmsResult = { analysis: BurnAnalysis; cmsEvidence: { pairEvidence?: { pairs?: any[] }; catalog?: Array<{ code: string; articles: any[] | null }> }; evidenceSemantics?: string };

function freshService(): BurnServiceInput { return { type: "assessment_only", performed: false, productForm: "sheet" }; }
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <label className="burn-field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>; }
function diagnosisList(value: string) { return Array.from(new Set(value.split(/[,;\n\s]+/).map((code) => code.trim().toUpperCase()).filter(Boolean))); }
async function apiFetch(path: string, init: RequestInit) {
  const { supabase } = await import("@/lib/supabase");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session expired. Sign in again and retry.");
  const response = await fetch(path, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `Request failed (${response.status})`);
  return payload;
}

function UploadCard({ title, detail, file, inputRef, onChange }: { title: string; detail: string; file: File | null; inputRef: React.RefObject<HTMLInputElement>; onChange: (file: File | null) => void }) {
  return <button type="button" className={`burn-upload-card ${file ? "has-file" : ""}`} onClick={() => inputRef.current?.click()}>
    <input ref={inputRef} hidden type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain" onChange={(event) => onChange(event.target.files?.[0] || null)} />
    <span className="burn-upload-icon">{file ? <FileScan size={21} /> : <UploadCloud size={21} />}</span>
    <span><strong>{title}</strong><small>{file ? file.name : detail}</small></span>
    <b>{file ? "Replace" : "Choose file"}</b>
  </button>;
}

export function BurnWorkspace() {
  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState(36);
  const [serviceDate, setServiceDate] = useState(TODAY);
  const [injuryType, setInjuryType] = useState<InjuryType>("burn");
  const [encounter, setEncounter] = useState<EncounterType>("initial");
  const [stateCode, setStateCode] = useState("");
  const [diagnoses, setDiagnoses] = useState("");
  const [regions, setRegions] = useState<BurnRegionInput[]>([{ regionId: "anterior_trunk", surface: "anterior", burnDepth: 2, percentBurned: 25 }]);
  const [selectedRegion, setSelectedRegion] = useState(burnMapSelectionKey("anterior_trunk", "anterior"));
  const [service, setService] = useState<BurnServiceInput>(freshService);
  const [clinicalNote, setClinicalNote] = useState<File | null>(null);
  const [operativeReport, setOperativeReport] = useState<File | null>(null);
  const clinicalRef = useRef<HTMLInputElement>(null);
  const operativeRef = useRef<HTMLInputElement>(null);
  const [ocrProgress, setOcrProgress] = useState<BurnOcrProgress | null>(null);
  const [scanning, setScanning] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [extracted, setExtracted] = useState<ExtractedBurn | null>(null);
  const [cmsResult, setCmsResult] = useState<CmsResult | null>(null);

  const liveAnalysis = useMemo(() => analyzeBurnCase({ patientAge: age, serviceDate, injuryType, encounter, regions, service }), [age, serviceDate, injuryType, encounter, regions, service]);
  const analysis = cmsResult?.analysis || liveAnalysis;
  const passedGates = analysis.auditGates.filter((gate) => gate.status === "pass").length;
  const heldGates = analysis.auditGates.filter((gate) => gate.status === "hold").length;
  const selectedIndex = regions.findIndex((region) => burnMapSelectionKey(region.regionId, region.surface || "circumferential") === selectedRegion);
  const selected = selectedIndex >= 0 ? regions[selectedIndex] : undefined;

  const updateRegion = (index: number, patch: Partial<BurnRegionInput>) => {
    setCmsResult(null);
    setRegions((current) => current.map((region, position) => position === index ? { ...region, ...patch } : region));
  };
  const selectMapRegion = (regionId: BurnRegionId, surface: BurnSurface) => {
    const key = burnMapSelectionKey(regionId, surface);
    setSelectedRegion(key);
    setCmsResult(null);
    if (!regions.some((row) => burnMapSelectionKey(row.regionId, row.surface || "circumferential") === key)) setRegions((current) => [...current, { regionId, surface, burnDepth: 2, percentBurned: 100 }]);
  };
  const addRegion = () => {
    const next = REGION_SURFACE_OPTIONS.find(({ regionId, surface }) => !regions.some((row) => burnMapSelectionKey(row.regionId, row.surface || "circumferential") === burnMapSelectionKey(regionId, surface)));
    if (next) selectMapRegion(next.regionId, next.surface);
  };
  const updateServiceType = (type: BurnServiceType) => { setCmsResult(null); setService({ ...freshService(), type }); };
  const reset = () => {
    setPatientName(""); setAge(36); setServiceDate(TODAY); setInjuryType("burn"); setEncounter("initial"); setStateCode(""); setDiagnoses("");
    setRegions([{ regionId: "anterior_trunk", surface: "anterior", burnDepth: 2, percentBurned: 25 }]); setSelectedRegion(burnMapSelectionKey("anterior_trunk", "anterior")); setService(freshService());
    setClinicalNote(null); setOperativeReport(null); setWarnings([]); setError(""); setExtracted(null); setCmsResult(null);
  };

  const scanDocuments = async () => {
    if (!clinicalNote && !operativeReport) { setError("Upload a clinical note or operative report first."); return; }
    setScanning(true); setError(""); setWarnings([]); setCmsResult(null);
    try {
      const form = new FormData();
      const allWarnings: string[] = [];
      for (const [file, field, textField] of [[clinicalNote, "clinicalNote", "clinicalText"], [operativeReport, "operativeReport", "operativeText"]] as const) {
        if (!file) continue;
        form.append(field, file);
        const ocr = await scanBurnDocument(file, setOcrProgress);
        if (ocr.text) form.append(textField, ocr.text);
        allWarnings.push(...ocr.warnings.map((warning) => `${file.name}: ${warning}`));
        for (const page of ocr.pageImages) form.append("pageImages", page.blob, `burn-page-${page.pageNumber}.jpg`);
      }
      const payload = await apiFetch("/api/burn/extract", { method: "POST", body: form });
      const draft = payload.extracted as ExtractedBurn;
      setExtracted(draft);
      if (draft.patientName) setPatientName(draft.patientName);
      if (draft.patientAge !== undefined) setAge(draft.patientAge);
      if (draft.serviceDate) setServiceDate(draft.serviceDate);
      if (draft.diagnoses?.length) setDiagnoses(draft.diagnoses.map((row) => row.code).join(", "));
      if (draft.regions?.length) {
        const rows = draft.regions.map((row) => ({ regionId: row.regionId, surface: row.surface || defaultSurface(row.regionId), burnDepth: row.burnDepth, percentBurned: row.percentBurned ?? 0 }));
        setRegions(rows); setSelectedRegion(burnMapSelectionKey(rows[0].regionId, rows[0].surface));
      }
      const performed = draft.procedures?.find((row) => row.performed);
      if (performed) setService((current) => ({ ...current, ...performed, productName: draft.product?.name, productHcpcs: draft.product?.hcpcs, packageSizeCm2: draft.product?.packageSizeCm2, appliedAreaCm2: draft.product?.appliedAreaCm2, discardedAreaCm2: draft.product?.discardedAreaCm2 }));
      setWarnings(Array.from(new Set([...allWarnings, ...(draft.warnings || [])])));
    } catch (scanError) { setError(scanError instanceof Error ? scanError.message : "Document scan failed."); }
    finally { setScanning(false); setOcrProgress(null); }
  };

  const buildWorksheet = async () => {
    setBuilding(true); setError("");
    try {
      const payload = await apiFetch("/api/burn/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseInput: { patientAge: age, serviceDate, injuryType, encounter, regions, service }, diagnosisCodes: diagnosisList(diagnoses), stateCode }) });
      setCmsResult(payload);
    } catch (buildError) { setError(buildError instanceof Error ? buildError.message : "Could not build the worksheet."); }
    finally { setBuilding(false); }
  };

  const requiresArea = ["surgical_preparation", "split_thickness_autograft", "full_thickness_autograft", "skin_substitute_sheet"].includes(service.type);
  const siteGroups = service.type === "full_thickness_autograft" ? FULL_THICKNESS_SITE_GROUPS : STANDARD_SITE_GROUPS;
  const cmsCatalog = cmsResult?.cmsEvidence.catalog || [];
  const cmsPairs = cmsResult?.cmsEvidence.pairEvidence?.pairs || [];

  return <div className="burn-workspace">
    <header className="burn-hero">
      <div className="burn-hero-copy"><span className="burn-eyebrow"><Flame size={14} /> BURN &amp; SKIN GRAFT CODING</span><h1>Map the burn. Verify the record. Build a defensible worksheet.</h1><p>Interactive age-adjusted Lund–Browder mapping, handwriting-aware document review, and current CMS/MAC evidence in one coder workflow.</p><div className="burn-source-pills"><span>Lund–Browder</span><span>FY 2026 ICD-10-CM</span><span>CMS NCCI 2026</span><span>Cloudflare MCD</span></div></div>
      <div className="burn-hero-actions"><span className="burn-engine-state"><i /> Engine {BURN_ENGINE_VERSION}</span><button type="button" className="burn-ghost-button" onClick={reset}><RotateCcw size={15} /> Reset case</button></div>
    </header>

    <section className="burn-panel burn-intake-panel">
      <div className="burn-panel-heading"><span className="burn-panel-icon"><ScanLine size={17} /></span><div><p>Document intelligence</p><h2>Clinical note and operative report</h2></div><span className="burn-section-number">01</span></div>
      <div className="burn-upload-grid">
        <UploadCard title="Clinical note" detail="PDF, JPG, PNG or TXT · handwritten notes supported" file={clinicalNote} inputRef={clinicalRef} onChange={setClinicalNote} />
        <UploadCard title="Operative report" detail="Upload when a procedure or graft was performed" file={operativeReport} inputRef={operativeRef} onChange={setOperativeReport} />
      </div>
      <div className="burn-scan-footer"><div><strong>Two-pass document review</strong><small>Local high-resolution OCR plus visual handwriting review. Every extracted field remains editable.</small></div><button type="button" className="burn-primary-button" onClick={scanDocuments} disabled={scanning || (!clinicalNote && !operativeReport)}>{scanning ? <Loader2 size={16} className="burn-spin" /> : <FileScan size={16} />}{scanning ? (ocrProgress?.status || "Scanning documents…") : "Scan and populate review"}</button></div>
      {scanning && ocrProgress ? <div className="burn-progress"><i style={{ width: `${Math.round(ocrProgress.progress * 100)}%` }} /></div> : null}
      {error ? <div className="burn-callout burn-callout-error"><AlertTriangle size={15} /><p>{error}</p></div> : null}
      {warnings.map((warning) => <div className="burn-inline-warning" key={warning}><AlertTriangle size={14} /><span>{warning}</span></div>)}
      {extracted ? <div className="burn-extraction-status"><Check size={15} /><span>Extraction review ready. Verify low-confidence handwriting and all procedure details against the source.</span></div> : null}
    </section>

    <div className="burn-workspace-grid">
      <div className="burn-input-column">
        <section className="burn-panel">
          <div className="burn-panel-heading"><span className="burn-panel-icon"><UserRound size={17} /></span><div><p>Case foundation</p><h2>Patient and encounter</h2></div><span className="burn-section-number">02</span></div>
          <div className="burn-form-grid burn-form-grid-three">
            <Field label="Patient name" hint="Used to reconcile the uploaded records with the patient database."><input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Full name" /></Field>
            <Field label="Patient age" hint="Uses the pediatric model and age-adjusted weights under 18; switches to the locked adult model at 18."><input type="number" min="0" max="120" value={age} onChange={(e) => { setCmsResult(null); setAge(Number(e.target.value)); }} /></Field>
            <Field label="Date of service"><input type="date" value={serviceDate} onChange={(e) => { setCmsResult(null); setServiceDate(e.target.value); }} /></Field>
            <Field label="Injury type"><select value={injuryType} onChange={(e) => { setCmsResult(null); setInjuryType(e.target.value as InjuryType); }}><option value="burn">Thermal / other burn</option><option value="corrosion">Chemical corrosion</option></select></Field>
            <Field label="Encounter"><select value={encounter} onChange={(e) => { setCmsResult(null); setEncounter(e.target.value as EncounterType); }}><option value="initial">Initial active treatment</option><option value="subsequent">Subsequent care</option><option value="sequela">Sequela</option></select></Field>
            <Field label="Medicare service state" hint="Used to narrow MAC article evidence."><input maxLength={2} value={stateCode} onChange={(e) => { setCmsResult(null); setStateCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "")); }} placeholder="e.g. TX" /></Field>
          </div>
          <Field label="Documented diagnosis codes" hint="OCR suggestions are drafts. Manual additions and corrections here are submitted to the CMS cross-reference."><textarea value={diagnoses} onChange={(e) => { setCmsResult(null); setDiagnoses(e.target.value); }} placeholder="Enter exact ICD-10-CM codes, separated by commas" rows={2} /></Field>
        </section>

        <section className="burn-panel">
          <div className="burn-panel-heading"><span className="burn-panel-icon"><Ruler size={17} /></span><div><p>Clinical extent</p><h2>Interactive Lund–Browder map</h2></div><span className="burn-section-number">03</span></div>
          <div className="burn-callout burn-callout-info"><Info size={15} /><p><strong>Superficial burns remain visible but are excluded from counted TBSA.</strong> Select a body region, then set depth and the affected share of that region.</p></div>
          <div className="burn-map-editor-grid">
            <BurnBodyMap age={age} regions={regions} selected={selectedRegion} onSelect={selectMapRegion} />
            <div className="burn-region-editor">
              {selected ? <>
                <div className="burn-region-editor-title"><span>Selected {selected.surface || "circumferential"} surface</span><strong>{BURN_REGIONS[selected.regionId].label}</strong><small>Maximum for this surface and age: {analysis.regionResults.find((row) => row.regionId === selected.regionId && row.surface === selected.surface)?.regionMaximum ?? 0}% TBSA</small></div>
                <div className="burn-depth-buttons" role="group" aria-label="Burn depth">{([1, 2, 3] as BurnDepth[]).map((depth) => <button type="button" className={selected.burnDepth === depth ? "is-active" : ""} key={depth} onClick={() => updateRegion(selectedIndex, { burnDepth: depth })}><i className={`depth-${depth}`} /><span>{depth === 1 ? "Superficial" : depth === 2 ? "Partial thickness" : "Full thickness"}<small>{depth === 1 ? "1st degree" : depth === 2 ? "2nd degree" : "3rd degree"}</small></span></button>)}</div>
                <div className="burn-region-percent"><div><span>Affected share of {selected.surface || "circumferential"} surface</span><strong>{selected.percentBurned}%</strong></div><input type="range" min="0" max="100" step="1" value={selected.percentBurned} onChange={(e) => updateRegion(selectedIndex, { percentBurned: Number(e.target.value) })} /><input type="number" min="0" max="100" value={selected.percentBurned} onChange={(e) => updateRegion(selectedIndex, { percentBurned: Number(e.target.value) })} /></div>
                <div className="burn-contribution"><span>Calculated contribution</span><strong>{analysis.regionResults.find((row) => row.regionId === selected.regionId && row.surface === selected.surface)?.contributedTbsa ?? 0}% TBSA</strong></div>
                <p className="burn-surface-note">Anterior and posterior are independent. Rotate the model and select both surfaces only when both are documented.</p>
                <button type="button" className="burn-remove-region" onClick={() => { const remaining = regions.filter((_, index) => index !== selectedIndex); setRegions(remaining); setSelectedRegion(remaining[0] ? burnMapSelectionKey(remaining[0].regionId, remaining[0].surface || "circumferential") : burnMapSelectionKey("head", "anterior")); }}><Trash2 size={14} /> Remove this surface</button>
              </> : <div className="burn-empty-state"><Ruler size={22} /><strong>Select a body region</strong><p>Rotate the 3D model and click the documented body surface to begin.</p></div>}
            </div>
          </div>
          <div className="burn-selected-strip">{regions.map((region) => { const key = burnMapSelectionKey(region.regionId, region.surface || "circumferential"); return <button key={key} type="button" className={selectedRegion === key ? "is-active" : ""} onClick={() => setSelectedRegion(key)}><i className={`depth-${region.burnDepth}`} />{BURN_REGIONS[region.regionId].label}<em>{region.surface || "circumferential"}</em><b>{region.percentBurned}%</b></button>; })}<button type="button" className="burn-add-chip" onClick={addRegion} disabled={regions.length === REGION_SURFACE_OPTIONS.length}><Plus size={13} /> Add surface</button></div>
        </section>

        <section className="burn-panel">
          <div className="burn-panel-heading"><span className="burn-panel-icon"><Sparkles size={17} /></span><div><p>Procedure evidence</p><h2>Service actually performed</h2></div><span className="burn-section-number">04</span></div>
          <div className="burn-form-grid burn-form-grid-two">
            <Field label="Performed service" hint="No procedure is inferred from diagnosis or TBSA alone."><select value={service.type} onChange={(e) => updateServiceType(e.target.value as BurnServiceType)}>{(Object.entries(BURN_SERVICE_LABELS) as Array<[BurnServiceType, string]>).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>
            <label className={`burn-confirm-service ${service.performed ? "is-confirmed" : ""}`}><input type="checkbox" checked={service.performed} disabled={service.type === "assessment_only"} onChange={(e) => { setCmsResult(null); setService((current) => ({ ...current, performed: e.target.checked })); }} /><span><strong>{service.performed ? "Performed and documented" : "Confirmation required"}</strong><small>Leave unchecked for planned or considered work.</small></span></label>
          </div>
          {requiresArea ? <div className="burn-form-grid burn-form-grid-two burn-conditional-fields"><Field label="Anatomic application group"><select value={service.siteGroup ?? ""} onChange={(e) => setService((current) => ({ ...current, siteGroup: e.target.value as SiteGroup }))}><option value="">Select documented site group</option>{siteGroups.map((group) => <option value={group.value} key={group.value}>{group.label}</option>)}</select></Field><Field label="Total treated area (cm²)" hint="Aggregate only sites in the same CPT anatomic group."><input type="number" min="0" step="0.01" value={service.areaCm2 ?? ""} onChange={(e) => setService((current) => ({ ...current, areaCm2: Number(e.target.value) }))} /></Field></div> : null}
          {service.type === "local_burn_treatment" ? <label className="burn-switch-row"><input type="checkbox" checked={Boolean(service.anesthesiaUsed)} onChange={(e) => setService((current) => ({ ...current, anesthesiaUsed: e.target.checked }))} /><span><strong>Treatment performed under anesthesia</strong><small>Requires exact current descriptor review.</small></span></label> : null}
          {service.type === "escharotomy" ? <Field label="Additional documented incisions"><input type="number" min="0" value={service.additionalIncisions ?? 0} onChange={(e) => setService((current) => ({ ...current, additionalIncisions: Number(e.target.value) }))} /></Field> : null}
          {service.type === "skin_substitute_sheet" ? <div className="burn-product-box"><div className="burn-form-grid burn-form-grid-two"><Field label="Product form"><select value={service.productForm} onChange={(e) => setService((current) => ({ ...current, productForm: e.target.value as "sheet" | "non_sheet" }))}><option value="sheet">Sheet-form skin replacement</option><option value="non_sheet">Non-sheet / injected / other</option></select></Field><Field label="Product name"><input value={service.productName ?? ""} onChange={(e) => setService((current) => ({ ...current, productName: e.target.value }))} /></Field><Field label="Current product HCPCS"><input value={service.productHcpcs ?? ""} onChange={(e) => setService((current) => ({ ...current, productHcpcs: e.target.value }))} /></Field><Field label="Package size (cm²)"><input type="number" min="0" value={service.packageSizeCm2 ?? ""} onChange={(e) => setService((current) => ({ ...current, packageSizeCm2: Number(e.target.value) }))} /></Field></div></div> : null}
          <button type="button" className="burn-build-button" onClick={buildWorksheet} disabled={building}>{building ? <Loader2 size={17} className="burn-spin" /> : <ShieldCheck size={17} />}{building ? "Cross-referencing CMS evidence…" : "Build coding & billing worksheet"}</button>
        </section>
      </div>

      <aside className="burn-output-column" aria-label="Coding worksheet">
        <section className="burn-summary-card"><div className="burn-summary-top"><span>Live clinical extent</span><ShieldCheck size={18} /></div><div className="burn-metric-hero"><strong>{analysis.totalTbsa}<small>%</small></strong><span>Counted TBSA<br /><b>2nd + 3rd degree</b></span></div><div className="burn-metric-grid"><div><span>Full-thickness</span><strong>{analysis.thirdDegreeTbsa}%</strong></div><div><span>Superficial excluded</span><strong>{analysis.superficialTbsa}%</strong></div></div><div className="burn-extent-code"><span>Conditional extent code</span><strong>{analysis.extentCode ?? "Not assigned"}</strong><small>{analysis.extentCode ? "Additional code only; exact site diagnosis remains primary." : "Add documented partial- or full-thickness extent to calculate."}</small></div></section>
        <section className="burn-worksheet-card"><div className="burn-card-heading"><div><p>Coder worksheet</p><h2>Candidate service lines</h2></div><span className={heldGates ? "is-held" : "is-ready"}>{heldGates ? `${heldGates} hold${heldGates === 1 ? "" : "s"}` : "Ready for review"}</span></div><div className="burn-claim-context"><div><span>Patient</span><strong>{patientName || "Not documented"}</strong></div><div><span>Date of service</span><strong>{serviceDate || "Not documented"}</strong></div><div><span>Documented diagnoses</span><strong>{diagnosisList(diagnoses).join(", ") || "Awaiting exact ICD-10-CM"}</strong></div></div>{analysis.serviceLines.length ? <div className="burn-code-lines">{analysis.serviceLines.map((line, index) => <article key={`${line.code}-${index}`}><span className={`burn-code-role is-${line.role}`}>{line.role}</span><div><strong>{line.code}</strong><b>{line.label}</b><small>{line.rationale}</small></div><span className="burn-units">{line.units}<small>unit{line.units === 1 ? "" : "s"}</small></span></article>)}</div> : <div className="burn-empty-state"><Flame size={22} /><strong>No CPT line released</strong><p>Confirm the performed service and required measurements.</p></div>}{analysis.siteFamilies.length ? <div className="burn-site-families"><h3>Site-specific diagnosis prompts</h3>{analysis.siteFamilies.map((item) => <div key={item.family}><strong>{item.family}.-</strong><span>{item.regions.join(", ")}<small>{item.prompt}</small></span><ChevronRight size={14} /></div>)}</div> : null}</section>
        {cmsResult ? <section className="burn-cms-card"><div className="burn-card-heading"><div><p>Current coverage evidence</p><h2>CMS / MAC cross-reference</h2></div><span>{cmsCatalog.reduce((sum, row) => sum + (row.articles?.length || 0), 0)} articles</span></div>{cmsCatalog.map((row) => <div className="burn-cms-code" key={row.code}><strong>{row.code}</strong><div>{row.articles?.length ? row.articles.slice(0, 4).map((article: any) => <span key={article.document_uid || article.displayId || article.display_id}>{article.displayId || article.display_id || article.article_id} · {article.title}</span>) : <span>No matching local CMS article found — not a noncoverage determination.</span>}</div></div>)}{cmsPairs.map((pair: any, index: number) => <div className={`burn-pair-status is-${pair.status}`} key={`${pair.icdCode}-${pair.procedureCode}-${index}`}><strong>{pair.icdCode} ↔ {pair.procedureCode}</strong><span>{pair.status === "not_found" ? "No matching article group found; payer review required" : `${pair.status} article-group evidence`}</span></div>)}<small className="burn-cms-semantics">{cmsResult.evidenceSemantics}</small></section> : null}
        <section className="burn-audit-card"><div className="burn-card-heading"><div><p>Claim defense</p><h2>Documentation gates</h2></div><span>{passedGates}/{analysis.auditGates.length} passed</span></div><div className="burn-audit-list">{analysis.auditGates.map((gate) => <article className={`is-${gate.status}`} key={gate.id}><span>{gate.status === "pass" ? <Check size={13} /> : gate.status === "hold" ? <AlertTriangle size={13} /> : <Info size={13} />}</span><div><strong>{gate.title}</strong><p>{gate.detail}</p></div></article>)}</div>{analysis.warnings.map((warning) => <div className="burn-inline-warning" key={warning}><AlertTriangle size={14} /><span>{warning}</span></div>)}</section>
        <button type="button" className="burn-print-button" onClick={() => window.print()} disabled={!cmsResult || heldGates > 0}><FileDown size={16} /> Print / save coder worksheet</button><p className="burn-legal-note">Decision support only. Final selection requires the complete record, current licensed CPT content, NCCI edits, payer policy, and qualified coder review.</p>
      </aside>
    </div>
  </div>;
}

export default BurnWorkspace;
