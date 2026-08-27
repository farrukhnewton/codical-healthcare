import { useState } from "react";
import { AlertTriangle, CheckCircle2, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import {
  revenueIntegrityRequest,
  type RevenueClaimCorrectionResult,
  type RevenueIntegrityClaimDetail,
} from "@/lib/revenue-integrity-api";
import type { RevenueTransmissionInput } from "@shared/revenue-integrity";

type DraftLine = {
  lineNumber: number;
  procedureCode: string;
  description: string;
  modifiers: string;
  diagnosisPointers: string;
  placeOfService: string;
  units: string;
  chargeAmount: string;
  expectedAmount: string;
};

type CorrectionDraft = {
  reason: string;
  patientControlNumber: string;
  payerId: string;
  payerName: string;
  serviceFrom: string;
  serviceTo: string;
  billingProviderNpi: string;
  renderingProviderNpi: string;
  diagnosisCodes: string;
  totalCharge: string;
  expectedAmount: string;
  lines: DraftLine[];
  transmission?: RevenueTransmissionInput;
};

function initialDraft(detail: RevenueIntegrityClaimDetail): CorrectionDraft {
  return {
    reason: "",
    patientControlNumber: detail.claim.patientControlNumber,
    payerId: detail.claim.payerId,
    payerName: detail.claim.payerName,
    serviceFrom: detail.claim.serviceFrom,
    serviceTo: detail.claim.serviceTo || detail.claim.serviceFrom,
    billingProviderNpi: detail.claim.billingProviderNpi,
    renderingProviderNpi: detail.claim.renderingProviderNpi || "",
    diagnosisCodes: detail.claim.diagnosisCodes.join(", "),
    totalCharge: String(detail.claim.totalCharge),
    expectedAmount: detail.claim.expectedAmount == null ? "" : String(detail.claim.expectedAmount),
    lines: detail.lines.map((line) => ({
      lineNumber: line.lineNumber,
      procedureCode: line.procedureCode,
      description: line.description || "",
      modifiers: line.modifiers.join(", "),
      diagnosisPointers: line.diagnosisPointers.join(", "),
      placeOfService: line.placeOfService || "",
      units: String(line.units),
      chargeAmount: String(line.chargeAmount),
      expectedAmount: line.expectedAmount == null ? "" : String(line.expectedAmount),
    })),
    transmission: detail.transmission?.transmissionData,
  };
}

function csv(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function numericCsv(value: string) {
  return csv(value).map(Number).filter((item) => Number.isInteger(item));
}

export function RevenueClaimCorrection({
  detail,
  onCancel,
  onSaved,
}: {
  detail: RevenueIntegrityClaimDetail;
  onCancel: () => void;
  onSaved: (message: string) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState(() => initialDraft(detail));
  const [state, setState] = useState<{ status: "idle" | "saving" | "success" | "error"; message?: string }>({ status: "idle" });
  const isOptum = detail.claim.clearinghouseProvider === "optum" || detail.transmission?.schemaVersion.startsWith("optum-");

  const updateLine = (index: number, field: keyof DraftLine, value: string | number) => {
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line),
    }));
  };

  const updateTransmission = (updater: (value: RevenueTransmissionInput) => RevenueTransmissionInput) => {
    setDraft((current) => current.transmission ? { ...current, transmission: updater(current.transmission) } : current);
  };

  const addLine = () => {
    const nextNumber = Math.max(0, ...draft.lines.map((line) => line.lineNumber)) + 1;
    setDraft((current) => ({
      ...current,
      lines: [...current.lines, {
        lineNumber: nextNumber,
        procedureCode: "",
        description: "",
        modifiers: "",
        diagnosisPointers: "1",
        placeOfService: current.lines[0]?.placeOfService || "11",
        units: "1",
        chargeAmount: "0",
        expectedAmount: "",
      }],
    }));
  };

  const save = async () => {
    setState({ status: "saving", message: isOptum ? "Saving correction and revalidating with Optum..." : "Saving the claim correction..." });
    try {
      const correction = await revenueIntegrityRequest<RevenueClaimCorrectionResult>(`/api/revenue-integrity/claims/${detail.claim.id}/correction`, {
        method: "PUT",
        body: JSON.stringify({
          expectedVersion: detail.claim.version,
          reason: draft.reason,
          claim: {
            patientControlNumber: draft.patientControlNumber,
            payerId: draft.payerId,
            payerName: draft.payerName,
            serviceFrom: draft.serviceFrom,
            serviceTo: draft.serviceTo || undefined,
            billingProviderNpi: draft.billingProviderNpi,
            renderingProviderNpi: draft.renderingProviderNpi || undefined,
            diagnosisCodes: csv(draft.diagnosisCodes).map((code) => code.toUpperCase()),
            totalCharge: Number(draft.totalCharge),
            expectedAmount: draft.expectedAmount === "" ? undefined : Number(draft.expectedAmount),
            lines: draft.lines.map((line) => ({
              lineNumber: line.lineNumber,
              procedureCode: line.procedureCode,
              description: line.description || undefined,
              modifiers: csv(line.modifiers).map((modifier) => modifier.toUpperCase()),
              diagnosisPointers: numericCsv(line.diagnosisPointers),
              placeOfService: line.placeOfService || undefined,
              units: Number(line.units),
              chargeAmount: Number(line.chargeAmount),
              expectedAmount: line.expectedAmount === "" ? undefined : Number(line.expectedAmount),
            })),
          },
          transmission: draft.transmission,
        }),
      });

      if (isOptum) {
        const validation = await revenueIntegrityRequest<{
          valid: boolean;
          status: string;
          edits: Array<{ field: string; description: string; location: string | null }>;
        }>(`/api/revenue-integrity/claims/${detail.claim.id}/validate-optum`, { method: "POST" });
        if (validation.valid) {
          const message = `Correction saved as version ${correction.version}. Optum revalidation passed and its work item was resolved.`;
          setState({ status: "success", message });
          await onSaved(message);
          return;
        }
        const message = `Correction saved as version ${correction.version}, but Optum returned ${validation.edits.length} remaining edit${validation.edits.length === 1 ? "" : "s"}.`;
        setState({ status: "success", message });
        await onSaved(message);
        return;
      }

      const message = `Correction saved as version ${correction.version}. Integrity score: ${correction.integrity.score}%.`;
      setState({ status: "success", message });
      await onSaved(message);
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "The correction could not be saved." });
    }
  };

  return (
    <div className="ri-correction">
      <div className="ri-correction-heading">
        <div>
          <span>Controlled correction</span>
          <h3>Correct claim version {detail.claim.version}</h3>
          <p>Every change is validated, versioned, and written to the audit timeline.</p>
        </div>
        <button type="button" className="ri-secondary-action" onClick={onCancel}><X size={15} /> Cancel</button>
      </div>

      {detail.claim.patientControlNumber === "test00005" ? (
        <div className="ri-sandbox-guidance">
          <AlertTriangle size={18} />
          <div>
            <strong>Optum canned edit case</strong>
            <p>The sandbox returns the 2430 SVD edit whenever PCN test00005 is used. Change it to Optum's clean synthetic PCN 00000 to test the full resolution path.</p>
          </div>
          <button type="button" onClick={() => setDraft((current) => ({ ...current, patientControlNumber: "00000", reason: current.reason || "Resolve the Optum synthetic edit and revalidate the corrected claim." }))}>
            Apply sandbox correction
          </button>
        </div>
      ) : null}

      <label className="ri-reason-field">
        <span>Correction reason <b>Required</b></span>
        <textarea value={draft.reason} onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))} placeholder="Document what was corrected and why..." maxLength={500} />
      </label>

      <section className="ri-editor-section">
        <header><div><h4>Claim header</h4><p>Payer, dates, diagnoses, providers, and financial totals.</p></div></header>
        <div className="ri-editor-grid">
          <label><span>Patient control number</span><input value={draft.patientControlNumber} onChange={(event) => setDraft((current) => ({ ...current, patientControlNumber: event.target.value }))} /></label>
          <label><span>Payer ID</span><input value={draft.payerId} onChange={(event) => setDraft((current) => ({ ...current, payerId: event.target.value }))} /></label>
          <label className="ri-span-2"><span>Payer name</span><input value={draft.payerName} onChange={(event) => setDraft((current) => ({ ...current, payerName: event.target.value }))} /></label>
          <label><span>Service from</span><input type="date" value={draft.serviceFrom} onChange={(event) => setDraft((current) => ({ ...current, serviceFrom: event.target.value }))} /></label>
          <label><span>Service to</span><input type="date" value={draft.serviceTo} onChange={(event) => setDraft((current) => ({ ...current, serviceTo: event.target.value }))} /></label>
          <label><span>Billing provider NPI</span><input inputMode="numeric" value={draft.billingProviderNpi} onChange={(event) => setDraft((current) => ({ ...current, billingProviderNpi: event.target.value }))} /></label>
          <label><span>Rendering provider NPI</span><input inputMode="numeric" value={draft.renderingProviderNpi} onChange={(event) => setDraft((current) => ({ ...current, renderingProviderNpi: event.target.value }))} /></label>
          <label className="ri-span-2"><span>Diagnosis codes <small>Comma separated, in pointer order</small></span><input value={draft.diagnosisCodes} onChange={(event) => setDraft((current) => ({ ...current, diagnosisCodes: event.target.value }))} /></label>
          <label><span>Total charge</span><input type="number" min="0" step="0.01" value={draft.totalCharge} onChange={(event) => setDraft((current) => ({ ...current, totalCharge: event.target.value }))} /></label>
          <label><span>Expected amount</span><input type="number" min="0" step="0.01" value={draft.expectedAmount} onChange={(event) => setDraft((current) => ({ ...current, expectedAmount: event.target.value }))} /></label>
        </div>
      </section>

      <section className="ri-editor-section">
        <header>
          <div><h4>Service lines</h4><p>Codes, modifiers, diagnosis pointers, units, and charges.</p></div>
          <button type="button" className="ri-secondary-action" onClick={addLine}><Plus size={14} /> Add line</button>
        </header>
        <div className="ri-line-editors">
          {draft.lines.map((line, index) => (
            <article key={`${line.lineNumber}-${index}`}>
              <div className="ri-line-editor-title">
                <strong>Line {line.lineNumber}</strong>
                <button type="button" disabled={draft.lines.length === 1} onClick={() => setDraft((current) => ({ ...current, lines: current.lines.filter((_, lineIndex) => lineIndex !== index) }))} aria-label={`Remove line ${line.lineNumber}`}><Trash2 size={14} /></button>
              </div>
              <div className="ri-line-editor-grid">
                <label><span>CPT/HCPCS</span><input value={line.procedureCode} onChange={(event) => updateLine(index, "procedureCode", event.target.value)} /></label>
                <label><span>Modifiers</span><input value={line.modifiers} onChange={(event) => updateLine(index, "modifiers", event.target.value)} placeholder="25, 59" /></label>
                <label><span>Diagnosis pointers</span><input value={line.diagnosisPointers} onChange={(event) => updateLine(index, "diagnosisPointers", event.target.value)} placeholder="1, 2" /></label>
                <label><span>POS</span><input value={line.placeOfService} onChange={(event) => updateLine(index, "placeOfService", event.target.value)} maxLength={2} /></label>
                <label><span>Units</span><input type="number" min="0.001" step="0.001" value={line.units} onChange={(event) => updateLine(index, "units", event.target.value)} /></label>
                <label><span>Charge</span><input type="number" min="0" step="0.01" value={line.chargeAmount} onChange={(event) => updateLine(index, "chargeAmount", event.target.value)} /></label>
              </div>
            </article>
          ))}
        </div>
      </section>

      {draft.transmission ? (
        <section className="ri-editor-section">
          <header><div><h4>Verified 837P profile</h4><p>Core payer, subscriber, billing, and rendering identifiers.</p></div><span className="ri-verified-chip"><CheckCircle2 size={13} /> Verified profile</span></header>
          <div className="ri-editor-grid">
            <label><span>Trading partner ID</span><input value={draft.transmission.tradingPartnerServiceId} onChange={(event) => updateTransmission((value) => ({ ...value, tradingPartnerServiceId: event.target.value }))} /></label>
            <label><span>Subscriber member ID</span><input value={draft.transmission.subscriber.memberId} onChange={(event) => updateTransmission((value) => ({ ...value, subscriber: { ...value.subscriber, memberId: event.target.value } }))} /></label>
            <label><span>Subscriber first name</span><input value={draft.transmission.subscriber.firstName} onChange={(event) => updateTransmission((value) => ({ ...value, subscriber: { ...value.subscriber, firstName: event.target.value } }))} /></label>
            <label><span>Subscriber last name</span><input value={draft.transmission.subscriber.lastName} onChange={(event) => updateTransmission((value) => ({ ...value, subscriber: { ...value.subscriber, lastName: event.target.value } }))} /></label>
            <label><span>Subscriber DOB</span><input type="date" value={draft.transmission.subscriber.dateOfBirth} onChange={(event) => updateTransmission((value) => ({ ...value, subscriber: { ...value.subscriber, dateOfBirth: event.target.value } }))} /></label>
            <label><span>Subscriber gender</span><select value={draft.transmission.subscriber.gender} onChange={(event) => updateTransmission((value) => ({ ...value, subscriber: { ...value.subscriber, gender: event.target.value as "M" | "F" | "U" } }))}><option value="M">Male</option><option value="F">Female</option><option value="U">Unknown</option></select></label>
            <label><span>Billing tax ID</span><input value={draft.transmission.billing.employerId} onChange={(event) => updateTransmission((value) => ({ ...value, billing: { ...value.billing, employerId: event.target.value } }))} /></label>
            <label><span>Billing taxonomy</span><input value={draft.transmission.billing.taxonomyCode} onChange={(event) => updateTransmission((value) => ({ ...value, billing: { ...value.billing, taxonomyCode: event.target.value } }))} /></label>
          </div>
        </section>
      ) : null}

      {state.message ? <div className={`ri-correction-message is-${state.status}`}>{state.status === "error" ? <AlertTriangle size={16} /> : state.status === "success" ? <CheckCircle2 size={16} /> : <RotateCcw size={16} />}<span>{state.message}</span></div> : null}
      <div className="ri-correction-actions">
        <button type="button" className="ri-secondary-action" onClick={onCancel} disabled={state.status === "saving"}>Cancel</button>
        <button type="button" className="ri-primary-action" onClick={save} disabled={state.status === "saving" || draft.reason.trim().length < 5}>
          {state.status === "saving" ? <RotateCcw className="ri-spin" size={16} /> : <Save size={16} />}
          {state.status === "saving" ? "Saving..." : isOptum ? "Save & revalidate" : "Save correction"}
        </button>
      </div>
    </div>
  );
}
