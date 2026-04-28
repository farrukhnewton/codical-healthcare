import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Hash, DollarSign, Shield, FileText, Tag, MapPin,
  Star, StarOff, ChevronRight, ArrowLeft, Zap, Activity,
  Copy, Check, ExternalLink, AlertCircle, BookOpen
} from "lucide-react";

const TABS = [
  { id: "overview", label: "Overview", icon: Hash },
  { id: "rvu", label: "RVU & Pay", icon: DollarSign },
  { id: "ncci", label: "NCCI Check", icon: Shield },
  { id: "coverage", label: "Coverage", icon: FileText },
  { id: "modifiers", label: "Modifiers & POS", icon: Tag },
];

const TYPE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  CPT: { bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0" },
  "ICD-10-CM": { bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" },
  HCPCS: { bg: "#FFF7ED", color: "#EA580C", border: "#FED7AA" },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "hsl(var(--muted-foreground))", display: "flex" }}>
      {copied ? <Check size={14} color="#16A34A" /> : <Copy size={14} />}
    </button>
  );
}

function StatCard({ label, value, sub, color = "#15803D" }: any) {
  return (
    <div style={{ background: "var(--app-glass-strong-bg)", backdropFilter: "blur(12px)", borderRadius: "16px", padding: "16px", border: "1px solid var(--app-glass-border)", flex: 1 }}>
      <div style={{ fontSize: "11px", fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontSize: "22px", fontWeight: 900, color }}>{value}</div>
      {sub && <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", marginTop: "2px" }}>{sub}</div>}
    </div>
  );
}

export function CodeIntel() {
  const [, params] = useRoute("/intel/:code");
  const [, setLocation] = useLocation();
  const code = (params?.code || "").toUpperCase();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [ncciCode2, setNcciCode2] = useState("");
  const [ncciResult, setNcciResult] = useState<any>(null);
  const [ncciLoading, setNcciLoading] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    setError("");
    setData(null);
    fetch(`/api/intel/${code}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError("Failed to load data for " + code); setLoading(false); });
  }, [code]);

  const checkNcci = async () => {
    if (!ncciCode2.trim()) return;
    setNcciLoading(true);
    try {
      const r = await fetch(`/api/ncci/check?col1=${code}&col2=${ncciCode2.trim()}&type=practitioner`, { credentials: "include" });
      const d = await r.json();
      setNcciResult(d);
    } catch { setNcciResult({ error: true }); }
    setNcciLoading(false);
  };

  const codeInfo = data?.codeInfo;
  const rvu = data?.rvu;
  const typeStyle = TYPE_COLORS[codeInfo?.type] || TYPE_COLORS["CPT"];

  if (loading) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "400px" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: "40px", height: "40px", border: "3px solid hsl(var(--border))", borderTop: "3px solid hsl(var(--primary))", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <div style={{ fontSize: "14px", color: "hsl(var(--muted-foreground))", fontWeight: 500 }}>Loading intelligence for {code}...</div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: "@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}" }} />
    </div>
  );

  if (error || !codeInfo) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "400px" }}>
      <div style={{ textAlign: "center", maxWidth: "320px" }}>
        <AlertCircle size={40} color="#EF4444" style={{ margin: "0 auto 12px" }} />
        <div style={{ fontSize: "16px", fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: "8px" }}>Code Not Found</div>
        <div style={{ fontSize: "13px", color: "hsl(var(--muted-foreground))" }}>No data found for code <strong>{code}</strong>. Try searching for a valid ICD-10, CPT, or HCPCS code.</div>
        <button onClick={() => setLocation("/search")} style={{ marginTop: "16px", padding: "10px 20px", background: "#15803D", color: "white", border: "none", borderRadius: "10px", cursor: "pointer", fontWeight: 600 }}>
          Back to Search
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--app-glass-bg)", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "var(--app-glass-strong-bg)", backdropFilter: "blur(12px)", borderBottom: "1px solid hsl(var(--border) / 0.6)", padding: "0 24px" }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 0 0", fontSize: "12px", color: "hsl(var(--muted-foreground))" }}>
          <button onClick={() => setLocation("/search")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", color: "hsl(var(--muted-foreground))", padding: 0, fontSize: "12px" }}>
            <ArrowLeft size={12} /> Search
          </button>
          <ChevronRight size={12} />
          <span style={{ color: "hsl(var(--foreground))", fontWeight: 600 }}>{code}</span>
        </div>

        {/* Code title bar */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "16px 0 0", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ padding: "6px 14px", background: typeStyle.bg, border: `1px solid ${typeStyle.border}`, borderRadius: "10px", fontSize: "14px", fontWeight: 800, color: typeStyle.color, fontFamily: "monospace", letterSpacing: "1px" }}>
                {code}
              </div>
              <CopyButton text={code} />
            </div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "hsl(var(--foreground))", maxWidth: "500px", lineHeight: 1.3 }}>
              {String(codeInfo.description || "").replace(/^"|"$/g, "")}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {rvu && (
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ padding: "6px 12px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "8px", fontSize: "13px", fontWeight: 700, color: "#16A34A" }}>
                  ${rvu.nonFacilityPayment} non-fac
                </div>
                <div style={{ padding: "6px 12px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "8px", fontSize: "13px", fontWeight: 700, color: "#2563EB" }}>
                  ${rvu.facilityPayment} fac
                </div>
              </div>
            )}
            <button onClick={() => setFavorited(f => !f)} style={{ width: "36px", height: "36px", borderRadius: "10px", background: favorited ? "#FEF9C3" : "#F8FAFC", border: `1px solid ${favorited ? "#FDE047" : "hsl(var(--border))"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {favorited ? <Star size={16} color="#EAB308" fill="#EAB308" /> : <StarOff size={16} color="#94A3B8" />}
            </button>
          </div>
        </div>

        {/* Status badges */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 0", flexWrap: "wrap" }}>
          <span style={{ padding: "3px 10px", background: "#F0FDF4", color: "#16A34A", borderRadius: "20px", fontSize: "11px", fontWeight: 700 }}>✓ Active CY 2026</span>
          {codeInfo.version && <span style={{ padding: "3px 10px", background: "hsl(var(--border) / 0.6)", color: "hsl(var(--muted-foreground))", borderRadius: "20px", fontSize: "11px", fontWeight: 600 }}>{codeInfo.version?.toUpperCase()}</span>}
          {codeInfo.category && <span style={{ padding: "3px 10px", background: "#FFF7ED", color: "#EA580C", borderRadius: "20px", fontSize: "11px", fontWeight: 600 }}>{codeInfo.category}</span>}
          {rvu?.globalPeriod && <span style={{ padding: "3px 10px", background: "#F5F3FF", color: "#7C3AED", borderRadius: "20px", fontSize: "11px", fontWeight: 600 }}>Global: {rvu.globalPeriod}</span>}
          {data?.lcdCount > 0 && <span style={{ padding: "3px 10px", background: "#ECFEFF", color: "#0891B2", borderRadius: "20px", fontSize: "11px", fontWeight: 600 }}>{data.lcdCount} LCD Policies</span>}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0", borderTop: "1px solid hsl(var(--border) / 0.6)", marginTop: "4px" }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const isDisabled = (tab.id === "rvu" && !rvu) || (tab.id === "modifiers" && codeInfo?.type !== "CPT") || (tab.id === "coverage" && data?.lcdCount === 0);
            return (
              <button key={tab.id} onClick={() => !isDisabled && setActiveTab(tab.id)}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "12px 16px", background: "none", border: "none",
                  borderBottom: isActive ? "2px solid #15803D" : "2px solid transparent",
                  cursor: isDisabled ? "default" : "pointer",
                  fontSize: "13px", fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#15803D" : isDisabled ? "#CBD5E1" : "#64748B",
                  transition: "all 0.15s", marginBottom: "-1px",
                }}>
                <tab.icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ padding: "24px", maxWidth: "1000px" }}>
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>

            {/* OVERVIEW TAB */}
            {activeTab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* Full description */}
                <div style={{ background: "var(--app-glass-strong-bg)", backdropFilter: "blur(12px)", borderRadius: "20px", padding: "20px", border: "1px solid var(--app-glass-border)" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <BookOpen size={11} /> Official Description
                  </div>
                  <div style={{ fontSize: "15px", color: "hsl(var(--foreground))", lineHeight: 1.6, fontWeight: 400 }}>
                    {String(codeInfo.description || "").replace(/^"|"$/g, "")}
                  </div>
                  {codeInfo.procedureDetails && (
                    <div style={{ marginTop: "12px", padding: "12px", background: "var(--app-glass-bg)", borderRadius: "10px", fontSize: "13px", color: "hsl(var(--muted-foreground))", lineHeight: 1.6 }}>
                      {String(codeInfo.procedureDetails).replace(/^"|"$/g, "")}
                    </div>
                  )}
                </div>

                {/* Quick stats row */}
                {rvu && (
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    <StatCard label="Non-Facility Pay" value={"$" + rvu.nonFacilityPayment} sub="CY 2026 Medicare" color="#16A34A" />
                    <StatCard label="Facility Pay" value={"$" + rvu.facilityPayment} sub="CY 2026 Medicare" color="#2563EB" />
                    <StatCard label="Total RVU" value={rvu.totalNonFacilityRvu} sub={"Work: " + rvu.workRvu} color="#7C3AED" />
                    <StatCard label="Global Period" value={rvu.globalPeriod} sub="Surgery indicator" color="#EA580C" />
                  </div>
                )}

                {/* Related codes */}
                {data?.relatedCodes?.length > 0 && (
                  <div style={{ background: "var(--app-glass-strong-bg)", backdropFilter: "blur(12px)", borderRadius: "20px", padding: "20px", border: "1px solid var(--app-glass-border)" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>Related Codes</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {data.relatedCodes.map((rc: any) => {
                        const rcStyle = TYPE_COLORS[rc.type] || TYPE_COLORS["CPT"];
                        return (
                          <button key={rc.code} onClick={() => setLocation("/intel/" + rc.code)}
                            style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: "var(--app-glass-bg)", border: "1px solid var(--app-glass-border)", borderRadius: "10px", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
                            onMouseOver={e => { e.currentTarget.style.background = "#EFF6FF"; e.currentTarget.style.borderColor = "#BFDBFE"; }}
                            onMouseOut={e => { e.currentTarget.style.background = "#F8FAFC"; e.currentTarget.style.borderColor = "hsl(var(--border) / 0.6)"; }}
                          >
                            <span style={{ padding: "2px 8px", background: rcStyle.bg, color: rcStyle.color, borderRadius: "6px", fontSize: "12px", fontWeight: 700, fontFamily: "monospace", flexShrink: 0 }}>{rc.code}</span>
                            <span style={{ fontSize: "13px", color: "hsl(var(--muted-foreground))", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(rc.description || "").replace(/^"|"$/g, "")}</span>
                            <ChevronRight size={14} color="#CBD5E1" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* RVU TAB */}
            {activeTab === "rvu" && rvu && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div style={{ background: "var(--app-glass-strong-bg)", backdropFilter: "blur(12px)", borderRadius: "20px", padding: "24px", border: "1px solid var(--app-glass-border)" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Activity size={11} /> CY 2026 Medicare Physician Fee Schedule
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    {[
                      { label: "Work RVU", value: rvu.workRvu, color: "#7C3AED" },
                      { label: "Non-Fac PE RVU", value: rvu.nonFacilityPeRvu, color: "#0891B2" },
                      { label: "Facility PE RVU", value: rvu.facilityPeRvu, color: "#0891B2" },
                      { label: "Malpractice RVU", value: rvu.malpracticeRvu, color: "#EA580C" },
                      { label: "Total Non-Fac RVU", value: rvu.totalNonFacilityRvu, color: "hsl(var(--foreground))" },
                      { label: "Total Facility RVU", value: rvu.totalFacilityRvu, color: "hsl(var(--foreground))" },
                    ].map((item, i) => (
                      <div key={i} style={{ padding: "14px", background: "var(--app-glass-bg)", borderRadius: "12px", border: "1px solid var(--app-glass-border)" }}>
                        <div style={{ fontSize: "11px", fontWeight: 600, color: "hsl(var(--muted-foreground))", marginBottom: "4px" }}>{item.label}</div>
                        <div style={{ fontSize: "20px", fontWeight: 800, color: item.color }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: "20px", display: "flex", gap: "12px" }}>
                    <div style={{ flex: 1, padding: "16px", background: "linear-gradient(135deg, #F0FDF4, #DCFCE7)", borderRadius: "12px", border: "1px solid #BBF7D0" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#16A34A", marginBottom: "4px" }}>NON-FACILITY PAYMENT</div>
                      <div style={{ fontSize: "28px", fontWeight: 900, color: "#15803D" }}>${rvu.nonFacilityPayment}</div>
                      <div style={{ fontSize: "11px", color: "#4ADE80", marginTop: "2px" }}>Office / Clinic setting</div>
                    </div>
                    <div style={{ flex: 1, padding: "16px", background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)", borderRadius: "12px", border: "1px solid #BFDBFE" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#2563EB", marginBottom: "4px" }}>FACILITY PAYMENT</div>
                      <div style={{ fontSize: "28px", fontWeight: 900, color: "#1D4ED8" }}>${rvu.facilityPayment}</div>
                      <div style={{ fontSize: "11px", color: "#60A5FA", marginTop: "2px" }}>Hospital / ASC setting</div>
                    </div>
                  </div>
                  <div style={{ marginTop: "12px", padding: "12px 16px", background: "var(--app-glass-bg)", borderRadius: "10px", fontSize: "12px", color: "hsl(var(--muted-foreground))", display: "flex", gap: "16px", flexWrap: "wrap" }}>
                    <span>Conversion Factor: <strong>${rvu.conversionFactor}</strong></span>
                    <span>Global Period: <strong>{rvu.globalPeriod}</strong></span>
                    <span>Status: <strong>{rvu.procStatus === "A" ? "Active" : rvu.procStatus}</strong></span>
                  </div>
                </div>
              </div>
            )}

            {/* NCCI TAB */}
            {activeTab === "ncci" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div style={{ background: "var(--app-glass-strong-bg)", backdropFilter: "blur(12px)", borderRadius: "20px", padding: "24px", border: "1px solid var(--app-glass-border)" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Shield size={11} /> NCCI Edit Check
                  </div>
                  <div style={{ fontSize: "13px", color: "hsl(var(--muted-foreground))", marginBottom: "16px" }}>
                    Enter a second CPT code to check if NCCI edits exist between <strong>{code}</strong> and another code.
                  </div>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ padding: "10px 16px", background: "hsl(var(--border) / 0.6)", borderRadius: "10px", fontSize: "15px", fontWeight: 700, fontFamily: "monospace", color: "hsl(var(--foreground))" }}>{code}</div>
                    <div style={{ fontSize: "18px", color: "#CBD5E1", fontWeight: 300 }}>+</div>
                    <input
                      value={ncciCode2}
                      onChange={e => setNcciCode2(e.target.value.toUpperCase())}
                      placeholder="Second CPT code..."
                      onKeyDown={e => e.key === "Enter" && checkNcci()}
                      style={{ height: "42px", padding: "0 14px", border: "2px solid hsl(var(--border))", borderRadius: "10px", fontSize: "15px", fontFamily: "monospace", fontWeight: 600, outline: "none", width: "180px" }}
                      onFocus={e => { e.target.style.borderColor = "#15803D"; }}
                      onBlur={e => { e.target.style.borderColor = "hsl(var(--border))"; }}
                    />
                    <button onClick={checkNcci} disabled={ncciLoading || !ncciCode2.trim()}
                      style={{ height: "42px", padding: "0 20px", background: ncciCode2.trim() ? "#15803D" : "hsl(var(--border) / 0.6)", color: ncciCode2.trim() ? "white" : "#94A3B8", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 700, cursor: ncciCode2.trim() ? "pointer" : "default", display: "flex", alignItems: "center", gap: "8px" }}>
                      {ncciLoading ? <div style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> : <Zap size={14} />}
                      Check
                    </button>
                  </div>

                  {ncciResult && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: "20px" }}>
                      {ncciResult.hasEdit ? (
                        <div style={{ padding: "16px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "12px" }}>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "#DC2626", marginBottom: "8px" }}>Warning: NCCI Edit Found</div>
                          <div style={{ fontSize: "13px", color: "#7F1D1D" }}>
                            {code} and {ncciCode2} have an NCCI edit.
                            {ncciResult.modifierAllowed === "1" && " Modifier may be allowed to bypass this edit."}
                            {ncciResult.modifierAllowed === "0" && " No modifier allowed - these codes cannot be billed together."}
                          </div>
                          {ncciResult.effectiveDate && <div style={{ fontSize: "11px", color: "#991B1B", marginTop: "6px" }}>Effective: {ncciResult.effectiveDate}</div>}
                        </div>
                      ) : (
                        <div style={{ padding: "16px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "12px" }}>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "#16A34A", marginBottom: "4px" }}>✓ No NCCI Edit Found</div>
                          <div style={{ fontSize: "13px", color: "#166534" }}>{code} and {ncciCode2} can be billed together without NCCI conflict.</div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {/* COVERAGE TAB */}
            {activeTab === "coverage" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {data?.lcds?.length > 0 ? data.lcds.map((lcd: any, i: number) => (
                  <div key={i} style={{ background: "var(--app-glass-strong-bg)", backdropFilter: "blur(12px)", borderRadius: "16px", padding: "18px", border: "1px solid var(--app-glass-border)" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                          <span style={{ padding: "2px 8px", background: "#ECFEFF", color: "#0891B2", borderRadius: "6px", fontSize: "11px", fontWeight: 700 }}>LCD</span>
                          <span style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", fontFamily: "monospace" }}>{lcd.document_id}</span>
                        </div>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "hsl(var(--foreground))", lineHeight: 1.4 }}>{lcd.title}</div>
                        <div style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))", marginTop: "4px" }}>{String(lcd.contractor_name_type || "").split("\r")[0]}</div>
                      </div>
                      <button onClick={() => setLocation("/intelligence")} style={{ padding: "6px 12px", background: "var(--app-glass-bg)", border: "1px solid var(--app-glass-border)", borderRadius: "8px", fontSize: "12px", color: "hsl(var(--muted-foreground))", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", flexShrink: 0, fontWeight: 600 }}>
                        <ExternalLink size={12} /> View
                      </button>
                    </div>
                  </div>
                )) : (
                  <div style={{ background: "var(--app-glass-strong-bg)", backdropFilter: "blur(12px)", borderRadius: "16px", padding: "32px", border: "1px solid var(--app-glass-border)", textAlign: "center" }}>
                    <FileText size={32} color="#CBD5E1" style={{ margin: "0 auto 12px" }} />
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "hsl(var(--foreground))" }}>No LCD Policies Found</div>
                    <div style={{ fontSize: "13px", color: "hsl(var(--muted-foreground))", marginTop: "4px" }}>No local coverage determinations found for {code}</div>
                  </div>
                )}
              </div>
            )}

            {/* MODIFIERS & POS TAB */}
            {activeTab === "modifiers" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {data?.commonModifiers?.length > 0 && (
                  <div style={{ background: "var(--app-glass-strong-bg)", backdropFilter: "blur(12px)", borderRadius: "20px", padding: "24px", border: "1px solid var(--app-glass-border)" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Tag size={11} /> Commonly Used Modifiers
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      {data.commonModifiers.map((mod: any) => (
                        <div key={mod.code} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: "var(--app-glass-bg)", borderRadius: "10px", border: "1px solid var(--app-glass-border)" }}>
                          <div style={{ padding: "4px 10px", background: "#F5F3FF", color: "#7C3AED", borderRadius: "6px", fontSize: "13px", fontWeight: 800, fontFamily: "monospace", flexShrink: 0 }}>{mod.code}</div>
                          <div style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))", lineHeight: 1.3 }}>{mod.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {data?.commonPOS?.length > 0 && (
                  <div style={{ background: "var(--app-glass-strong-bg)", backdropFilter: "blur(12px)", borderRadius: "20px", padding: "24px", border: "1px solid var(--app-glass-border)" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <MapPin size={11} /> Common Place of Service Codes
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      {data.commonPOS.map((pos: any) => (
                        <div key={pos.code} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: "var(--app-glass-bg)", borderRadius: "10px", border: "1px solid var(--app-glass-border)" }}>
                          <div style={{ padding: "4px 10px", background: "#FFF7ED", color: "#EA580C", borderRadius: "6px", fontSize: "13px", fontWeight: 800, fontFamily: "monospace", flexShrink: 0 }}>{pos.code}</div>
                          <div style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))" }}>{pos.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

