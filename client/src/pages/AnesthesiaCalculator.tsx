import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Search, MapPin, Calculator, AlertCircle, ChevronDown, Info, Zap, Tag, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Locality {
  id: number;
  Contractor: string;
  Locality: string;
  "Locality Name": string;
  "2026 Work GPCI": string;
  "2026 PE GPCI": string;
  "2026 MP GPCI": string;
  non_qualifying_cf: string;
  qualifying_cf: string;
}

interface BaseUnitResult {
  cpt: string;
  description: string;
  baseUnits: number;
}

interface AnesthesiaModifier {
  id: number;
  Modifier: string;
  Description: string;
  REQUIRED: string;
  "PAYMENT ADJUSTMENT": string;
}

const QUICK_CODES = [
  { code: "00100", label: "Head/Salivary" },
  { code: "00400", label: "Extremities" },
  { code: "00700", label: "Abdomen" },
  { code: "00800", label: "Lower Abdomen" },
  { code: "01200", label: "Hip" },
  { code: "01400", label: "Knee" },
  { code: "01610", label: "Shoulder" },
  { code: "00840", label: "Intraperitoneal" },
];

export function AnesthesiaCalculator() {
  const [code, setCode] = useState("");
  const [minutes, setMinutes] = useState("");
  const [selectedLocality, setSelectedLocality] = useState("");
  const [qualifyingAnesthesia, setQualifyingAnesthesia] = useState(false);
  const [selectedModifier, setSelectedModifier] = useState("");
  const [baseUnitInfo, setBaseUnitInfo] = useState<BaseUnitResult | null>(null);
  const [baseUnitLoading, setBaseUnitLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: localities } = useQuery<Locality[]>({
    queryKey: ["/api/anesthesia/localities"],
    queryFn: async () => { const res = await fetch("/api/anesthesia/localities", { credentials: "include" }); return res.json(); },
  });

  const { data: modifiers } = useQuery<AnesthesiaModifier[]>({
    queryKey: ["/api/anesthesia/modifiers"],
    queryFn: async () => { const res = await fetch("/api/anesthesia/modifiers", { credentials: "include" }); return res.json(); },
  });

  // Auto-lookup base units when code entered
  useEffect(() => {
    if (code.length >= 4) {
      setBaseUnitLoading(true);
      fetch(`/api/anesthesia/baseunits/${code.trim()}`, { credentials: "include" })
        .then(r => r.json())
        .then(d => { if (d.baseUnits) setBaseUnitInfo(d); else setBaseUnitInfo(null); })
        .catch(() => setBaseUnitInfo(null))
        .finally(() => setBaseUnitLoading(false));
    } else {
      setBaseUnitInfo(null);
    }
  }, [code]);

  const selectedModifierData = modifiers?.find(m => m.Modifier === selectedModifier);

  // Calculate modifier adjustment
  const getModifierMultiplier = () => {
    if (!selectedModifierData) return 1;
    const adj = selectedModifierData["PAYMENT ADJUSTMENT"];
    if (adj === "100%") return 1;
    if (adj === "50%") return 0.5;
    return 1;
  };

  const calculate = async () => {
    if (!baseUnitInfo || !minutes || !selectedLocality) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const timeUnits = Math.round(Number(minutes) / 15);
      const totalUnits = baseUnitInfo.baseUnits + timeUnits;
      const res = await fetch(`/api/anesthesia/calculate?locality=${encodeURIComponent(selectedLocality)}&baseUnits=${baseUnitInfo.baseUnits}&timeUnits=${timeUnits}&qualifying=${qualifyingAnesthesia}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) setError(data.message || "Calculation failed");
      else setResult({ ...data, timeUnits, modifier: selectedModifierData, modifierMultiplier: getModifierMultiplier() });
    } catch { setError("Network error."); }
    setLoading(false);
  };

  const canCalculate = baseUnitInfo && minutes && selectedLocality;

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "rgba(255,255,255,0.4)", minHeight: "100vh" }}>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #0F2A4A 100%)", padding: "32px 24px", position: "relative", overflow: "hidden" }}>
        {Array.from({length: 6}).map((_, i) => (
          <div key={i} style={{ position: "absolute", width: (20+i*12)+"px", height: (20+i*12)+"px", borderRadius: "50%", border: "1px solid rgba(8,145,178,0.15)", left: ((i*29+8)%88)+"%", top: ((i*37+15)%75)+"%" }} />
        ))}
        <div style={{ position: "relative", zIndex: 1, maxWidth: "700px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "20px", background: "rgba(8,145,178,0.2)", border: "1px solid rgba(8,145,178,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Activity size={28} color="#0891B2" />
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: 900, color: "white", margin: "0 0 8px" }}>Anesthesia Calculator</h1>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", margin: 0 }}>CY 2026 Medicare · 277 codes · Auto base units · 109 localities</p>
        </div>
      </div>

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "24px" }}>
        <div style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderRadius: "20px", padding: "24px", border: "1px solid rgba(255,255,255,0.7)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", marginBottom: "20px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted, #6B7280)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "20px" }}>Calculation Parameters</div>

          {/* CPT Code input with auto-lookup */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary, #4B5563)", display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Anesthesia CPT Code
            </label>
            <div style={{ position: "relative" }}>
              <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0,5))}
                placeholder="e.g. 00100"
                style={{ width: "100%", height: "52px", padding: "0 16px", border: `2px solid ${baseUnitInfo ? "#0891B2" : "#E2E8F0"}`, borderRadius: "12px", fontSize: "20px", fontFamily: "monospace", fontWeight: 700, outline: "none", boxSizing: "border-box", color: "var(--text-primary, #111827)", letterSpacing: "3px", transition: "border-color 0.2s" }}
                onFocus={e => { e.target.style.borderColor = "#0891B2"; }} onBlur={e => { if (!baseUnitInfo) e.target.style.borderColor = "#E2E8F0"; }}
              />
              {baseUnitLoading && (
                <div style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", width: "18px", height: "18px", border: "2px solid #E2E8F0", borderTop: "2px solid #0891B2", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              )}
              {baseUnitInfo && !baseUnitLoading && (
                <CheckCircle size={18} color="#0891B2" style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)" }} />
              )}
            </div>

            {/* Auto-populated base unit info */}
            <AnimatePresence>
              {baseUnitInfo && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  style={{ marginTop: "8px", padding: "10px 14px", background: "rgba(8,145,178,0.06)", border: "1px solid rgba(8,145,178,0.2)", borderRadius: "10px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary, #111827)" }}>{baseUnitInfo.description}</div>
                    <div style={{ fontSize: "11px", color: "#0891B2", marginTop: "2px" }}>Base Units: <strong>{baseUnitInfo.baseUnits}</strong> (auto-populated from CMS table)</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Quick codes */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted, #6B7280)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Common Codes</div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {QUICK_CODES.map(c => (
                <button key={c.code} onClick={() => setCode(c.code)}
                  style={{ padding: "5px 10px", background: code === c.code ? "rgba(8,145,178,0.1)" : "#F8FAFC", border: `1px solid ${code === c.code ? "#0891B2" : "#E2E8F0"}`, borderRadius: "8px", fontSize: "11px", fontWeight: 600, color: code === c.code ? "#0891B2" : "#475569", cursor: "pointer", transition: "all 0.15s" }}>
                  <span style={{ fontFamily: "monospace" }}>{c.code}</span>
                  <span style={{ color: "var(--text-muted, #6B7280)", marginLeft: "4px" }}>· {c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            {/* Time */}
            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary, #4B5563)", display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Anesthesia Time (Minutes)
              </label>
              <input type="number" value={minutes} onChange={e => setMinutes(e.target.value)} min="0" max="600" placeholder="e.g. 90"
                style={{ width: "100%", height: "48px", padding: "0 16px", border: "2px solid #E2E8F0", borderRadius: "12px", fontSize: "18px", fontWeight: 700, outline: "none", boxSizing: "border-box", color: "var(--text-primary, #111827)", transition: "border-color 0.2s" }}
                onFocus={e => { e.target.style.borderColor = "#0891B2"; }} onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }}
              />
              {minutes && <div style={{ fontSize: "11px", color: "var(--text-muted, #6B7280)", marginTop: "4px" }}>= {Math.round(Number(minutes)/15)} time units</div>}
            </div>

            {/* Modifier */}
            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary, #4B5563)", display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Anesthesia Modifier
              </label>
              <div style={{ position: "relative" }}>
                <Tag size={15} color="#94A3B8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
                <select value={selectedModifier} onChange={e => setSelectedModifier(e.target.value)}
                  style={{ width: "100%", height: "48px", paddingLeft: "36px", paddingRight: "16px", border: "2px solid #E2E8F0", borderRadius: "12px", fontSize: "13px", outline: "none", color: selectedModifier ? "#0F172A" : "#94A3B8", background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", appearance: "none", cursor: "pointer" }}
                  onFocus={e => { e.target.style.borderColor = "#0891B2"; }} onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }}
                >
                  <option value="">No modifier</option>
                  {modifiers?.map(m => (
                    <option key={m.Modifier} value={m.Modifier}>{m.Modifier} — {m.Description.slice(0, 40)}...</option>
                  ))}
                </select>
                <ChevronDown size={14} color="#94A3B8" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              </div>
              {selectedModifierData && (
                <div style={{ fontSize: "11px", color: "#0891B2", marginTop: "4px" }}>
                  Payment: <strong>{selectedModifierData["PAYMENT ADJUSTMENT"]}</strong> · Required: {selectedModifierData.REQUIRED}
                </div>
              )}
            </div>
          </div>

          {/* Locality */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary, #4B5563)", display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>MAC Locality</label>
            <div style={{ position: "relative" }}>
              <MapPin size={15} color="#94A3B8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
              <select value={selectedLocality} onChange={e => setSelectedLocality(e.target.value)}
                style={{ width: "100%", height: "48px", paddingLeft: "36px", paddingRight: "16px", border: "2px solid #E2E8F0", borderRadius: "12px", fontSize: "14px", outline: "none", color: selectedLocality ? "#0F172A" : "#94A3B8", background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", appearance: "none", cursor: "pointer" }}
                onFocus={e => { e.target.style.borderColor = "#0891B2"; }} onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }}
              >
                <option value="">Select MAC Locality...</option>
                {localities?.map((l, i) => (
                  <option key={i} value={(l["Locality"] || "").trim()}>{l["Locality Name"] || ""} — {(l["Locality"] || "").trim()}</option>
                ))}
              </select>
              <ChevronDown size={14} color="#94A3B8" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            </div>
          </div>

          {/* Qualifying toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "rgba(255,255,255,0.4)", borderRadius: "12px", marginBottom: "16px" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary, #111827)" }}>Qualifying APM Payment</div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary, #4B5563)", marginTop: "2px" }}>Advanced Alternative Payment Model — higher conversion factor</div>
            </div>
            <button onClick={() => setQualifyingAnesthesia(q => !q)}
              style={{ width: "44px", height: "24px", borderRadius: "12px", background: qualifyingAnesthesia ? "#0891B2" : "#E2E8F0", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
              <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", position: "absolute", top: "3px", left: qualifyingAnesthesia ? "23px" : "3px", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }} />
            </button>
          </div>

          <motion.button onClick={calculate} disabled={loading || !canCalculate} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
            style={{ width: "100%", height: "52px", background: canCalculate ? "linear-gradient(135deg, #0891B2, #0E7490)" : "#F1F5F9", color: canCalculate ? "white" : "#94A3B8", border: "none", borderRadius: "16px", fontSize: "16px", fontWeight: 700, cursor: canCalculate ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", boxShadow: canCalculate ? "0 4px 20px rgba(8,145,178,0.3)" : "none" }}>
            {loading ? <div style={{ width: "20px", height: "20px", border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> : <Calculator size={18} />}
            {loading ? "Calculating..." : !baseUnitInfo ? "Enter a CPT code first" : !selectedLocality ? "Select a locality" : "Calculate Payment"}
          </motion.button>
        </div>

        {error && (
          <div style={{ padding: "14px 18px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "12px", fontSize: "13px", color: "#DC2626", display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

              {/* Main payment */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div style={{ padding: "20px", background: qualifyingAnesthesia ? "linear-gradient(135deg, #0891B2, #0E7490)" : "linear-gradient(135deg, #16A34A, #166534)", borderRadius: "20px", color: "white" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, opacity: 0.7, marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Zap size={11} /> {qualifyingAnesthesia ? "QUALIFYING APM" : "NON-QUALIFYING"} PAYMENT
                  </div>
                  <div style={{ fontSize: "36px", fontWeight: 900 }}>
                    ${((result.totalUnits * (qualifyingAnesthesia ? result.qualifyingCf : result.nonQualifyingCf)) * result.modifierMultiplier).toFixed(2)}
                  </div>
                  <div style={{ fontSize: "12px", opacity: 0.7, marginTop: "4px" }}>
                    CF: ${(qualifyingAnesthesia ? result.qualifyingCf : result.nonQualifyingCf)?.toFixed(4)}
                    {result.modifier && ` × ${result.modifier["PAYMENT ADJUSTMENT"]}`}
                  </div>
                </div>

                <div style={{ padding: "20px", background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.7)" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted, #6B7280)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Unit Breakdown</div>
                  {[
                    { label: "Base Units", value: result.baseUnits, sub: `(${code})` },
                    { label: "Time Units", value: result.timeUnits, sub: `(${minutes} min ÷ 15)` },
                    { label: "Total Units", value: result.totalUnits, highlight: true },
                  ].map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: i < 2 ? "1px solid #F1F5F9" : "none" }}>
                      <span style={{ fontSize: "13px", color: "var(--text-secondary, #4B5563)" }}>{item.label} <span style={{ fontSize: "10px", color: "var(--text-muted, #6B7280)" }}>{item.sub}</span></span>
                      <span style={{ fontSize: "16px", fontWeight: item.highlight ? 900 : 700, color: item.highlight ? "#0891B2" : "#0F172A" }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment comparison */}
              <div style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderRadius: "20px", padding: "20px", border: "1px solid rgba(255,255,255,0.7)" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted, #6B7280)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "14px" }}>Payment Comparison</div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ flex: 1, padding: "14px", background: "#F0FDF4", borderRadius: "10px", textAlign: "center" }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "#16A34A", marginBottom: "4px" }}>NON-QUALIFYING</div>
                    <div style={{ fontSize: "22px", fontWeight: 900, color: "#15803D" }}>${(result.totalUnits * result.nonQualifyingCf * result.modifierMultiplier).toFixed(2)}</div>
                    <div style={{ fontSize: "10px", color: "#4ADE80", marginTop: "2px" }}>CF: ${result.nonQualifyingCf?.toFixed(4)}</div>
                  </div>
                  <div style={{ flex: 1, padding: "14px", background: "#ECFEFF", borderRadius: "10px", textAlign: "center" }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "#0891B2", marginBottom: "4px" }}>QUALIFYING APM</div>
                    <div style={{ fontSize: "22px", fontWeight: 900, color: "#0E7490" }}>${(result.totalUnits * result.qualifyingCf * result.modifierMultiplier).toFixed(2)}</div>
                    <div style={{ fontSize: "10px", color: "#22D3EE", marginTop: "2px" }}>CF: ${result.qualifyingCf?.toFixed(4)}</div>
                  </div>
                </div>
              </div>

              {/* Modifier details */}
              {result.modifier && (
                <div style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderRadius: "20px", padding: "16px 20px", border: "1px solid rgba(255,255,255,0.7)" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted, #6B7280)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Tag size={11} /> Applied Modifier
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ padding: "4px 12px", background: "#F5F3FF", color: "#7C3AED", borderRadius: "8px", fontSize: "14px", fontWeight: 800 }}>{result.modifier.Modifier}</span>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary, #111827)" }}>{result.modifier.Description}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary, #4B5563)", marginTop: "2px" }}>Payment: {result.modifier["PAYMENT ADJUSTMENT"]} · Required: {result.modifier.REQUIRED}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Locality details */}
              <div style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderRadius: "20px", padding: "16px 20px", border: "1px solid rgba(255,255,255,0.7)" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted, #6B7280)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <MapPin size={11} /> Locality · {result.localityName}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px" }}>
                  {[
                    { label: "Work GPCI", value: result.workGpci },
                    { label: "PE GPCI", value: result.peGpci },
                    { label: "MP GPCI", value: result.mpGpci },
                  ].map((g, i) => (
                    <div key={i} style={{ padding: "10px", background: "rgba(255,255,255,0.4)", borderRadius: "8px", textAlign: "center" }}>
                      <div style={{ fontSize: "10px", color: "var(--text-muted, #6B7280)", fontWeight: 600, marginBottom: "3px" }}>{g.label}</div>
                      <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-primary, #111827)" }}>{g.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modifiers reference */}
        {modifiers && !result && (
          <div style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderRadius: "20px", padding: "20px", border: "1px solid rgba(255,255,255,0.7)" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted, #6B7280)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Tag size={11} /> Anesthesia Modifiers Reference
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {modifiers.map(m => (
                <div key={m.Modifier} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: "rgba(255,255,255,0.4)", borderRadius: "8px" }}>
                  <span style={{ padding: "2px 8px", background: "#F5F3FF", color: "#7C3AED", borderRadius: "6px", fontSize: "12px", fontWeight: 800, fontFamily: "monospace", flexShrink: 0 }}>{m.Modifier}</span>
                  <span style={{ fontSize: "12px", color: "var(--text-secondary, #4B5563)", flex: 1 }}>{m.Description}</span>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: m["PAYMENT ADJUSTMENT"] === "100%" ? "#16A34A" : m["PAYMENT ADJUSTMENT"] === "50%" ? "#EA580C" : "#94A3B8", flexShrink: 0 }}>{m["PAYMENT ADJUSTMENT"]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <style dangerouslySetInnerHTML={{ __html: "@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}" }} />
    </div>
  );
}

