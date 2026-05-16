import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Download,
  FileText,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
} from "lucide-react";
import { SavedAiFilesLibrary } from "@/components/saved-ai/SavedAiFilesLibrary";
import type { SavedAiFile } from "@/lib/saved-ai-files";
import { useToast } from "@/hooks/use-toast";
import { consumeClaimValidatorHandoff } from "@/lib/claim-validator-handoff";

type NcciType = "practitioner" | "outpatient";
type CoverageStatus = "covered" | "noncovered" | "mixed" | "not_found";

interface CoverageEvidence {
  displayId: string;
  articleId?: string;
  title: string;
  groupNumber: string;
  effectiveDate?: string | null;
  endDate?: string | null;
}

interface CoverageValidationPair {
  icdCode: string;
  procedureCode: string;
  status: CoverageStatus;
  searchedDocumentCount: number;
  evidenceCount: number;
  coveredEvidenceCount: number;
  noncoveredEvidenceCount: number;
  topEvidence: CoverageEvidence | null;
}

interface CoverageValidationResult {
  source: string;
  diagnosisCodes: string[];
  procedureCodes: string[];
  pairCount: number;
  counts: {
    covered: number;
    noncovered: number;
    mixed: number;
    notFound: number;
    evidence: number;
  };
  pairs: CoverageValidationPair[];
}

interface NcciValidationPair {
  inputCol1: string;
  inputCol2: string;
  hasEdit: boolean;
  message: string;
  modifier_indicator?: string | null;
  modifierAllowed?: boolean | string;
  effective_date?: string | null;
  deletion_date?: string | null;
  rationale?: string | null;
  source?: string;
  type: string;
}

interface NcciValidationResult {
  source: string;
  type: NcciType;
  codes: string[];
  pairCount: number;
  counts: {
    edits: number;
    modifierAllowed: number;
    modifierNotAllowed: number;
    noEdit: number;
  };
  pairs: NcciValidationPair[];
}

interface ClaimValidationResult {
  source: string;
  diagnosisCodes: string[];
  procedureCodes: string[];
  ncciType: NcciType;
  coverageValidation: CoverageValidationResult | null;
  ncciValidation: NcciValidationResult | null;
  warnings: string[];
  summary: {
    diagnosisCodeCount: number;
    procedureCodeCount: number;
    coveragePairCount: number;
    coverageEvidenceCount: number;
    noncoveredPairCount: number;
    ncciPairCount: number;
    ncciEditCount: number;
    ncciModifierNotAllowedCount: number;
  };
}

const EXAMPLE = {
  diagnosisCodes: "M17.0 E11.9",
  procedureCodes: "29877 99214 99213",
};

function splitCodes(value: string) {
  const seen = new Set<string>();
  const codes: string[] = [];

  for (const item of value.split(/[\s,;]+/)) {
    const code = item.trim().toUpperCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
    if (codes.length >= 8) break;
  }

  return codes;
}

function isModifierAllowed(pair: NcciValidationPair) {
  return pair.modifierAllowed === true || pair.modifierAllowed === "1" || pair.modifier_indicator === "1";
}

function coverageStatusMeta(status: CoverageStatus) {
  if (status === "covered") return { label: "Covered", color: "#15803D", bg: "#F0FDF4", border: "#BBF7D0" };
  if (status === "noncovered") return { label: "Noncovered", color: "#B91C1C", bg: "#FEF2F2", border: "#FECACA" };
  if (status === "mixed") return { label: "Mixed", color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" };
  return { label: "No coverage evidence", color: "#475569", bg: "#F8FAFC", border: "#CBD5E1" };
}

function ncciStatusMeta(pair: NcciValidationPair) {
  if (!pair.hasEdit) return { label: "No edit", color: "#15803D", bg: "#F0FDF4", border: "#BBF7D0" };
  if (isModifierAllowed(pair)) return { label: "Edit - modifier allowed", color: "#B45309", bg: "#FFFBEB", border: "#FDE68A" };
  return { label: "Edit - modifier not allowed", color: "#B91C1C", bg: "#FEF2F2", border: "#FECACA" };
}

function formatDateTime(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return safeDate.toLocaleString();
}

function getReportFileName(result: ClaimValidationResult, extension: "txt" | "json") {
  const codePart = [
    ...result.procedureCodes.slice(0, 3),
    ...result.diagnosisCodes.slice(0, 2),
  ].join("-");
  const safeCodePart = (codePart || "claim-validation").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return `claim-validation-${safeCodePart}.${extension}`;
}

function formatClaimValidationReport(result: ClaimValidationResult, generatedAt?: string | null) {
  const lines = [
    "CODICAL HEALTH - CLAIM VALIDATION REPORT",
    `Generated: ${formatDateTime(generatedAt)}`,
    `Source: ${result.source}`,
    `NCCI type: ${result.ncciType}`,
    "",
    "CODE SET",
    `Diagnosis codes: ${result.diagnosisCodes.length ? result.diagnosisCodes.join(", ") : "None"}`,
    `Procedure codes: ${result.procedureCodes.length ? result.procedureCodes.join(", ") : "None"}`,
    "",
    "SUMMARY",
    `Diagnosis code count: ${result.summary.diagnosisCodeCount}`,
    `Procedure code count: ${result.summary.procedureCodeCount}`,
    `Coverage pairs checked: ${result.summary.coveragePairCount}`,
    `Coverage evidence rows: ${result.summary.coverageEvidenceCount}`,
    `Noncovered coverage pairs: ${result.summary.noncoveredPairCount}`,
    `NCCI pairs checked: ${result.summary.ncciPairCount}`,
    `NCCI edits: ${result.summary.ncciEditCount}`,
    `NCCI edits with modifier not allowed: ${result.summary.ncciModifierNotAllowedCount}`,
  ];

  if (result.warnings.length > 0) {
    lines.push("", "WARNINGS", ...result.warnings.map((warning) => `- ${warning}`));
  }

  if (result.coverageValidation) {
    const coverage = result.coverageValidation;
    lines.push(
      "",
      "CMS COVERAGE EVIDENCE",
      `Pairs checked: ${coverage.pairCount}`,
      `Covered: ${coverage.counts.covered}`,
      `Noncovered: ${coverage.counts.noncovered}`,
      `Mixed: ${coverage.counts.mixed}`,
      `No coverage evidence: ${coverage.counts.notFound}`,
      `Evidence rows: ${coverage.counts.evidence}`,
    );

    for (const pair of coverage.pairs) {
      const status = coverageStatusMeta(pair.status);
      const evidence = pair.topEvidence
        ? ` | ${pair.topEvidence.displayId} group ${pair.topEvidence.groupNumber}: ${pair.topEvidence.title}`
        : "";
      lines.push(`- ${pair.procedureCode} + ${pair.icdCode}: ${status.label} | evidence rows: ${pair.evidenceCount}${evidence}`);
    }
  }

  if (result.ncciValidation) {
    const ncci = result.ncciValidation;
    lines.push(
      "",
      "NCCI PROCEDURE EDITS",
      `Pairs checked: ${ncci.pairCount}`,
      `Edits: ${ncci.counts.edits}`,
      `Modifier allowed: ${ncci.counts.modifierAllowed}`,
      `Modifier not allowed: ${ncci.counts.modifierNotAllowed}`,
      `No edit: ${ncci.counts.noEdit}`,
    );

    for (const pair of ncci.pairs) {
      const status = ncciStatusMeta(pair);
      const rationale = pair.rationale ? ` | ${pair.rationale}` : "";
      const effective = pair.effective_date ? ` | effective ${pair.effective_date}` : "";
      lines.push(`- ${pair.inputCol1} + ${pair.inputCol2}: ${status.label} | ${pair.message}${rationale}${effective}`);
    }
  }

  lines.push(
    "",
    "REVIEW NOTE",
    "This report summarizes automated coverage and NCCI evidence for coder review. It does not replace payer-specific policy review or final professional judgment.",
  );

  return lines.join("\n");
}

function isClaimValidationResult(value: unknown): value is ClaimValidationResult {
  const candidate = value as ClaimValidationResult | null;
  return Boolean(
    candidate &&
      Array.isArray(candidate.diagnosisCodes) &&
      Array.isArray(candidate.procedureCodes) &&
      candidate.summary &&
      typeof candidate.summary === "object",
  );
}

function CodePill({ code, tone = "procedure" }: { code: string; tone?: "procedure" | "diagnosis" }) {
  return (
    <span className="tool-code-chip" data-type={tone === "procedure" ? "CPT" : "ICD"}>
      {code}
    </span>
  );
}

function StatusBadge({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return (
    <span
      className="inline-flex min-h-6 items-center rounded-full border px-2.5 text-[10px] font-black uppercase"
      style={{ color, background: bg, borderColor: border }}
    >
      {label}
    </span>
  );
}

function StatTile({ label, value, color, bg }: { label: string; value: number | string; color: string; bg: string }) {
  return (
    <div className="tool-metric-card claim-stat-tile" style={{ background: bg }}>
      <strong style={{ color }}>{value}</strong>
      <span style={{ color }}>{label}</span>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  detail,
  actions,
}: {
  icon: typeof ClipboardCheck;
  title: string;
  detail: string;
  actions?: ReactNode;
}) {
  return (
    <div className="tool-section-head claim-section-head">
      <div className="claim-section-title">
        <div className="claim-section-icon">
          <Icon size={18} />
        </div>
        <div>
          <h2>{title}</h2>
          <p>{detail}</p>
        </div>
      </div>
      {actions && <div className="claim-section-actions">{actions}</div>}
    </div>
  );
}

export function ClaimValidator() {
  const { toast } = useToast();
  const [diagnosisInput, setDiagnosisInput] = useState("");
  const [procedureInput, setProcedureInput] = useState("");
  const [ncciType, setNcciType] = useState<NcciType>("practitioner");
  const [result, setResult] = useState<ClaimValidationResult | null>(null);
  const [resultGeneratedAt, setResultGeneratedAt] = useState<string | null>(null);
  const [handoffSourceLabel, setHandoffSourceLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const diagnosisCodes = useMemo(() => splitCodes(diagnosisInput), [diagnosisInput]);
  const procedureCodes = useMemo(() => splitCodes(procedureInput), [procedureInput]);

  const coveragePairCount = diagnosisCodes.length * procedureCodes.length;
  const ncciPairCount = procedureCodes.length > 1 ? (procedureCodes.length * (procedureCodes.length - 1)) / 2 : 0;
  const canValidate = diagnosisCodes.length > 0 || procedureCodes.length > 0;
  const reportText = useMemo(
    () => (result ? formatClaimValidationReport(result, resultGeneratedAt) : ""),
    [result, resultGeneratedAt],
  );

  const currentSavedFile = useMemo(() => {
    if (!result || !reportText) return null;

    const generatedDate = resultGeneratedAt ? new Date(resultGeneratedAt) : new Date();
    const dateLabel = Number.isNaN(generatedDate.getTime()) ? new Date().toLocaleDateString() : generatedDate.toLocaleDateString();
    const codeLabel = result.procedureCodes.slice(0, 3).join(", ") || result.diagnosisCodes.slice(0, 3).join(", ") || "code set";

    return {
      fileName: `Claim validation - ${codeLabel} - ${dateLabel}`,
      patientName: "",
      content: reportText,
      sourceText: [
        `Diagnosis codes: ${result.diagnosisCodes.join(" ") || "None"}`,
        `Procedure codes: ${result.procedureCodes.join(" ") || "None"}`,
        `NCCI type: ${result.ncciType}`,
      ].join("\n"),
      structuredData: {
        result,
        generatedAt: resultGeneratedAt,
        diagnosisCodes: result.diagnosisCodes,
        procedureCodes: result.procedureCodes,
        ncciType: result.ncciType,
      },
    };
  }, [reportText, result, resultGeneratedAt]);

  useEffect(() => {
    const handoff = consumeClaimValidatorHandoff();
    if (!handoff) return;

    const handoffResult = isClaimValidationResult(handoff.result) ? handoff.result : null;

    setDiagnosisInput(handoff.diagnosisCodes.join(" "));
    setProcedureInput(handoff.procedureCodes.join(" "));
    setNcciType(handoff.ncciType);
    setResult(handoffResult);
    setResultGeneratedAt(handoffResult ? handoff.createdAt : null);
    setHandoffSourceLabel(handoff.sourceLabel);
    setError("");
    toast({
      title: "Claim codes loaded",
      description: `${handoff.sourceLabel} sent this code set to Claim Validator.`,
    });
  }, [toast]);

  const validate = async () => {
    if (!canValidate) return;
    setLoading(true);
    setResult(null);
    setError("");

    try {
      const res = await fetch("/api/claim/validate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnosisCodes,
          procedureCodes,
          ncciType,
          coverageLimit: 8,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.message || "Claim validation failed");
      else {
        setResult(data);
        setResultGeneratedAt(new Date().toISOString());
        setHandoffSourceLabel("");
      }
    } catch {
      setError("Network error. Please try again.");
    }

    setLoading(false);
  };

  const reset = () => {
    setDiagnosisInput("");
    setProcedureInput("");
    setResult(null);
    setResultGeneratedAt(null);
    setHandoffSourceLabel("");
    setError("");
  };

  const loadExample = () => {
    setDiagnosisInput(EXAMPLE.diagnosisCodes);
    setProcedureInput(EXAMPLE.procedureCodes);
    setResult(null);
    setResultGeneratedAt(null);
    setHandoffSourceLabel("");
    setError("");
  };

  const copyReport = async () => {
    if (!reportText) return;

    try {
      await navigator.clipboard.writeText(reportText);
      toast({ title: "Copied", description: "Claim validation report copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Clipboard access was not available.", variant: "destructive" });
    }
  };

  const downloadReport = () => {
    if (!result || !reportText) return;

    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = getReportFileName(result, "txt");
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const restoreSavedValidation = (file: SavedAiFile) => {
    const structuredData = file.structuredData || {};
    const savedResult = structuredData.result as ClaimValidationResult | undefined;
    const savedDiagnosisCodes = Array.isArray(structuredData.diagnosisCodes)
      ? structuredData.diagnosisCodes.map(String)
      : savedResult?.diagnosisCodes || [];
    const savedProcedureCodes = Array.isArray(structuredData.procedureCodes)
      ? structuredData.procedureCodes.map(String)
      : savedResult?.procedureCodes || [];
    const savedNcciType: NcciType = structuredData.ncciType === "outpatient" || savedResult?.ncciType === "outpatient"
      ? "outpatient"
      : "practitioner";

    if (!savedResult && savedDiagnosisCodes.length === 0 && savedProcedureCodes.length === 0) {
      toast({ title: "Cannot reuse file", description: "This saved file does not include reusable claim validation data.", variant: "destructive" });
      return;
    }

    setDiagnosisInput(savedDiagnosisCodes.join(" "));
    setProcedureInput(savedProcedureCodes.join(" "));
    setNcciType(savedNcciType);
    setResult(savedResult || null);
    setResultGeneratedAt(typeof structuredData.generatedAt === "string" ? structuredData.generatedAt : file.createdAt || new Date().toISOString());
    setHandoffSourceLabel("");
    setError("");
    toast({ title: "Loaded", description: "Saved claim validation restored to the form." });
  };

  return (
    <div className="tool-page validation-tool-page claim-validator-page">
      <div className="claim-validator-grid">
        <section className="tool-panel tool-page-header claim-validator-header">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <h1>
                Coverage and NCCI review for a claim code set
              </h1>
              <p>
                Validate diagnosis and procedure combinations against CMS coverage evidence and NCCI edits in one pass.
              </p>
            </div>
            <button className="tool-secondary-button" onClick={loadExample} type="button">
              <FileText size={16} /> Load example
            </button>
          </div>
        </section>

        <section className="tool-panel validation-input-panel claim-entry-panel">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="tool-field">
                <span>Diagnosis codes</span>
                <textarea
                  value={diagnosisInput}
                  onChange={(event) => setDiagnosisInput(event.target.value.toUpperCase())}
                  placeholder="M17.0 E11.9"
                  className="tool-textarea tool-code-textarea"
                />
              </label>

              <label className="tool-field">
                <span>Procedure codes</span>
                <textarea
                  value={procedureInput}
                  onChange={(event) => setProcedureInput(event.target.value.toUpperCase())}
                  placeholder="29877 99214 99213"
                  className="tool-textarea tool-code-textarea"
                />
              </label>
            </div>

            <aside className="claim-control-panel">
              <div>
                <div className="claim-control-label">NCCI type</div>
                <div className="tool-segmented-control claim-type-toggle">
                  {(["practitioner", "outpatient"] as const).map((type) => (
                    <button
                      key={type}
                      className={ncciType === type ? "is-active" : ""}
                      onClick={() => setNcciType(type)}
                      type="button"
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <StatTile label="DX" value={diagnosisCodes.length} color="#0369A1" bg="#EFF6FF" />
                <StatTile label="PROC" value={procedureCodes.length} color="#15803D" bg="#F0FDF4" />
                <StatTile label="Coverage pairs" value={coveragePairCount} color="#B45309" bg="#FFFBEB" />
                <StatTile label="NCCI pairs" value={ncciPairCount} color="#7C3AED" bg="#F5F3FF" />
              </div>

              <div className="tool-action-row">
                <motion.button
                  whileHover={{ scale: canValidate ? 1.01 : 1 }}
                  whileTap={{ scale: canValidate ? 0.99 : 1 }}
                  onClick={validate}
                  disabled={loading || !canValidate}
                  className="tool-primary-button"
                  type="button"
                >
                  {loading ? (
                    <span className="tool-spinner" />
                  ) : (
                    <Search size={16} />
                  )}
                  {loading ? "Validating" : "Validate"}
                </motion.button>
                {(diagnosisInput || procedureInput || result) && (
                  <button className="tool-secondary-button icon-only" onClick={reset} type="button" aria-label="Clear claim validator">
                    <RotateCcw size={16} />
                  </button>
                )}
              </div>
            </aside>
          </div>
        </section>

        {handoffSourceLabel && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="tool-callout claim-handoff-callout"
            data-tone="info"
          >
            <span className="flex items-center gap-2">
              <ClipboardCheck size={18} />
              Loaded from {handoffSourceLabel}. Review the imported codes or rerun validation.
            </span>
            <button className="tool-secondary-button" onClick={() => setHandoffSourceLabel("")} type="button">
              Dismiss
            </button>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="tool-callout"
            data-tone="danger"
          >
            <AlertTriangle size={18} /> {error}
          </motion.div>
        )}

        {result && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-5">
            <section className="tool-panel claim-result-panel">
              <SectionHeader
                icon={ClipboardCheck}
                title="Validation Summary"
                detail={`${result.summary.diagnosisCodeCount} diagnosis code(s), ${result.summary.procedureCodeCount} procedure code(s)`}
                actions={
                  <>
                    <button className="tool-secondary-button" onClick={copyReport} type="button">
                      <Copy size={15} /> Copy report
                    </button>
                    <button className="tool-secondary-button" onClick={downloadReport} type="button">
                      <Download size={15} /> TXT
                    </button>
                  </>
                }
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile label="Coverage pairs" value={result.summary.coveragePairCount} color="#B45309" bg="#FFFBEB" />
                <StatTile label="Evidence rows" value={result.summary.coverageEvidenceCount} color="#0369A1" bg="#EFF6FF" />
                <StatTile label="NCCI edits" value={result.summary.ncciEditCount} color="#B91C1C" bg="#FEF2F2" />
                <StatTile label="No modifier" value={result.summary.ncciModifierNotAllowedCount} color="#7C2D12" bg="#FFF7ED" />
              </div>
              {result.warnings.length > 0 && (
                <div className="mt-5 grid gap-2">
                  {result.warnings.map((warning) => (
                    <div key={warning} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
                      <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {warning}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {result.coverageValidation && (
              <section className="tool-panel claim-result-panel">
                <SectionHeader
                  icon={Shield}
                  title="CMS Coverage Evidence"
                  detail={`${result.coverageValidation.pairCount} diagnosis-to-procedure pair(s) checked`}
                />
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <StatTile label="Covered" value={result.coverageValidation.counts.covered} color="#15803D" bg="#F0FDF4" />
                  <StatTile label="Noncovered" value={result.coverageValidation.counts.noncovered} color="#B91C1C" bg="#FEF2F2" />
                  <StatTile label="Mixed" value={result.coverageValidation.counts.mixed} color="#7C3AED" bg="#F5F3FF" />
                  <StatTile label="No evidence" value={result.coverageValidation.counts.notFound} color="#475569" bg="#F8FAFC" />
                  <StatTile label="Evidence" value={result.coverageValidation.counts.evidence} color="#0369A1" bg="#EFF6FF" />
                </div>

                <div className="mt-5 grid gap-3">
                  {result.coverageValidation.pairs.map((pair) => {
                    const status = coverageStatusMeta(pair.status);
                    return (
                      <div key={`${pair.procedureCode}-${pair.icdCode}`} className="rounded-lg border border-[var(--co-line)] bg-white/10 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <CodePill code={pair.procedureCode} />
                          <ChevronRight size={14} className="text-[var(--co-muted)]" />
                          <CodePill code={pair.icdCode} tone="diagnosis" />
                          <StatusBadge {...status} />
                          {pair.evidenceCount > 0 && (
                            <span className="text-xs font-black text-[var(--co-muted)]">
                              {pair.evidenceCount} evidence row{pair.evidenceCount === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                        {pair.topEvidence ? (
                          <div className="mt-3 text-sm leading-6 text-[var(--co-soft)]">
                            <strong className="text-[var(--co-ink)]">{pair.topEvidence.displayId}</strong>
                            {" group "}{pair.topEvidence.groupNumber} - {pair.topEvidence.title}
                          </div>
                        ) : (
                          <div className="mt-3 text-sm text-[var(--co-muted)]">No matching Medicare coverage evidence returned for this pair.</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {result.ncciValidation && (
              <section className="tool-panel claim-result-panel">
                <SectionHeader
                  icon={ShieldAlert}
                  title="NCCI Procedure Edits"
                  detail={`${result.ncciValidation.pairCount} procedure pair(s) checked for ${result.ncciValidation.type} claims`}
                />
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile label="Edits" value={result.ncciValidation.counts.edits} color="#B91C1C" bg="#FEF2F2" />
                  <StatTile label="Modifier OK" value={result.ncciValidation.counts.modifierAllowed} color="#B45309" bg="#FFFBEB" />
                  <StatTile label="No modifier" value={result.ncciValidation.counts.modifierNotAllowed} color="#B91C1C" bg="#FEF2F2" />
                  <StatTile label="No edit" value={result.ncciValidation.counts.noEdit} color="#15803D" bg="#F0FDF4" />
                </div>

                <div className="mt-5 grid gap-3">
                  {result.ncciValidation.pairs.map((pair) => {
                    const status = ncciStatusMeta(pair);
                    return (
                      <div key={`${pair.inputCol1}-${pair.inputCol2}`} className="rounded-lg border border-[var(--co-line)] bg-white/10 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <CodePill code={pair.inputCol1} />
                          <ChevronRight size={14} className="text-[var(--co-muted)]" />
                          <CodePill code={pair.inputCol2} />
                          <StatusBadge {...status} />
                        </div>
                        <div className="mt-3 text-sm leading-6 text-[var(--co-soft)]">
                          {pair.message}
                          {pair.rationale ? ` ${pair.rationale}` : ""}
                        </div>
                        {pair.effective_date && (
                          <div className="mt-2 text-xs font-bold text-[var(--co-muted)]">
                            Effective: {pair.effective_date}
                            {pair.deletion_date && pair.deletion_date !== "20991231" ? ` | Deletion: ${pair.deletion_date}` : ""}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {!result.coverageValidation && !result.ncciValidation && (
              <section className="tool-panel claim-result-panel">
                <div className="flex items-center gap-3 text-sm font-bold text-[var(--co-muted)]">
                  <CheckCircle2 size={18} /> Validation completed with no pair-based result sections.
                </div>
              </section>
            )}
          </motion.div>
        )}

        <SavedAiFilesLibrary
          module="claim_validation"
          title="Saved Claim Validations"
          description="Save claim validation reports for 30 days, reopen prior code sets, edit report text, and download permanent PDFs."
          currentFile={currentSavedFile}
          onUseFile={restoreSavedValidation}
        />
      </div>
    </div>
  );
}
