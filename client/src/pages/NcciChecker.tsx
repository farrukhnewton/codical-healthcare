import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Search, CheckCircle, XCircle, AlertTriangle, ArrowRight, RotateCcw, Info } from "lucide-react";

interface NcciResult {
  hasEdit: boolean;
  message: string;
  col1?: string;
  col2?: string;
  modifier_indicator?: string;
  effective_date?: string;
  deletion_date?: string;
  modifierAllowed?: boolean;
}

const EXAMPLE_PAIRS = [
  { col1: "99213", col2: "93000", label: "E/M + EKG" },
  { col1: "45378", col2: "45380", label: "Colonoscopy pair" },
  { col1: "27447", col2: "27370", label: "Knee replacement" },
  { col1: "99213", col2: "99214", label: "Duplicate E/M" },
];

export function NcciChecker() {
  const [col1, setCol1] = useState("");
  const [col2, setCol2] = useState("");
  const [type, setType] = useState<"practitioner" | "outpatient">("practitioner");
  const [result, setResult] = useState<NcciResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const check = async () => {
    if (!col1.trim() || !col2.trim()) return;
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await fetch(`/api/ncci/check?col1=${col1.trim().toUpperCase()}&col2=${col2.trim().toUpperCase()}&type=${type}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) setError(data.message || "Check failed");
      else setResult(data);
    } catch { setError("Network error. Please try again."); }
    setLoading(false);
  };

  const reset = () => { setCol1(""); setCol2(""); setResult(null); setError(""); };

  const loadExample = (pair: typeof EXAMPLE_PAIRS[0]) => {
    setCol1(pair.col1); setCol2(pair.col2); setResult(null); setError("");
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "rgba(255,255,255,0.4)", minHeight: "100vh" }}>
      {/* Hero header */}
      <div style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #0F2A4A 100%)", padding: "32px 24px", position: "relative", overflow: "hidden" }}>
        {/* Background pattern */}
        {Array.from({length: 8}).map((_, i) => (
          <div key={i} style={{ position: "absolute", width: (30 + i*15) + "px", height: (30 + i*15) + "px", borderRadius: "50%", border: "1px solid rgba(14,165,233,0.1)", left: ((i*23+5)%90) + "%", top: ((i*31+10)%80) + "%", }} />
        ))}
        <div style={{ position: "relative", zIndex: 1, maxWidth: "700px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "20px", background: "rgba(14,165,233,0.2)", border: "1px solid rgba(14,165,233,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Shield size={28} color="#15803D" />
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: 900, color: "white", margin: "0 0 8px", letterSpacing: "-0.5px" }}>NCCI Edit Checker</h1>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", margin: 0 }}>National Correct Coding Initiative · 1.6M+ edits · CY 2026</p>
        </div>
      </div>

      <div style={{ maxWidth: "700px", margin: "0 auto", padding: "24px" }}>
        {/* Search card */}
        <div style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderRadius: "20px", padding: "24px", border: "1px solid rgba(255,255,255,0.7)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", marginBottom: "20px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted, #6B7280)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "16px" }}>Enter Two CPT Codes</div>

          {/* Code inputs */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "120px" }}>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary, #4B5563)", display: "block", marginBottom: "6px" }}>COLUMN 1 CODE</label>
              <input value={col1} onChange={e => setCol1(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && check()}
                placeholder="e.g. 99213"
                maxLength={5}
                style={{ width: "100%", height: "52px", textAlign: "center", fontSize: "20px", fontWeight: 800, fontFamily: "monospace", border: "2px solid #E2E8F0", borderRadius: "12px", outline: "none", boxSizing: "border-box", letterSpacing: "3px", color: "var(--text-primary, #111827)", transition: "border-color 0.2s" }}
                onFocus={e => { e.target.style.borderColor = "#15803D"; }}
                onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", paddingTop: "20px" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ArrowRight size={16} color="#94A3B8" />
              </div>
              <div style={{ fontSize: "9px", fontWeight: 700, color: "#CBD5E1", letterSpacing: "1px" }}>vs</div>
            </div>
            <div style={{ flex: 1, minWidth: "120px" }}>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary, #4B5563)", display: "block", marginBottom: "6px" }}>COLUMN 2 CODE</label>
              <input value={col2} onChange={e => setCol2(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && check()}
                placeholder="e.g. 93000"
                maxLength={5}
                style={{ width: "100%", height: "52px", textAlign: "center", fontSize: "20px", fontWeight: 800, fontFamily: "monospace", border: "2px solid #E2E8F0", borderRadius: "12px", outline: "none", boxSizing: "border-box", letterSpacing: "3px", color: "var(--text-primary, #111827)", transition: "border-color 0.2s" }}
                onFocus={e => { e.target.style.borderColor = "#15803D"; }}
                onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }}
              />
            </div>
          </div>

          {/* Type selector */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            {(["practitioner", "outpatient"] as const).map(t => (
              <button key={t} onClick={() => setType(t)} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: `2px solid ${type === t ? "#15803D" : "#E2E8F0"}`, background: type === t ? "rgba(14,165,233,0.06)" : "white", fontSize: "13px", fontWeight: 700, color: type === t ? "#15803D" : "#64748B", cursor: "pointer", textTransform: "capitalize", transition: "all 0.15s" }}>
                {t === "practitioner" ? "🏥 Practitioner" : "🏨 Outpatient"}
              </button>
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: "8px" }}>
            <motion.button onClick={check} disabled={loading || !col1.trim() || !col2.trim()} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
              style={{ flex: 1, height: "48px", background: col1.trim() && col2.trim() ? "linear-gradient(135deg, #15803D, #1B2F6E)" : "#F1F5F9", color: col1.trim() && col2.trim() ? "white" : "#94A3B8", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 700, cursor: col1.trim() && col2.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: col1.trim() && col2.trim() ? "0 4px 16px rgba(14,165,233,0.25)" : "none" }}>
              {loading ? <div style={{ width: "18px", height: "18px", border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> : <Search size={16} />}
              {loading ? "Checking..." : "Check NCCI Edit"}
            </motion.button>
            {(col1 || col2 || result) && (
              <button onClick={reset} style={{ width: "48px", height: "48px", border: "2px solid #E2E8F0", borderRadius: "12px", background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted, #6B7280)" }}>
                <RotateCcw size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Example pairs */}
        {!result && !loading && (
          <div style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderRadius: "20px", padding: "18px", border: "1px solid rgba(255,255,255,0.7)", marginBottom: "20px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted, #6B7280)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>Quick Examples</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {EXAMPLE_PAIRS.map((pair, i) => (
                <button key={i} onClick={() => loadExample(pair)}
                  style={{ padding: "8px 14px", background: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.7)", borderRadius: "10px", cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary, #4B5563)", display: "flex", alignItems: "center", gap: "6px", transition: "all 0.15s" }}
                  onMouseOver={e => { e.currentTarget.style.background = "#EFF6FF"; e.currentTarget.style.borderColor = "#BFDBFE"; e.currentTarget.style.color = "#2563EB"; }}
                  onMouseOut={e => { e.currentTarget.style.background = "#F8FAFC"; e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.color = "#475569"; }}
                >
                  <span style={{ fontFamily: "monospace", fontWeight: 800 }}>{pair.col1}</span>
                  <span style={{ color: "#CBD5E1" }}>+</span>
                  <span style={{ fontFamily: "monospace", fontWeight: 800 }}>{pair.col2}</span>
                  <span style={{ color: "var(--text-muted, #6B7280)", fontWeight: 400 }}>· {pair.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ padding: "14px 18px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "16px", fontSize: "13px", color: "#DC2626", display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <AlertTriangle size={16} /> {error}
          </motion.div>
        )}

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              {result.hasEdit ? (
                <div style={{ borderRadius: "20px", overflow: "hidden", border: "1px solid #FECACA", boxShadow: "0 8px 32px rgba(239,68,68,0.1)" }}>
                  {/* Edit found header */}
                  <div style={{ background: "linear-gradient(135deg, #DC2626, #991B1B)", padding: "24px", display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <XCircle size={28} color="white" />
                    </div>
                    <div>
                      <div style={{ fontSize: "18px", fontWeight: 800, color: "white" }}>NCCI Edit Found</div>
                      <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", marginTop: "2px" }}>
                        {result.col1 || col1} and {result.col2 || col2} cannot be billed together
                      </div>
                    </div>
                  </div>
                  {/* Edit details */}
                  <div style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, padding: "14px", background: "#FEF2F2", borderRadius: "12px", minWidth: "120px" }}>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: "#EF4444", textTransform: "uppercase", marginBottom: "4px" }}>Column 1</div>
                        <div style={{ fontSize: "22px", fontWeight: 900, color: "#DC2626", fontFamily: "monospace" }}>{result.col1 || col1}</div>
                      </div>
                      <div style={{ flex: 1, padding: "14px", background: "#FEF2F2", borderRadius: "12px", minWidth: "120px" }}>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: "#EF4444", textTransform: "uppercase", marginBottom: "4px" }}>Column 2</div>
                        <div style={{ fontSize: "22px", fontWeight: 900, color: "#DC2626", fontFamily: "monospace" }}>{result.col2 || col2}</div>
                      </div>
                      <div style={{ flex: 1, padding: "14px", background: result.modifierAllowed ? "#F0FDF4" : "#FEF2F2", borderRadius: "12px", minWidth: "120px" }}>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: result.modifierAllowed ? "#16A34A" : "#EF4444", textTransform: "uppercase", marginBottom: "4px" }}>Modifier</div>
                        <div style={{ fontSize: "16px", fontWeight: 800, color: result.modifierAllowed ? "#15803D" : "#DC2626" }}>
                          {result.modifierAllowed ? "✓ Allowed" : "✗ Not Allowed"}
                        </div>
                      </div>
                    </div>
                    {result.modifierAllowed && (
                      <div style={{ padding: "12px 16px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "10px", fontSize: "13px", color: "#166534", display: "flex", alignItems: "center", gap: "8px" }}>
                        <Info size={14} color="#16A34A" />
                        A modifier may be appended to bypass this edit if the services were truly separate and distinct.
                      </div>
                    )}
                    {result.effective_date && (
                      <div style={{ fontSize: "12px", color: "var(--text-muted, #6B7280)", display: "flex", gap: "16px" }}>
                        <span>Effective: <strong style={{ color: "var(--text-secondary, #4B5563)" }}>{result.effective_date}</strong></span>
                        {result.deletion_date && result.deletion_date !== "20991231" && <span>Deletion: <strong style={{ color: "var(--text-secondary, #4B5563)" }}>{result.deletion_date}</strong></span>}
                      </div>
                    )}
                    <div style={{ fontSize: "12px", color: "var(--text-secondary, #4B5563)", padding: "10px 14px", background: "rgba(255,255,255,0.4)", borderRadius: "8px" }}>{result.message}</div>
                  </div>
                </div>
              ) : (
                <div style={{ borderRadius: "20px", overflow: "hidden", border: "1px solid #BBF7D0", boxShadow: "0 8px 32px rgba(22,163,74,0.1)" }}>
                  <div style={{ background: "linear-gradient(135deg, #16A34A, #166534)", padding: "24px", display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <CheckCircle size={28} color="white" />
                    </div>
                    <div>
                      <div style={{ fontSize: "18px", fontWeight: 800, color: "white" }}>No NCCI Edit Found</div>
                      <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", marginTop: "2px" }}>
                        {col1} and {col2} can be billed together
                      </div>
                    </div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", padding: "20px" }}>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "14px" }}>
                      {[col1, col2].map((c, i) => (
                        <div key={i} style={{ flex: 1, padding: "14px", background: "#F0FDF4", borderRadius: "12px", textAlign: "center", minWidth: "100px" }}>
                          <div style={{ fontSize: "22px", fontWeight: 900, color: "#16A34A", fontFamily: "monospace" }}>{c}</div>
                          <div style={{ fontSize: "10px", color: "#4ADE80", fontWeight: 600, marginTop: "2px" }}>✓ BILLABLE</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: "13px", color: "#166534", padding: "12px 16px", background: "#F0FDF4", borderRadius: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <CheckCircle size={14} color="#16A34A" />
                      These codes may be billed together for {type} claims without NCCI conflict.
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info box */}
        <div style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderRadius: "16px", padding: "16px", border: "1px solid rgba(255,255,255,0.7)", marginTop: "20px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted, #6B7280)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Info size={11} /> About NCCI Edits
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary, #4B5563)", lineHeight: 1.6 }}>
            The National Correct Coding Initiative (NCCI) promotes national correct coding methodologies and to control improper coding leading to inappropriate payment. NCCI edits include Procedure-to-Procedure (PTP) edits and Medically Unlikely Edits (MUEs). Data updated quarterly by CMS.
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: "@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}" }} />
    </div>
  );
}