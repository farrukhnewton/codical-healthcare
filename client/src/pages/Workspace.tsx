import { useMemo, useState, useRef, type CSSProperties } from "react";
import { motion } from "framer-motion";
import {
  Upload, FileText, Copy, Check, ClipboardCheck, Download,
  AlertCircle, ChevronDown, ChevronUp, Zap, Brain,
  Hash, Activity, Pill, MapPin, BookOpen, X,
  Building2, ChevronRight, ShieldCheck
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { SavedAiFilesLibrary } from "@/components/saved-ai/SavedAiFilesLibrary";
import { writeClaimValidatorHandoff } from "@/lib/claim-validator-handoff";

interface CodeResult {
  code: string; description: string; units?: number;
  modifiers?: string[]; rationale?: string; type?: string;
}

type CoverageStatus = "covered" | "noncovered" | "mixed" | "not_found";

interface CoverageValidationPair {
  icdCode: string;
  procedureCode: string;
  status: CoverageStatus;
  searchedDocumentCount: number;
  evidenceCount: number;
  coveredEvidenceCount: number;
  noncoveredEvidenceCount: number;
  topEvidence: {
    displayId: string;
    articleId: string;
    title: string;
    groupNumber: string;
    effectiveDate: string | null;
    endDate: string | null;
  } | null;
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
  modifierAllowed?: boolean;
  effective_date?: string | null;
  deletion_date?: string | null;
  rationale?: string | null;
  source?: string;
  type: string;
}

interface NcciValidationResult {
  source: string;
  type: string;
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

interface AnalysisResult {
  summary: string;
  cpt_codes: CodeResult[];
  icd10_codes: CodeResult[];
  hcpcs_codes: CodeResult[];
  pos_code: { code: string; description: string };
  revenue_codes: CodeResult[];
  billing_notes: string;
  confidence: string;
  disclaimer: string;
  coverage_validation?: CoverageValidationResult;
  ncci_validation?: NcciValidationResult;
  claim_validation?: unknown | null;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="workspace-code-copy"
      aria-label={`Copy ${text}`}
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
    >
      {copied ? <Check size={12} color="#16A34A" /> : <Copy size={12} />}
    </button>
  );
}

function CodeBadge({ code, color, bg }: { code: string; color: string; bg: string }) {
  return (
    <span
      className="workspace-code-badge"
      style={{ "--code-color": color, "--code-bg": bg } as CSSProperties}
    >
      {code}
    </span>
  );
}

function Section({ title, icon: Icon, color, children, count }: any) {
  const [open, setOpen] = useState(true);
  if (!count) return null;
  return (
    <div
      className="workspace-result-section"
      style={{ "--section-color": color } as CSSProperties}
    >
      <button type="button" onClick={() => setOpen(o => !o)} className="workspace-result-toggle">
        <div className="workspace-section-icon">
          <Icon size={14} color={color} />
        </div>
        <span>{title}</span>
        <strong>{count}</strong>
        {open ? <ChevronUp size={14} color="#94A3B8" /> : <ChevronDown size={14} color="#94A3B8" />}
      </button>
      {open && <div className="workspace-result-body">{children}</div>}
    </div>
  );
}

function coverageStatusMeta(status: CoverageStatus) {
  if (status === "covered") return { label: "Covered", color: "#15803D", bg: "#F0FDF4", border: "#BBF7D0" };
  if (status === "noncovered") return { label: "Noncovered", color: "#B91C1C", bg: "#FEF2F2", border: "#FECACA" };
  if (status === "mixed") return { label: "Mixed", color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" };
  return { label: "No coverage evidence", color: "#475569", bg: "#F8FAFC", border: "#CBD5E1" };
}

function ncciStatusMeta(pair: NcciValidationPair) {
  if (!pair.hasEdit) return { label: "No edit", color: "#15803D", bg: "#F0FDF4", border: "#BBF7D0" };
  if (pair.modifierAllowed) return { label: "Edit - modifier allowed", color: "#B45309", bg: "#FFFBEB", border: "#FDE68A" };
  return { label: "Edit - modifier not allowed", color: "#B91C1C", bg: "#FEF2F2", border: "#FECACA" };
}

function formatCodingReport(result: AnalysisResult) {
  const coverageValidation = result.coverage_validation;
  const ncciValidation = result.ncci_validation;
  const lines = [
    "CODICAL HEALTH - OP REPORT CODING REPORT",
    "Generated: " + new Date().toLocaleString(),
    "",
    "SUMMARY:",
    result.summary,
    "",
    "CPT CODES:",
    ...(result.cpt_codes || []).map(c => `${c.code} x${c.units || 1}${c.modifiers?.length ? " -" + c.modifiers.join("-") : ""} | ${c.description}${c.rationale ? ` | ${c.rationale}` : ""}`),
    "",
    ...(ncciValidation
      ? [
          "NCCI PROCEDURE EDITS:",
          `Pairs checked: ${ncciValidation.pairCount} | Edits: ${ncciValidation.counts.edits} | Modifier allowed: ${ncciValidation.counts.modifierAllowed} | Modifier not allowed: ${ncciValidation.counts.modifierNotAllowed} | No edit: ${ncciValidation.counts.noEdit}`,
          ...ncciValidation.pairs.map(pair => `${pair.inputCol1} + ${pair.inputCol2}: ${ncciStatusMeta(pair).label}${pair.rationale ? ` | ${pair.rationale}` : ""}`),
          "",
        ]
      : []),
    "ICD-10 CODES:",
    ...(result.icd10_codes || []).map(c => `${c.code}${c.type ? ` (${c.type})` : ""} | ${c.description}${c.rationale ? ` | ${c.rationale}` : ""}`),
    "",
    ...(coverageValidation
      ? [
          "CMS COVERAGE EVIDENCE:",
          `Pairs checked: ${coverageValidation.pairCount} | Covered: ${coverageValidation.counts.covered} | Noncovered: ${coverageValidation.counts.noncovered} | Mixed: ${coverageValidation.counts.mixed} | No coverage evidence: ${coverageValidation.counts.notFound}`,
          ...coverageValidation.pairs.map(pair => {
            const topEvidence = pair.topEvidence
              ? ` | ${pair.topEvidence.displayId} group ${pair.topEvidence.groupNumber}: ${pair.topEvidence.title}`
              : "";
            return `${pair.procedureCode} + ${pair.icdCode}: ${coverageStatusMeta(pair.status).label} | evidence rows: ${pair.evidenceCount}${topEvidence}`;
          }),
          "",
        ]
      : []),
    "HCPCS CODES:",
    ...(result.hcpcs_codes || []).map(c => `${c.code} x${c.units || 1} | ${c.description}${c.rationale ? ` | ${c.rationale}` : ""}`),
    "",
    "PLACE OF SERVICE:",
    `${result.pos_code?.code || ""} - ${result.pos_code?.description || ""}`,
    "",
    "REVENUE CODES:",
    ...(result.revenue_codes || []).map(c => `${c.code} | ${c.description}${c.rationale ? ` | ${c.rationale}` : ""}`),
    "",
    "BILLING NOTES:",
    result.billing_notes,
    "",
    "CONFIDENCE:",
    result.confidence,
    "",
    "DISCLAIMER:",
    result.disclaimer,
  ];

  return lines.join("\n");
}

function getCodeValues(codes?: CodeResult[]) {
  return (codes || []).map((code) => code.code).filter(Boolean);
}

export function Workspace() {
  const [, setLocation] = useLocation();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [loadingMsg, setLoadingMsg] = useState("");
  const [selectedPayerId, setSelectedPayerId] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: payers } = useQuery({
    queryKey: ["/api/payers"],
    queryFn: async () => {
      const res = await fetch("/api/payers");
      return res.json();
    }
  });

  const selectedPayer = useMemo(
    () => payers?.find((payer: any) => payer.id.toString() === selectedPayerId),
    [payers, selectedPayerId],
  );

  const currentSavedFile = useMemo(() => {
    if (!result) return null;

    const datePart = new Date().toLocaleDateString();
    const primaryProcedure = result.cpt_codes?.[0]?.description || result.summary?.slice(0, 60) || "OP report";
    const payerPart = selectedPayer?.shortName ? ` - ${selectedPayer.shortName}` : "";

    return {
      fileName: `OP coding report - ${primaryProcedure}${payerPart} - ${datePart}`,
      patientName: "",
      content: formatCodingReport(result),
      sourceText: text,
      structuredData: {
        result,
        payerId: selectedPayerId || null,
        payerName: selectedPayer?.name || null,
      },
    };
  }, [result, selectedPayer, selectedPayerId, text]);

  const claimValidatorCodeSet = useMemo(() => {
    if (!result) return { diagnosisCodes: [], procedureCodes: [] };

    return {
      diagnosisCodes: getCodeValues(result.icd10_codes),
      procedureCodes: [
        ...getCodeValues(result.cpt_codes),
        ...getCodeValues(result.hcpcs_codes),
      ],
    };
  }, [result]);

  const canOpenClaimValidator = claimValidatorCodeSet.diagnosisCodes.length > 0 || claimValidatorCodeSet.procedureCodes.length > 0;

  const LOADING_MSGS = [
    "Reading clinical document...",
    "Identifying procedures and diagnoses...",
    "Mapping to CPT codes...",
    "Assigning ICD-10 codes...",
    "Checking modifier requirements...",
    "Finalizing code set...",
  ];

  const handleFile = async (f: File) => {
    setFile(f);
    setError("");
    setResult(null);
    setLoading(true);
    setLoadingMsg("Reading clinical document...");

    try {
      const formData = new FormData();
      formData.append("file", f);

      const res = await fetch(`${window.location.origin}/api/workspace/extract-text`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const raw = await res.text();
      let data: any = null;

      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        throw new Error("Server returned an invalid response.");
      }

      if (!res.ok || !data?.success) {
        setError(data?.message || "Failed to read uploaded file.");
        setText("");
      } else {
        setText(data.text || "");
      }
    } catch (error: any) {
      setError(error?.message || "Failed to upload and read file.");
      setText("");
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const analyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    let msgIdx = 0;
    setLoadingMsg(LOADING_MSGS[0]);
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % LOADING_MSGS.length;
      setLoadingMsg(LOADING_MSGS[msgIdx]);
    }, 1800);
    try {
      const res = await fetch(`${window.location.origin}/api/workspace/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text, payerId: selectedPayerId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "Analysis failed. Please try again.");
      } else {
        setResult(data.result);
      }
    } catch {
      setError("Network error. Please check your connection.");
    }
    clearInterval(interval);
    setLoading(false);
  };

  const exportCodes = () => {
    if (!result) return;
    const blob = new Blob([formatCodingReport(result)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "coding-report.txt"; a.click();
  };

  const openClaimValidator = () => {
    if (!result || !canOpenClaimValidator) return;

    const written = writeClaimValidatorHandoff({
      source: "workspace",
      sourceLabel: "Coding Assistant",
      diagnosisCodes: claimValidatorCodeSet.diagnosisCodes,
      procedureCodes: claimValidatorCodeSet.procedureCodes,
      ncciType: "practitioner",
      result: result.claim_validation || null,
    });

    if (written) setLocation("/claim-validator");
  };

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const canAnalyze = text.trim().length >= 20 && !loading;
  const payerLabel = selectedPayer?.shortName || "Standard";
  const workflowSteps = [
    { label: "Extract", detail: "Upload or paste clinical note.", active: !result },
    { label: "Review", detail: "Review suggested codes and details.", active: Boolean(result) },
    { label: "Validate", detail: "Open claim validation when ready.", active: canOpenClaimValidator },
    { label: "Save", detail: "Save report to the library.", active: Boolean(currentSavedFile) },
  ];

  return (
    <div className="tool-page assistant-workspace-page workspace-page">
      <section className="tool-panel tool-page-header workspace-hero">
        <div className="workspace-hero-title">
          <span className="workspace-hero-icon"><Brain size={19} /></span>
          <div>
            <h1>Coding Assistant</h1>
            <p>Paste or upload a clinical document to draft CPT, ICD-10, and HCPCS code suggestions.</p>
          </div>
        </div>
        <div className="search-header-meta">
          <span>{payerLabel} context</span>
          <span>{result ? "Review ready" : loading ? "Analyzing" : "Draft mode"}</span>
        </div>
      </section>

      <section className="tool-panel workspace-context-panel">
        <div className="tool-section-head">
          <div>
            <h2>
              <Building2 size={17} />
              Payer context
            </h2>
            <p>Choose the policy set to include while generating coding suggestions.</p>
          </div>
          <ShieldCheck size={17} />
        </div>
        <div className="workspace-payer-scroll" role="list" aria-label="Payer context options">
          <button
            type="button"
            className={selectedPayerId === "" ? "is-active" : ""}
            onClick={() => setSelectedPayerId("")}
          >
            Standard
            <span>CMS</span>
          </button>
          {payers?.map((payer: any) => (
            <button
              type="button"
              key={payer.id}
              className={selectedPayerId === payer.id.toString() ? "is-active" : ""}
              onClick={() => setSelectedPayerId(payer.id.toString())}
            >
              {payer.shortName}
              <span>{payer.type || "Payer"}</span>
            </button>
          ))}
        </div>
        <div className="tool-callout compact" data-tone="info">
          <ClipboardCheck size={15} />
          Certified coder review required before final submission.
        </div>
      </section>

      <section className="workspace-assistant-grid">
        <div className="tool-panel workspace-note-panel">
          {loading && <div className="co-scan-line" />}
          <div className="tool-section-head">
            <div>
              <h2>
                <FileText size={17} />
                Clinical Note
              </h2>
              <p>Upload a document or paste note text directly.</p>
            </div>
          </div>

          <div
            role="button"
            tabIndex={0}
            className={file ? "workspace-upload-card has-file" : "workspace-upload-card"}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => !text && fileRef.current?.click()}
            onKeyDown={e => {
              if (!text && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                fileRef.current?.click();
              }
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.pdf,.doc,.docx"
              className="workspace-file-input"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {file ? (
              <>
                <FileText size={18} />
                <span>{file.name}</span>
                <button
                  type="button"
                  className="tool-icon-action"
                  aria-label="Remove uploaded file"
                  onClick={e => { e.stopPropagation(); setFile(null); setText(""); }}
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <Upload size={24} />
                <strong>Drop file here or click to upload</strong>
                <span>TXT, PDF, DOC supported</span>
              </>
            )}
          </div>

          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={`Paste clinical documentation here...

Example:
PROCEDURE: Laparoscopic cholecystectomy
DIAGNOSIS: Acute cholecystitis with cholelithiasis
ANESTHESIA: General`}
            className="workspace-note-input"
          />

          <div className="workspace-note-footer">
            <span>{text.length > 0 ? `${wordCount} words | ${text.length.toLocaleString()} characters` : "0 words"}</span>
            <div className="workspace-note-actions">
              {text && (
                <button type="button" onClick={() => { setText(""); setFile(null); setResult(null); setError(""); }} className="tool-secondary-button">
                  Clear
                </button>
              )}
              <motion.button
                type="button"
                onClick={analyze}
                disabled={!canAnalyze}
                whileHover={{ scale: canAnalyze ? 1.02 : 1 }}
                whileTap={{ scale: canAnalyze ? 0.98 : 1 }}
                className="tool-primary-button"
              >
                {loading ? <span className="tool-spinner" /> : <ClipboardCheck size={16} />}
                {loading ? "Analyzing..." : "Analyze note"}
              </motion.button>
            </div>
          </div>
        </div>

        <div className="tool-panel workspace-ai-panel workspace-ai-output-panel">
          <div className="workspace-ai-panel-header">
            <div>
              <span className="workspace-ai-eyebrow">Suggested Coding</span>
              <h2>Review window</h2>
            </div>
            <span className="workspace-ai-pill">{result ? "Complete" : loading ? "Scanning" : "Waiting"}</span>
          </div>

          <div className="workspace-output-list">
            {result ? (
              <>
                {(result.cpt_codes || []).slice(0, 2).map((code) => (
                  <div className="workspace-output-item" key={`cpt-${code.code}`}>
                    <small>Suggested CPT</small>
                    <strong>{code.code}</strong>
                    <span>{code.description}</span>
                  </div>
                ))}
                {(result.icd10_codes || []).slice(0, 2).map((code) => (
                  <div className="workspace-output-item" key={`icd-${code.code}`}>
                    <small>Possible ICD-10</small>
                    <strong>{code.code}</strong>
                    <span>{code.description}</span>
                  </div>
                ))}
                <div className="workspace-output-item">
                  <small>Coder review</small>
                  <span>{result.billing_notes || "Review suggested codes, payer context, and documentation requirements before final billing."}</span>
                </div>
              </>
            ) : (
              [
                ["CPT", loading ? loadingMsg : "No codes yet"],
                ["ICD-10-CM", "Diagnoses and indications appear here"],
                ["HCPCS Level II", "Supplies and services appear here"],
                ["POS", "Place of service appears here"],
              ].map(([label, value], index) => (
                <div className="workspace-output-item" key={label} style={{ animationDelay: `${index * 90}ms` }}>
                  <small>{label}</small>
                  <span>{value}</span>
                </div>
              ))
            )}
          </div>

          <div className="tool-callout compact" data-tone="warning">
            <ShieldCheck size={15} />
            Certified coder review required before submission.
          </div>
        </div>

        <aside className="tool-panel workspace-flow-rail" aria-label="Coding workflow">
          {workflowSteps.map((step, index) => (
            <div key={step.label} className={step.active ? "is-active" : ""}>
              <strong>{index + 1}</strong>
              <span>{step.label}</span>
              <small>{step.detail}</small>
            </div>
          ))}
        </aside>
      </section>

      {/* Loading state */}
      {loading && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="tool-panel workspace-progress-panel">
          <span className="tool-spinner dark" />
          <strong>Document analysis is running</strong>
          <span>{loadingMsg}</span>
          <small>This may take 10-20 seconds for complex documents.</small>
        </motion.div>
      )}

      {/* Error state */}
      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tool-callout" data-tone="danger">
          <AlertCircle size={18} />
          <div>
            <strong>Analysis failed</strong>
            <span>{error}</span>
          </div>
        </motion.div>
      )}

      {/* Results */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="workspace-results-stack">

          {/* Result header */}
          <div className="tool-panel workspace-result-hero">
            <div className="workspace-result-hero-head">
              <div>
                <div className="workspace-result-kicker">
                  <Zap size={16} />
                  <span>Coding review ready</span>
                  <strong className={result.confidence === "high" ? "is-success" : "is-warning"}>
                    {result.confidence?.toUpperCase()} CONFIDENCE
                  </strong>
                </div>
                <p>{result.summary}</p>
              </div>
              <div className="workspace-result-actions">
                {canOpenClaimValidator && (
                  <button type="button" onClick={openClaimValidator} className="tool-secondary-button">
                    <ClipboardCheck size={14} /> Claim Validator
                  </button>
                )}
                <button type="button" onClick={exportCodes} className="tool-secondary-button">
                  <Download size={14} /> Export
                </button>
              </div>
            </div>

            {/* Quick stats */}
            <div className="workspace-result-metrics">
              {[
                { label: "CPT Codes", value: result.cpt_codes?.length || 0, color: "#4ADE80" },
                { label: "ICD-10 Codes", value: result.icd10_codes?.length || 0, color: "#60A5FA" },
                { label: "HCPCS Codes", value: result.hcpcs_codes?.length || 0, color: "#F59E0B" },
                { label: "POS", value: result.pos_code?.code || "-", color: "#C084FC" },
              ].map((s, i) => (
                <div key={i} style={{ "--metric-color": s.color } as CSSProperties}>
                  <strong>{s.value}</strong>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CPT Codes */}
          <Section title="CPT Codes" icon={Hash} color="#16A34A" count={result.cpt_codes?.length}>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingTop: "12px" }}>
              {result.cpt_codes?.map((c, i) => (
                <div key={i} style={{ padding: "14px", background: "rgba(255,255,255,0.4)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.7)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                    <CodeBadge code={c.code} color="#16A34A" bg="#F0FDF4" />
                    <CopyBtn text={c.code} />
                    {c.units && c.units > 1 && <span style={{ fontSize: "11px", padding: "1px 7px", background: "#FFF7ED", color: "#EA580C", borderRadius: "4px", fontWeight: 700 }}>x{c.units} units</span>}
                    {c.modifiers?.map(m => (
                      <span key={m} style={{ fontSize: "11px", padding: "1px 7px", background: "#F5F3FF", color: "#7C3AED", borderRadius: "4px", fontWeight: 700 }}>-{m}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary, #111827)", marginBottom: "4px" }}>{c.description}</div>
                  {c.rationale && <div style={{ fontSize: "12px", color: "var(--text-secondary, #4B5563)", fontStyle: "italic" }}>{c.rationale}</div>}
                </div>
              ))}
            </div>
          </Section>

          {/* NCCI Procedure Edits */}
          {result.ncci_validation && (
            <Section title="NCCI Procedure Edits" icon={AlertCircle} color="#B91C1C" count={result.ncci_validation.pairCount}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingTop: "12px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))", gap: "8px" }}>
                  {[
                    { label: "Edits", value: result.ncci_validation.counts.edits, color: "#B91C1C", bg: "#FEF2F2" },
                    { label: "Modifier OK", value: result.ncci_validation.counts.modifierAllowed, color: "#B45309", bg: "#FFFBEB" },
                    { label: "No Modifier", value: result.ncci_validation.counts.modifierNotAllowed, color: "#B91C1C", bg: "#FEF2F2" },
                    { label: "No Edit", value: result.ncci_validation.counts.noEdit, color: "#15803D", bg: "#F0FDF4" },
                  ].map((item) => (
                    <div key={item.label} style={{ padding: "10px 12px", background: item.bg, borderRadius: "10px", border: "1px solid rgba(15,23,42,0.08)" }}>
                      <div style={{ fontSize: "18px", fontWeight: 900, color: item.color }}>{item.value}</div>
                      <div style={{ fontSize: "10px", fontWeight: 800, color: item.color, textTransform: "uppercase", marginTop: "1px" }}>{item.label}</div>
                    </div>
                  ))}
                </div>

                {result.ncci_validation.pairs.map((pair) => {
                  const status = ncciStatusMeta(pair);
                  return (
                    <div key={`${pair.inputCol1}-${pair.inputCol2}`} style={{ padding: "14px", background: "rgba(255,255,255,0.4)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.7)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "7px" }}>
                        <CodeBadge code={pair.inputCol1} color="#16A34A" bg="#F0FDF4" />
                        <ChevronRight size={13} color="#94A3B8" />
                        <CodeBadge code={pair.inputCol2} color="#16A34A" bg="#F0FDF4" />
                        <span style={{ padding: "2px 8px", background: status.bg, color: status.color, border: `1px solid ${status.border}`, borderRadius: "999px", fontSize: "10px", fontWeight: 800, textTransform: "uppercase" }}>
                          {status.label}
                        </span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary, #4B5563)", lineHeight: 1.5 }}>
                        {pair.message}
                        {pair.rationale ? ` ${pair.rationale}` : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* ICD-10 Codes */}
          <Section title="ICD-10-CM Diagnosis Codes" icon={Activity} color="#0369A1" count={result.icd10_codes?.length}>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingTop: "12px" }}>
              {result.icd10_codes?.map((c, i) => (
                <div key={i} style={{ padding: "14px", background: "rgba(255,255,255,0.4)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.7)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                    <CodeBadge code={c.code} color="#0369A1" bg="#EFF6FF" />
                    <CopyBtn text={c.code} />
                    {c.type && <span style={{ fontSize: "10px", padding: "1px 7px", background: c.type === "primary" ? "#FEF3C7" : "#F1F5F9", color: c.type === "primary" ? "#D97706" : "#64748B", borderRadius: "4px", fontWeight: 700, textTransform: "uppercase" }}>{c.type}</span>}
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary, #111827)", marginBottom: "4px" }}>{c.description}</div>
                  {c.rationale && <div style={{ fontSize: "12px", color: "var(--text-secondary, #4B5563)", fontStyle: "italic" }}>{c.rationale}</div>}
                </div>
              ))}
            </div>
          </Section>

          {/* CMS Coverage Evidence */}
          {result.coverage_validation && (
            <Section title="CMS Coverage Evidence" icon={AlertCircle} color="#B45309" count={result.coverage_validation.pairCount}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingTop: "12px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))", gap: "8px" }}>
                  {[
                    { label: "Covered", value: result.coverage_validation.counts.covered, color: "#15803D", bg: "#F0FDF4" },
                    { label: "Noncovered", value: result.coverage_validation.counts.noncovered, color: "#B91C1C", bg: "#FEF2F2" },
                    { label: "Mixed", value: result.coverage_validation.counts.mixed, color: "#7C3AED", bg: "#F5F3FF" },
                    { label: "No Evidence", value: result.coverage_validation.counts.notFound, color: "#475569", bg: "#F8FAFC" },
                  ].map((item) => (
                    <div key={item.label} style={{ padding: "10px 12px", background: item.bg, borderRadius: "10px", border: "1px solid rgba(15,23,42,0.08)" }}>
                      <div style={{ fontSize: "18px", fontWeight: 900, color: item.color }}>{item.value}</div>
                      <div style={{ fontSize: "10px", fontWeight: 800, color: item.color, textTransform: "uppercase", marginTop: "1px" }}>{item.label}</div>
                    </div>
                  ))}
                </div>

                {result.coverage_validation.pairs.map((pair) => {
                  const status = coverageStatusMeta(pair.status);
                  return (
                    <div key={`${pair.procedureCode}-${pair.icdCode}`} style={{ padding: "14px", background: "rgba(255,255,255,0.4)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.7)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "7px" }}>
                        <CodeBadge code={pair.procedureCode} color="#16A34A" bg="#F0FDF4" />
                        <ChevronRight size={13} color="#94A3B8" />
                        <CodeBadge code={pair.icdCode} color="#0369A1" bg="#EFF6FF" />
                        <span style={{ padding: "2px 8px", background: status.bg, color: status.color, border: `1px solid ${status.border}`, borderRadius: "999px", fontSize: "10px", fontWeight: 800, textTransform: "uppercase" }}>
                          {status.label}
                        </span>
                        {pair.evidenceCount > 0 && (
                          <span style={{ fontSize: "11px", color: "#475569", fontWeight: 700 }}>
                            {pair.evidenceCount} evidence rows
                          </span>
                        )}
                      </div>
                      {pair.topEvidence && (
                        <div style={{ fontSize: "12px", color: "var(--text-secondary, #4B5563)", lineHeight: 1.5 }}>
                          <strong style={{ color: "#92400E" }}>{pair.topEvidence.displayId}</strong>
                          {" group "}{pair.topEvidence.groupNumber} - {pair.topEvidence.title}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* HCPCS Codes */}
          <Section title="HCPCS Level II Codes" icon={Pill} color="#EA580C" count={result.hcpcs_codes?.length}>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingTop: "12px" }}>
              {result.hcpcs_codes?.map((c, i) => (
                <div key={i} style={{ padding: "14px", background: "rgba(255,255,255,0.4)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.7)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <CodeBadge code={c.code} color="#EA580C" bg="#FFF7ED" />
                    <CopyBtn text={c.code} />
                    {c.units && c.units > 1 && <span style={{ fontSize: "11px", padding: "1px 7px", background: "#FFF7ED", color: "#EA580C", borderRadius: "4px", fontWeight: 700 }}>x{c.units} units</span>}
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary, #111827)", marginBottom: "4px" }}>{c.description}</div>
                  {c.rationale && <div style={{ fontSize: "12px", color: "var(--text-secondary, #4B5563)", fontStyle: "italic" }}>{c.rationale}</div>}
                </div>
              ))}
            </div>
          </Section>

          {/* POS & Revenue */}
          {(result.pos_code || result.revenue_codes?.length > 0) && (
            <div style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.7)", padding: "18px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted, #6B7280)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <MapPin size={11} /> Place of Service & Revenue Codes
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {result.pos_code && (
                  <div style={{ padding: "10px 14px", background: "#F5F3FF", borderRadius: "10px", border: "1px solid #DDD6FE" }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "#7C3AED", marginBottom: "3px" }}>PLACE OF SERVICE</div>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#6D28D9", fontFamily: "monospace" }}>{result.pos_code.code}</div>
                    <div style={{ fontSize: "11px", color: "#7C3AED" }}>{result.pos_code.description}</div>
                  </div>
                )}
                {result.revenue_codes?.map((r, i) => (
                  <div key={i} style={{ padding: "10px 14px", background: "#FFF7ED", borderRadius: "10px", border: "1px solid #FED7AA" }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "#EA580C", marginBottom: "3px" }}>REVENUE CODE</div>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#C2410C", fontFamily: "monospace" }}>{r.code}</div>
                    <div style={{ fontSize: "11px", color: "#EA580C" }}>{r.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Billing notes */}
          {result.billing_notes && (
            <div style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.7)", padding: "18px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted, #6B7280)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                <BookOpen size={11} /> Billing Notes & Considerations
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-secondary, #4B5563)", lineHeight: 1.6 }}>{result.billing_notes}</div>
            </div>
          )}

          {/* Review note */}
          <div style={{ padding: "12px 16px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "12px", fontSize: "11px", color: "#92400E", lineHeight: 1.5 }}>
            <strong>Review note:</strong> {result.disclaimer}
          </div>
        </motion.div>
      )}

      <div style={{ marginTop: "20px" }}>
        <SavedAiFilesLibrary
          module="op_report_coding"
          title="Saved OP Coding Reports"
          description="Save generated OP report coding outputs for 30 days, rename them, edit report text, and download permanent PDFs."
          currentFile={currentSavedFile}
        />
      </div>

      <style dangerouslySetInnerHTML={{ __html: "@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}" }} />
    </div>
  );
}
