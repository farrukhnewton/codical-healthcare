import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  ClipboardCheck,
  FileDown,
  Flame,
  Info,
  Plus,
  RotateCcw,
  Ruler,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  analyzeBurnCase,
  BURN_ENGINE_VERSION,
  BURN_REGIONS,
  BURN_SERVICE_LABELS,
  type BurnDepth,
  type BurnRegionId,
  type BurnRegionInput,
  type BurnServiceInput,
  type BurnServiceType,
  type EncounterType,
  type InjuryType,
  type SiteGroup,
} from "../../../shared/burn-coding";

const REGION_OPTIONS = Object.entries(BURN_REGIONS) as Array<[BurnRegionId, (typeof BURN_REGIONS)[BurnRegionId]]>;

const STANDARD_SITE_GROUPS: Array<{ value: SiteGroup; label: string }> = [
  { value: "trunk_limbs", label: "Trunk / arms / legs" },
  { value: "special_sites", label: "Face / scalp / neck / hands / feet / genitalia" },
];

const FULL_THICKNESS_SITE_GROUPS: Array<{ value: SiteGroup; label: string }> = [
  { value: "trunk_limbs", label: "Trunk" },
  { value: "scalp_arms_legs", label: "Scalp / arms / legs" },
  { value: "special_sites", label: "Forehead / cheeks / chin / mouth / neck / axillae / genitalia / hands / feet" },
  { value: "nose_ears_eyelids_lips", label: "Nose / ears / eyelids / lips" },
];

const TODAY = new Date().toISOString().slice(0, 10);

function freshService(): BurnServiceInput {
  return { type: "assessment_only", performed: false, productForm: "sheet" };
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="burn-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function BurnWorkspace() {
  const [age, setAge] = useState(36);
  const [serviceDate, setServiceDate] = useState(TODAY);
  const [injuryType, setInjuryType] = useState<InjuryType>("burn");
  const [encounter, setEncounter] = useState<EncounterType>("initial");
  const [regions, setRegions] = useState<BurnRegionInput[]>([
    { regionId: "anterior_trunk", burnDepth: 2, percentBurned: 25 },
  ]);
  const [service, setService] = useState<BurnServiceInput>(freshService);

  const analysis = useMemo(
    () => analyzeBurnCase({ patientAge: age, serviceDate, injuryType, encounter, regions, service }),
    [age, serviceDate, injuryType, encounter, regions, service],
  );
  const passedGates = analysis.auditGates.filter((gate) => gate.status === "pass").length;
  const heldGates = analysis.auditGates.filter((gate) => gate.status === "hold").length;

  const addRegion = () => {
    const next = REGION_OPTIONS.find(([id]) => !regions.some((region) => region.regionId === id))?.[0];
    if (!next) return;
    setRegions((current) => [...current, { regionId: next, burnDepth: 2, percentBurned: 100 }]);
  };

  const updateRegion = (index: number, patch: Partial<BurnRegionInput>) => {
    setRegions((current) => current.map((region, position) => (position === index ? { ...region, ...patch } : region)));
  };

  const updateServiceType = (type: BurnServiceType) => {
    setService({ ...freshService(), type });
  };

  const reset = () => {
    setAge(36);
    setServiceDate(TODAY);
    setInjuryType("burn");
    setEncounter("initial");
    setRegions([{ regionId: "anterior_trunk", burnDepth: 2, percentBurned: 25 }]);
    setService(freshService());
  };

  const requiresArea = ["surgical_preparation", "split_thickness_autograft", "full_thickness_autograft", "skin_substitute_sheet"].includes(service.type);
  const supportsSiteGroup = requiresArea;
  const siteGroups = service.type === "full_thickness_autograft" ? FULL_THICKNESS_SITE_GROUPS : STANDARD_SITE_GROUPS;

  return (
    <div className="burn-workspace">
      <header className="burn-hero">
        <div className="burn-hero-copy">
          <span className="burn-eyebrow"><Flame size={14} /> BURN &amp; SKIN GRAFT CODING</span>
          <h1>Turn clinical burn detail into a defensible coding worksheet.</h1>
          <p>Age-adjusted Lund–Browder TBSA, conditional ICD-10-CM extent logic, and performed-service CPT candidates with documentation holds built in.</p>
          <div className="burn-source-pills" aria-label="Knowledge sources">
            <span>ABA / Lund–Browder</span><span>FY 2026 ICD-10-CM</span><span>CMS NCCI 2026</span><span>MAC-aware CTP review</span>
          </div>
        </div>
        <div className="burn-hero-actions">
          <span className="burn-engine-state"><i /> Engine {BURN_ENGINE_VERSION}</span>
          <button type="button" className="burn-ghost-button" onClick={reset}><RotateCcw size={15} /> Reset case</button>
        </div>
      </header>

      <div className="burn-workspace-grid">
        <div className="burn-input-column">
          <section className="burn-panel">
            <div className="burn-panel-heading">
              <span className="burn-panel-icon"><ClipboardCheck size={17} /></span>
              <div><p>Case foundation</p><h2>Patient and encounter</h2></div>
              <span className="burn-section-number">01</span>
            </div>
            <div className="burn-form-grid burn-form-grid-four">
              <Field label="Patient age" hint="Selects the correct Lund–Browder age band.">
                <input type="number" min="0" max="120" value={age} onChange={(event) => setAge(Number(event.target.value))} />
              </Field>
              <Field label="Date of service" hint="Policies must be effective on this date.">
                <input type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} />
              </Field>
              <Field label="Injury type">
                <select value={injuryType} onChange={(event) => setInjuryType(event.target.value as InjuryType)}>
                  <option value="burn">Thermal / other burn</option><option value="corrosion">Chemical corrosion</option>
                </select>
              </Field>
              <Field label="Encounter">
                <select value={encounter} onChange={(event) => setEncounter(event.target.value as EncounterType)}>
                  <option value="initial">Initial active treatment</option><option value="subsequent">Subsequent care</option><option value="sequela">Sequela</option>
                </select>
              </Field>
            </div>
          </section>

          <section className="burn-panel">
            <div className="burn-panel-heading">
              <span className="burn-panel-icon"><Ruler size={17} /></span>
              <div><p>Clinical extent</p><h2>Age-adjusted body regions</h2></div>
              <span className="burn-section-number">02</span>
            </div>
            <div className="burn-callout burn-callout-info"><Info size={15} /><p><strong>Superficial (first-degree) burns are not included in TBSA.</strong> They remain visible in the worksheet so the chart can still be reconciled.</p></div>
            <div className="burn-region-table" role="table" aria-label="Burn regions">
              <div className="burn-region-head" role="row"><span>Body region</span><span>Depth</span><span>Region affected</span><span>TBSA contribution</span><span /></div>
              {regions.map((region, index) => {
                const calculated = analysis.regionResults.find((result) => result.regionId === region.regionId);
                return (
                  <div className="burn-region-row" role="row" key={`${region.regionId}-${index}`}>
                    <select aria-label={`Body region ${index + 1}`} value={region.regionId} onChange={(event) => updateRegion(index, { regionId: event.target.value as BurnRegionId })}>
                      {REGION_OPTIONS.map(([id, definition]) => <option value={id} key={id}>{definition.label}</option>)}
                    </select>
                    <select aria-label={`Burn depth ${index + 1}`} value={region.burnDepth} onChange={(event) => updateRegion(index, { burnDepth: Number(event.target.value) as BurnDepth })}>
                      <option value="1">Superficial / 1st</option><option value="2">Partial-thickness / 2nd</option><option value="3">Full-thickness / 3rd</option>
                    </select>
                    <div className="burn-percent-control">
                      <input aria-label={`Percent of region affected ${index + 1}`} type="range" min="0" max="100" step="5" value={region.percentBurned} onChange={(event) => updateRegion(index, { percentBurned: Number(event.target.value) })} />
                      <input aria-label={`Percent value ${index + 1}`} type="number" min="0" max="100" value={region.percentBurned} onChange={(event) => updateRegion(index, { percentBurned: Number(event.target.value) })} /><b>%</b>
                    </div>
                    <div className="burn-region-result"><strong>{region.burnDepth === 1 ? "Excluded" : `${calculated?.contributedTbsa ?? 0}%`}</strong><small>of {calculated?.regionMaximum ?? 0}% max</small></div>
                    <button type="button" aria-label={`Remove ${BURN_REGIONS[region.regionId].label}`} className="burn-icon-button" onClick={() => setRegions((current) => current.filter((_, position) => position !== index))}><Trash2 size={15} /></button>
                  </div>
                );
              })}
            </div>
            <button type="button" className="burn-add-button" onClick={addRegion} disabled={regions.length === REGION_OPTIONS.length}><Plus size={15} /> Add affected region</button>
          </section>

          <section className="burn-panel">
            <div className="burn-panel-heading">
              <span className="burn-panel-icon"><Sparkles size={17} /></span>
              <div><p>Procedure evidence</p><h2>Service actually performed</h2></div>
              <span className="burn-section-number">03</span>
            </div>
            <div className="burn-form-grid burn-form-grid-two">
              <Field label="Performed service" hint="The engine never infers a procedure from diagnosis alone.">
                <select value={service.type} onChange={(event) => updateServiceType(event.target.value as BurnServiceType)}>
                  {(Object.entries(BURN_SERVICE_LABELS) as Array<[BurnServiceType, string]>).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
              </Field>
              <label className={`burn-confirm-service ${service.performed ? "is-confirmed" : ""}`}>
                <input type="checkbox" checked={service.performed} disabled={service.type === "assessment_only"} onChange={(event) => setService((current) => ({ ...current, performed: event.target.checked }))} />
                <span><strong>{service.performed ? "Performed and documented" : "Confirmation required"}</strong><small>Uncheck if the record does not support this service.</small></span>
              </label>
            </div>

            {supportsSiteGroup ? (
              <div className="burn-form-grid burn-form-grid-two burn-conditional-fields">
                <Field label="Anatomic application group">
                  <select value={service.siteGroup ?? ""} onChange={(event) => setService((current) => ({ ...current, siteGroup: event.target.value as SiteGroup }))}>
                    <option value="">Select documented site group</option>
                    {siteGroups.map((group) => <option value={group.value} key={group.value}>{group.label}</option>)}
                  </select>
                </Field>
                <Field label="Total treated area (cm²)" hint="Aggregate only wounds in the same CPT anatomic group.">
                  <input type="number" min="0" step="0.01" value={service.areaCm2 ?? ""} onChange={(event) => setService((current) => ({ ...current, areaCm2: Number(event.target.value) }))} placeholder="e.g. 42" />
                </Field>
              </div>
            ) : null}

            {service.type === "local_burn_treatment" ? (
              <label className="burn-switch-row"><input type="checkbox" checked={Boolean(service.anesthesiaUsed)} onChange={(event) => setService((current) => ({ ...current, anesthesiaUsed: event.target.checked }))} /><span><strong>Treatment performed under anesthesia</strong><small>Triggers a licensed-descriptor review instead of guessing an exact code.</small></span></label>
            ) : null}

            {service.type === "escharotomy" ? (
              <div className="burn-conditional-fields"><Field label="Additional documented incisions"><input type="number" min="0" value={service.additionalIncisions ?? 0} onChange={(event) => setService((current) => ({ ...current, additionalIncisions: Number(event.target.value) }))} /></Field></div>
            ) : null}

            {service.type === "skin_substitute_sheet" ? (
              <div className="burn-product-box">
                <div className="burn-form-grid burn-form-grid-two">
                  <Field label="Product form"><select value={service.productForm} onChange={(event) => setService((current) => ({ ...current, productForm: event.target.value as "sheet" | "non_sheet" }))}><option value="sheet">Sheet-form skin replacement</option><option value="non_sheet">Non-sheet / injected / other</option></select></Field>
                  <Field label="Product name"><input value={service.productName ?? ""} onChange={(event) => setService((current) => ({ ...current, productName: event.target.value }))} placeholder="Exact name from package" /></Field>
                  <Field label="Current product HCPCS"><input value={service.productHcpcs ?? ""} onChange={(event) => setService((current) => ({ ...current, productHcpcs: event.target.value }))} placeholder="Verify effective code" /></Field>
                  <Field label="Package size (cm²)"><input type="number" min="0" value={service.packageSizeCm2 ?? ""} onChange={(event) => setService((current) => ({ ...current, packageSizeCm2: Number(event.target.value) }))} /></Field>
                  <Field label="State"><input value={service.state ?? ""} onChange={(event) => setService((current) => ({ ...current, state: event.target.value }))} placeholder="Patient/service location" /></Field>
                  <Field label="Medicare contractor (MAC)"><input value={service.mac ?? ""} onChange={(event) => setService((current) => ({ ...current, mac: event.target.value }))} placeholder="e.g. Novitas, Noridian" /></Field>
                </div>
                <div className="burn-callout burn-callout-warning"><AlertTriangle size={15} /><p>Application limits and coverage are not treated as universal. The worksheet holds jurisdiction-dependent items until the effective MAC policy is verified.</p></div>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="burn-output-column" aria-label="Coding worksheet">
          <section className="burn-summary-card">
            <div className="burn-summary-top"><span>Live clinical extent</span><ShieldCheck size={18} /></div>
            <div className="burn-metric-hero"><strong>{analysis.totalTbsa}<small>%</small></strong><span>Counted TBSA<br /><b>2nd + 3rd degree</b></span></div>
            <div className="burn-metric-grid">
              <div><span>Full-thickness</span><strong>{analysis.thirdDegreeTbsa}%</strong></div>
              <div><span>Superficial excluded</span><strong>{analysis.superficialTbsa}%</strong></div>
            </div>
            <div className="burn-extent-code">
              <span>Conditional extent code</span>
              <strong>{analysis.extentCode ?? "Not assigned"}</strong>
              <small>{analysis.extentCode ? "Additional code only; site-specific diagnosis remains primary." : encounter === "sequela" ? "T31/T32 is not assigned for sequela." : "Add partial- or full-thickness extent to calculate."}</small>
            </div>
          </section>

          <section className="burn-worksheet-card">
            <div className="burn-card-heading"><div><p>Coder worksheet</p><h2>Candidate service lines</h2></div><span className={heldGates ? "is-held" : "is-ready"}>{heldGates ? `${heldGates} hold${heldGates === 1 ? "" : "s"}` : "Ready for review"}</span></div>
            {analysis.serviceLines.length ? (
              <div className="burn-code-lines">
                {analysis.serviceLines.map((line, index) => (
                  <article key={`${line.code}-${index}`}>
                    <span className={`burn-code-role is-${line.role}`}>{line.role}</span>
                    <div><strong>{line.code}</strong><b>{line.label}</b><small>{line.rationale}</small></div>
                    <span className="burn-units">{line.units}<small>unit{line.units === 1 ? "" : "s"}</small></span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="burn-empty-state"><Flame size={22} /><strong>No CPT line released</strong><p>Confirm the performed service and its required measurements. Diagnosis or TBSA alone never creates a procedure code.</p></div>
            )}

            {analysis.siteFamilies.length ? (
              <div className="burn-site-families">
                <h3>Site-specific diagnosis prompts</h3>
                {analysis.siteFamilies.map((item) => <div key={item.family}><strong>{item.family}.-</strong><span>{item.regions.join(", ")}<small>{item.prompt}</small></span><ChevronRight size={14} /></div>)}
              </div>
            ) : null}
          </section>

          <section className="burn-audit-card">
            <div className="burn-card-heading"><div><p>Claim defense</p><h2>Documentation gates</h2></div><span>{passedGates}/{analysis.auditGates.length} passed</span></div>
            <div className="burn-audit-list">
              {analysis.auditGates.map((gate) => (
                <article className={`is-${gate.status}`} key={gate.id}>
                  <span>{gate.status === "pass" ? <Check size={13} /> : gate.status === "hold" ? <AlertTriangle size={13} /> : <Info size={13} />}</span>
                  <div><strong>{gate.title}</strong><p>{gate.detail}</p></div>
                </article>
              ))}
            </div>
            {analysis.warnings.map((warning) => <div className="burn-inline-warning" key={warning}><AlertTriangle size={14} /><span>{warning}</span></div>)}
          </section>

          <button type="button" className="burn-print-button" onClick={() => window.print()} disabled={heldGates > 0}><FileDown size={16} /> Print / save coder worksheet</button>
          <p className="burn-legal-note">Decision support only. Final code selection requires the complete record, licensed current-year CPT content, NCCI edits, payer policy, and qualified coder review.</p>
        </aside>
      </div>
    </div>
  );
}

export default BurnWorkspace;
