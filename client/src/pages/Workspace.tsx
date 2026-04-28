import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileText, Sparkles, Copy, Check, Download,
  AlertCircle, ChevronDown, ChevronUp, Zap, Brain,
  Hash, Activity, Pill, MapPin, DollarSign, BookOpen, X,
  Building2, ChevronRight
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface CodeResult {
  code: string; description: string; units?: number;
  modifiers?: string[]; rationale?: string; type?: string;
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
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "var(--text-muted, #6B7280)", display: "flex" }}>
      {copied ? <Check size={12} color="#16A34A" /> : <Copy size={12} />}
    </button>
  );
}

function CodeBadge({ code, color, bg }: { code: string; color: string; bg: string }) {
  return (
    <span style={{ padding: "2px 8px", background: bg, color, borderRadius: "6px", fontSize: "12px", fontWeight: 700, fontFamily: "monospace" }}>
      {code}
    </span>
  );
}

function Section({ title, icon: Icon, color, children, count }: any) {
  const [open, setOpen] = useState(true);
  if (!count) return null;
  return (
    <div style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.7)", overflow: "hidden" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: "10px",
        padding: "14px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left",
      }}>
        <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: color + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={14} color={color} />
        </div>
        <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary, #111827)", flex: 1 }}>{title}</span>
        <span style={{ padding: "2px 8px", background: color + "15", color, borderRadius: "20px", fontSize: "11px", fontWeight: 700 }}>{count}</span>
        {open ? <ChevronUp size={14} color="#94A3B8" /> : <ChevronDown size={14} color="#94A3B8" />}
      </button>
      {open && <div style={{ padding: "0 18px 16px", borderTop: "1px solid rgba(0,0,0,0.04)" }}>{children}</div>}
    </div>
  );
}

export function Workspace() {
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
    const lines = [
      "CODICAL HEALTH - AI CODE ANALYSIS REPORT",
      "Generated: " + new Date().toLocaleString(),
      "",
      "SUMMARY:",
      result.summary,
      "",
      "CPT CODES:",
      ...(result.cpt_codes || []).map(c => `${c.code} x${c.units || 1}${c.modifiers?.length ? " -" + c.modifiers.join("-") : ""} | ${c.description}`),
      "",
      "ICD-10 CODES:",
      ...(result.icd10_codes || []).map(c => `${c.code} (${c.type}) | ${c.description}`),
      "",
      "HCPCS CODES:",
      ...(result.hcpcs_codes || []).map(c => `${c.code} x${c.units || 1} | ${c.description}`),
      "",
      "POS: " + (result.pos_code?.code || "") + " - " + (result.pos_code?.description || ""),
      "",
      "BILLING NOTES:",
      result.billing_notes,
      "",
      "DISCLAIMER:",
      result.disclaimer,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "coding-report.txt"; a.click();
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px", maxWidth: "1240px", margin: "0 auto", width: "100%" }}>

      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "linear-gradient(135deg, #15803D, #1B2F6E)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Brain size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary, #111827)", margin: 0 }}>Codical AI Coder</h1>
            <p style={{ fontSize: "13px", color: "var(--text-secondary, #4B5563)", margin: 0 }}>Paste or upload a clinical document — get CPT, ICD-10, HCPCS codes instantly</p>
          </div>
        </div>

        {/* Info banner */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.15)", borderRadius: "10px", fontSize: "12px", color: "#0369A1", marginTop: "12px" }}>
          <Sparkles size={14} color="#15803D" />
          <span>Powered by Gemini 2.5 · Professional USA Commercial Intelligence Integration · Always verify with a certified coder</span>
        </div>

        {/* Payer Selector */}
        <div style={{ marginTop: "16px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted, #6B7280)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Building2 size={11} /> Select Payer Context (Optional)
          </div>
          <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px", scrollbarWidth: "none" }}>
            <button 
              onClick={() => setSelectedPayerId("")}
              style={{
                flexShrink: 0, padding: "8px 16px", borderRadius: "10px", fontSize: "12px", fontWeight: 600,
                background: selectedPayerId === "" ? "#15803D" : "white",
                color: selectedPayerId === "" ? "white" : "#64748B",
                border: "1px solid " + (selectedPayerId === "" ? "#15803D" : "#E2E8F0"),
                cursor: "pointer", transition: "all 0.2s"
              }}
            >
              Standard (CMS)
            </button>
            {payers?.map((payer: any) => (
              <button 
                key={payer.id}
                onClick={() => setSelectedPayerId(payer.id.toString())}
                style={{
                  flexShrink: 0, padding: "8px 16px", borderRadius: "10px", fontSize: "12px", fontWeight: 600,
                  background: selectedPayerId === payer.id.toString() ? "#1B2F6E" : "white",
                  color: selectedPayerId === payer.id.toString() ? "white" : "#64748B",
                  border: "1px solid " + (selectedPayerId === payer.id.toString() ? "#1B2F6E" : "#E2E8F0"),
                  cursor: "pointer", transition: "all 0.2s"
                }}
              >
                {payer.shortName}
              </button>
            ))}
          </div>
          {selectedPayerId && (
            <div style={{ fontSize: "11px", color: "#1B2F6E", fontWeight: 500, marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
               <AlertCircle size={10} /> AI will now apply {payers?.find((p: any) => p.id.toString() === selectedPayerId)?.shortName} specific medical policies.
            </div>
          )}
        </div>
      </div>

      {/* Two-window AI coding workspace */}
      <div className="workspace-ai-demo">
        <div className="workspace-ai-window-wrap">
          {loading && <div className="co-scan-line" />}
      <div style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.7)", padding: "20px", marginBottom: "20px" }}>
        {/* Upload zone */}
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => !text && fileRef.current?.click()}
          style={{
            border: "2px dashed #E2E8F0", borderRadius: "12px", padding: "20px",
            textAlign: "center", cursor: text ? "default" : "pointer",
            background: "rgba(255,255,255,0.4)", marginBottom: "14px",
            transition: "all 0.2s",
          }}
          onMouseOver={e => { if (!text) e.currentTarget.style.borderColor = "#15803D"; }}
          onMouseOut={e => { e.currentTarget.style.borderColor = "#E2E8F0"; }}
        >
          <input ref={fileRef} type="file" accept=".txt,.pdf,.doc,.docx" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          {file ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <FileText size={18} color="#15803D" />
              <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary, #111827)" }}>{file.name}</span>
              <button onClick={e => { e.stopPropagation(); setFile(null); setText(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted, #6B7280)", display: "flex" }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <div>
              <Upload size={24} color="#CBD5E1" style={{ margin: "0 auto 8px" }} />
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary, #4B5563)" }}>Drop file here or click to upload</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted, #6B7280)", marginTop: "2px" }}>TXT, PDF, DOC supported</div>
            </div>
          )}
        </div>

        {/* Text area */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Or paste your operative note, H&P, discharge summary, or clinic note here...

Example:
PROCEDURE: Laparoscopic cholecystectomy
DIAGNOSIS: Acute cholecystitis with cholelithiasis
ANESTHESIA: General
FINDINGS: Distended, inflamed gallbladder with multiple stones..."
          style={{
            width: "100%", minHeight: "180px", padding: "14px",
            border: "2px solid #E2E8F0", borderRadius: "12px",
            fontSize: "13px", lineHeight: 1.6, color: "var(--text-primary, #111827)",
            resize: "vertical", outline: "none", boxSizing: "border-box",
            fontFamily: "monospace", background: "rgba(255,255,255,0.4)",
            transition: "border-color 0.2s",
          }}
          onFocus={e => { e.target.style.borderColor = "#15803D"; }}
          onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }}
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted, #6B7280)" }}>
            {text.length > 0 && `${text.length} characters · ${text.split(/\s+/).filter(Boolean).length} words`}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {text && (
              <button onClick={() => { setText(""); setFile(null); setResult(null); setError(""); }}
                style={{ padding: "8px 16px", background: "#F1F5F9", border: "none", borderRadius: "10px", fontSize: "13px", color: "var(--text-secondary, #4B5563)", cursor: "pointer", fontWeight: 600 }}>
                Clear
              </button>
            )}
            <motion.button
              onClick={analyze}
              disabled={loading || text.trim().length < 20}
              whileHover={{ scale: loading || text.trim().length < 20 ? 1 : 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                padding: "10px 24px",
                background: text.trim().length >= 20 && !loading
                  ? "linear-gradient(135deg, #15803D, #1B2F6E)"
                  : "#F1F5F9",
                color: text.trim().length >= 20 && !loading ? "white" : "#94A3B8",
                border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 700,
                cursor: text.trim().length >= 20 && !loading ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", gap: "8px",
                boxShadow: text.trim().length >= 20 && !loading ? "0 4px 16px rgba(14,165,233,0.25)" : "none",
              }}
            >
              {loading ? (
                <>
                  <div style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Analyze & Code
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>
        </div>

        <div className="workspace-ai-panel workspace-ai-output-panel">
          <div className="workspace-ai-panel-header">
            <div>
              <div className="workspace-ai-eyebrow">AI coding output</div>
              <h2>Suggested code window</h2>
            </div>
            <span className="workspace-ai-pill">{result ? "Complete" : loading ? "Scanning" : "Waiting"}</span>
          </div>

          {result ? (
            <div className="workspace-output-list">
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
                <small>Coder control</small>
                <span>{result.billing_notes || "Review suggested codes, payer context, and documentation requirements before final billing."}</span>
              </div>
            </div>
          ) : (
            <div className="workspace-output-list">
              {[
                ["Suggested CPT", loading ? loadingMsg : "Codes appear after analysis"],
                ["Possible ICD-10", "Diagnoses and indications are mapped here"],
                ["Modifier / payer logic", "Commercial and CMS context stays visible"],
                ["Coder control", "Final coding remains under certified coder review"],
              ].map(([label, value], index) => (
                <div className="workspace-output-item" key={label} style={{ animationDelay: `${index * 90}ms` }}>
                  <small>{label}</small>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderRadius: "20px", padding: "32px", textAlign: "center", border: "1px solid rgba(255,255,255,0.7)", marginBottom: "20px" }}>
          <div style={{ width: "48px", height: "48px", border: "3px solid #E2E8F0", borderTop: "3px solid #15803D", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary, #111827)", marginBottom: "4px" }}>AI is analyzing your document</div>
          <div style={{ fontSize: "13px", color: "#15803D", fontWeight: 500 }}>{loadingMsg}</div>
          <div style={{ fontSize: "11px", color: "var(--text-muted, #6B7280)", marginTop: "8px" }}>This may take 10-20 seconds for complex documents</div>
        </motion.div>
      )}

      {/* Error state */}
      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 18px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "12px", marginBottom: "20px" }}>
          <AlertCircle size={18} color="#EF4444" />
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#DC2626" }}>Analysis Failed</div>
            <div style={{ fontSize: "13px", color: "#7F1D1D", marginTop: "2px" }}>{error}</div>
          </div>
        </motion.div>
      )}

      {/* Results */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

          {/* Result header */}
          <div style={{ background: "linear-gradient(135deg, #15803D, #1B2F6E)", borderRadius: "20px", padding: "20px", color: "white" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <Zap size={16} color="#7DD3FC" />
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#7DD3FC", letterSpacing: "1px" }}>AI ANALYSIS COMPLETE</span>
                  <span style={{ padding: "2px 8px", background: result.confidence === "high" ? "rgba(74,222,128,0.2)" : "rgba(251,191,36,0.2)", color: result.confidence === "high" ? "#4ADE80" : "#FCD34D", borderRadius: "20px", fontSize: "10px", fontWeight: 700, border: `1px solid ${result.confidence === "high" ? "rgba(74,222,128,0.3)" : "rgba(251,191,36,0.3)"}` }}>
                    {result.confidence?.toUpperCase()} CONFIDENCE
                  </span>
                </div>
                <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.9)", lineHeight: 1.5 }}>{result.summary}</div>
              </div>
              <button onClick={exportCodes}
                style={{ padding: "8px 16px", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "10px", color: "white", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                <Download size={14} /> Export
              </button>
            </div>

            {/* Quick stats */}
            <div style={{ display: "flex", gap: "12px", marginTop: "14px", flexWrap: "wrap" }}>
              {[
                { label: "CPT Codes", value: result.cpt_codes?.length || 0, color: "#4ADE80" },
                { label: "ICD-10 Codes", value: result.icd10_codes?.length || 0, color: "#60A5FA" },
                { label: "HCPCS Codes", value: result.hcpcs_codes?.length || 0, color: "#F59E0B" },
                { label: "POS", value: result.pos_code?.code || "-", color: "#C084FC" },
              ].map((s, i) => (
                <div
                  key={i}
                  style={{
                    padding: "8px 14px",
                    minWidth: "68px",
                    background: "rgba(15, 23, 42, 0.28)",
                    borderRadius: "10px",
                    border: "1px solid rgba(255,255,255,0.24)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
                  }}
                >
                  <div style={{ fontSize: "18px", fontWeight: 900, color: s.color, textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}>{s.value}</div>
                  <div style={{ fontSize: "10px", color: "#F8FAFC", fontWeight: 800, marginTop: "1px", textShadow: "0 1px 2px rgba(0,0,0,0.45)" }}>{s.label}</div>
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

          {/* Disclaimer */}
          <div style={{ padding: "12px 16px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "12px", fontSize: "11px", color: "#92400E", lineHeight: 1.5 }}>
            <strong>⚠ Disclaimer:</strong> {result.disclaimer}
          </div>
        </motion.div>
      )}

      <style dangerouslySetInnerHTML={{ __html: "@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}" }} />
    </div>
  );
}
