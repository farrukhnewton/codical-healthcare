import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Mic, MicOff, X, Clock, TrendingUp, ChevronRight, Zap, FileText, User, Pill, Shield, Calculator, Hash } from "lucide-react";
import { useLocation } from "wouter";

const TRENDING = ["99213", "99214", "45378", "Z23", "G0439", "J0696", "99232", "A00"];

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  code: { label: "CODE", color: "#0369A1", bg: "#EFF6FF", icon: Hash },
  rvu: { label: "RVU", color: "#16A34A", bg: "#F0FDF4", icon: Calculator },
  npi: { label: "PROVIDER", color: "#7C3AED", bg: "#F5F3FF", icon: User },
  drug: { label: "DRUG", color: "#EA580C", bg: "#FFF7ED", icon: Pill },
  coverage: { label: "LCD/NCD", color: "#0891B2", bg: "#ECFEFF", icon: FileText },
};

const HISTORY_KEY = "codicalhealth_search_history";
function getHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; } }
function addHistory(t: string) { const h = getHistory().filter((x: string) => x !== t).slice(0, 9); localStorage.setItem(HISTORY_KEY, JSON.stringify([t, ...h])); }

interface SearchResult {
  id: string; type: string; category: string;
  title: string; subtitle: string; action: string; data: any;
}

interface UnifiedSearchProps {
  open: boolean;
  onClose: () => void;
}

export function UnifiedSearch({ open, onClose }: UnifiedSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);
  const [intent, setIntent] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (open) {
      setQuery(""); setResults([]); setSelected(0); setIntent("");
      setHistory(getHistory());
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      if (e.key === "Enter" && results[selected]) { handleSelect(results[selected]); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, results, selected]);

  const doSearch = useCallback(async (q: string) => {
    if (!q || q.length < 1) { setResults([]); setLoading(false); setIntent(""); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/unified/search?q=${encodeURIComponent(q)}`, { credentials: "include" });
      const data = await res.json();
      setResults(data.results || []);
      setIntent(data.intent || "general");
      setSelected(0);
    } catch { setResults([]); }
    setLoading(false);
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 250);
  };

  const handleSelect = (result: SearchResult) => {
    addHistory(result.title + (result.subtitle ? " — " + result.subtitle.slice(0, 40) : ""));
    onClose();
    if (result.action === "rvu") {
      sessionStorage.setItem("rvu_code", result.data.code);
      setLocation("/rvu");
    } else if (result.action === "npi") {
      sessionStorage.setItem("npi_number", result.data.number);
      setLocation("/npi");
    } else if (result.action === "drug") {
      sessionStorage.setItem("drug_query", result.data.brand_name || result.data.generic_name || result.title);
      setLocation("/druglookup");
    } else if (result.action === "coverage") {
      sessionStorage.setItem("coverage_lcd", JSON.stringify(result.data));
      setLocation("/coverage");
    } else if (result.action === "code") {
      setLocation("/intel/" + result.title);
    } else {
      setLocation("/intel/" + result.title);
    }
  };

  const handleTrending = (code: string) => { setQuery(code); doSearch(code); };

  const startVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "en-US"; r.continuous = false; r.interimResults = true;
    r.onstart = () => setListening(true);
    r.onresult = (e: any) => {
      const t = Array.from(e.results).map((x: any) => x[0].transcript).join("");
      setQuery(t);
      if (e.results[0].isFinal) doSearch(t);
    };
    r.onerror = r.onend = () => setListening(false);
    recognitionRef.current = r;
    r.start();
  };

  const voiceSupported = typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);
  const showEmpty = !loading && query.length === 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(15,23,42,0.7)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "flex-start", justifyContent: "center",
            paddingTop: "12vh",
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            onClick={e => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: "640px", margin: "0 16px",
              background: "rgba(255,255,255,0.85)", backdropFilter: "blur(24px)", borderRadius: "20px",
              boxShadow: "0 32px 80px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)",
              overflow: "hidden",
            }}
          >
            {/* Search input */}
            <div style={{
              display: "flex", alignItems: "center", gap: "12px",
              padding: "16px 20px",
              borderBottom: results.length > 0 || showEmpty ? "1px solid #F1F5F9" : "none",
            }}>
              {loading ? (
                <div style={{ width: "20px", height: "20px", border: "2px solid #E2E8F0", borderTop: "2px solid #15803D", borderRadius: "50%", animation: "spin 0.6s linear infinite", flexShrink: 0 }} />
              ) : (
                <Search size={20} color="#15803D" style={{ flexShrink: 0 }} />
              )}
              <input
                ref={inputRef}
                value={query}
                onChange={e => handleChange(e.target.value)}
                placeholder="Search codes, providers, drugs, coverage..."
                style={{
                  flex: 1, border: "none", outline: "none",
                  fontSize: "17px", color: "#111827", background: "transparent",
                  fontWeight: 400,
                }}
              />
              {intent && intent !== "general" && intent !== "empty" && (
                <div style={{
                  padding: "3px 10px", borderRadius: "20px", fontSize: "11px",
                  fontWeight: 700, letterSpacing: "0.5px",
                  background: "#15803D", color: "white",
                }}>
                  {intent.toUpperCase()}
                </div>
              )}
              {voiceSupported && (
                <button onClick={listening ? () => { recognitionRef.current?.stop(); setListening(false); } : startVoice}
                  style={{
                    background: listening ? "rgba(239,68,68,0.1)" : "none",
                    border: "none", cursor: "pointer", padding: "6px", borderRadius: "8px",
                    color: listening ? "#EF4444" : "#94A3B8", display: "flex", flexShrink: 0,
                  }}>
                  {listening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              )}
              {query && (
                <button onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "#94A3B8", display: "flex", flexShrink: 0 }}>
                  <X size={16} />
                </button>
              )}
              <button onClick={onClose}
                style={{ padding: "3px 8px", background: "rgba(74,222,128,0.08)", border: "none", borderRadius: "6px", fontSize: "12px", color: "#94A3B8", cursor: "pointer", fontFamily: "monospace", flexShrink: 0 }}>
                ESC
              </button>
            </div>

            {/* Listening */}
            {listening && (
              <div style={{ padding: "12px 20px", background: "#FEF2F2", display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "8px", height: "8px", background: "#EF4444", borderRadius: "50%", animation: "pulse 1s ease-in-out infinite" }} />
                <span style={{ fontSize: "14px", color: "#DC2626", fontWeight: 500 }}>Listening... speak now</span>
              </div>
            )}

            {/* Results */}
            {results.length > 0 && (
              <div style={{ maxHeight: "420px", overflowY: "auto" }}>
                {["code", "rvu", "npi", "drug", "coverage"].map(cat => {
                  const items = results.filter(r => r.category === cat);
                  if (!items.length) return null;
                  const cfg = CATEGORY_CONFIG[cat];
                  return (
                    <div key={cat}>
                      <div style={{ padding: "10px 20px 4px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <cfg.icon size={11} color={cfg.color} />
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "#94A3B8", letterSpacing: "1px" }}>{cfg.label}</span>
                      </div>
                      {items.map((r, i) => {
                        const globalIdx = results.indexOf(r);
                        const isSelected = selected === globalIdx;
                        return (
                          <button key={r.id} onClick={() => handleSelect(r)}
                            style={{
                              width: "100%", display: "flex", alignItems: "center", gap: "12px",
                              padding: "10px 20px", background: isSelected ? "#F8FAFC" : "none",
                              border: "none", cursor: "pointer", textAlign: "left",
                              borderLeft: isSelected ? "3px solid #15803D" : "3px solid transparent",
                            }}
                            onMouseEnter={() => setSelected(globalIdx)}
                          >
                            <div style={{
                              padding: "4px 8px", borderRadius: "8px", fontSize: "12px",
                              fontWeight: 700, fontFamily: "monospace",
                              background: cfg.bg, color: cfg.color, flexShrink: 0,
                              whiteSpace: "nowrap",
                            }}>
                              {r.type}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: "14px", fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {r.title}
                              </div>
                              <div style={{ fontSize: "12px", color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "1px" }}>
                                {r.subtitle}
                              </div>
                            </div>
                            <ChevronRight size={14} color={isSelected ? "#15803D" : "#E2E8F0"} style={{ flexShrink: 0 }} />
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty state — show history + trending */}
            {showEmpty && (
              <div style={{ padding: "8px 0 16px" }}>
                {history.length > 0 && (
                  <div>
                    <div style={{ padding: "8px 20px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Clock size={11} color="#94A3B8" />
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "#94A3B8", letterSpacing: "1px" }}>RECENT</span>
                      </div>
                      <button onClick={() => { localStorage.removeItem(HISTORY_KEY); setHistory([]); }}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: "11px", color: "#CBD5E1" }}>
                        Clear
                      </button>
                    </div>
                    {history.slice(0, 4).map((h, i) => (
                      <button key={i} onClick={() => { setQuery(h.split(" — ")[0]); doSearch(h.split(" — ")[0]); }}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "8px 20px", background: "none", border: "none", cursor: "pointer" }}
                        onMouseOver={e => { e.currentTarget.style.background = "#F8FAFC"; }}
                        onMouseOut={e => { e.currentTarget.style.background = "none"; }}
                      >
                        <Clock size={13} color="#CBD5E1" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: "13px", color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ padding: "12px 20px 4px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <TrendingUp size={11} color="#94A3B8" />
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#94A3B8", letterSpacing: "1px" }}>TRENDING CODES</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", padding: "8px 20px" }}>
                  {TRENDING.map(code => (
                    <button key={code} onClick={() => handleTrending(code)}
                      style={{ padding: "5px 12px", background: "rgba(74,222,128,0.08)", border: "none", borderRadius: "20px", fontSize: "13px", fontWeight: 600, color: "#475569", cursor: "pointer", fontFamily: "monospace", transition: "all 0.15s" }}
                      onMouseOver={e => { e.currentTarget.style.background = "#15803D"; e.currentTarget.style.color = "white"; }}
                      onMouseOut={e => { e.currentTarget.style.background = "#F1F5F9"; e.currentTarget.style.color = "#475569"; }}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* No results */}
            {!loading && query.length > 0 && results.length === 0 && (
              <div style={{ padding: "32px", textAlign: "center" }}>
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>🔍</div>
                <div style={{ fontSize: "15px", fontWeight: 600, color: "#111827" }}>No results for "{query}"</div>
                <div style={{ fontSize: "13px", color: "#94A3B8", marginTop: "4px" }}>Try a code number, drug name, or provider name</div>
              </div>
            )}

            {/* Footer */}
            <div style={{ padding: "10px 20px", borderTop: "1px solid rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: "16px" }}>
              {[{ key: "↑↓", label: "navigate" }, { key: "↵", label: "open" }, { key: "ESC", label: "close" }].map(k => (
                <div key={k.key} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <kbd style={{ padding: "2px 6px", background: "rgba(74,222,128,0.08)", borderRadius: "4px", fontSize: "11px", color: "#64748B", fontFamily: "monospace" }}>{k.key}</kbd>
                  <span style={{ fontSize: "11px", color: "#94A3B8" }}>{k.label}</span>
                </div>
              ))}
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px" }}>
                <Zap size={11} color="#15803D" />
                <span style={{ fontSize: "11px", color: "#94A3B8" }}>Codical Intelligence Search</span>
              </div>
            </div>
          </motion.div>

          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
            @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
          ` }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}