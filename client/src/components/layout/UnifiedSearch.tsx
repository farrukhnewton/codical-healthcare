import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Mic,
  MicOff,
  X,
  Clock,
  TrendingUp,
  ChevronRight,
  Zap,
  FileText,
  User,
  Pill,
  Calculator,
  Hash,
} from "lucide-react";
import { useLocation } from "wouter";

const TRENDING = ["99213", "99214", "45378", "Z23", "G0439", "J0696", "99232", "A00"];

const CATEGORY_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: any }
> = {
  code: { label: "CODE", color: "#0369A1", bg: "#EFF6FF", icon: Hash },
  rvu: { label: "RVU", color: "#16A34A", bg: "#F0FDF4", icon: Calculator },
  npi: { label: "PROVIDER", color: "#7C3AED", bg: "#F5F3FF", icon: User },
  drug: { label: "DRUG", color: "#EA580C", bg: "#FFF7ED", icon: Pill },
  coverage: { label: "LCD/NCD", color: "#0891B2", bg: "#ECFEFF", icon: FileText },
};

const HISTORY_KEY = "codicalhealth_search_history";
function getHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}
function addHistory(t: string) {
  const h = getHistory()
    .filter((x: string) => x !== t)
    .slice(0, 9);
  localStorage.setItem(HISTORY_KEY, JSON.stringify([t, ...h]));
}

interface SearchResult {
  id: string;
  type: string;
  category: string;
  title: string;
  subtitle: string;
  action: string;
  data: any;
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
    if (!open) return;
    setQuery("");
    setResults([]);
    setSelected(0);
    setIntent("");
    setHistory(getHistory());
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  

  // Lock background scroll while command palette is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);const doSearch = useCallback(async (q: string) => {
    if (!q || q.length < 1) {
      setResults([]);
      setLoading(false);
      setIntent("");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/unified/search?q=" + encodeURIComponent(q), {
        credentials: "include",
      });
      const data = await res.json();
      setResults(data.results || []);
      setIntent(data.intent || "general");
      setSelected(0);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 250);
  };

  const handleSelect = useCallback(
    (result: SearchResult) => {
      addHistory(
        result.title + (result.subtitle ? " — " + result.subtitle.slice(0, 40) : "")
      );
      onClose();

      if (result.action === "rvu") {
        sessionStorage.setItem("rvu_code", result.data.code);
        setLocation("/rvu");
        return;
      }
      if (result.action === "npi") {
        sessionStorage.setItem("npi_number", result.data.number);
        setLocation("/npi");
        return;
      }
      if (result.action === "drug") {
        sessionStorage.setItem(
          "drug_query",
          result.data.brand_name || result.data.generic_name || result.title
        );
        setLocation("/druglookup");
        return;
      }
      if (result.action === "coverage") {
        sessionStorage.setItem("coverage_lcd", JSON.stringify(result.data));
        sessionStorage.setItem("coverage_search", result.data.search || result.title);
        // Coverage is merged into Coverage & Guidelines hub
        setLocation("/intelligence");
        return;
      }
      if (result.action === "code") {
        setLocation("/intel/" + result.title);
        return;
      }
      setLocation("/intel/" + result.title);
    },
    [onClose, setLocation]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === "Escape") onClose();

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, results.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      }
      if (e.key === "Enter" && results[selected]) {
        handleSelect(results[selected]);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, results, selected, handleSelect, onClose]);

  const handleTrending = (code: string) => {
    setQuery(code);
    doSearch(code);
  };

  const startVoice = () => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const r = new SR();
    r.lang = "en-US";
    r.continuous = false;
    r.interimResults = true;

    r.onstart = () => setListening(true);
    r.onresult = (e: any) => {
      const t = Array.from(e.results)
        .map((x: any) => x[0].transcript)
        .join("");
      setQuery(t);
      if (e.results[0].isFinal) doSearch(t);
    };
    r.onerror = r.onend = () => setListening(false);

    recognitionRef.current = r;
    r.start();
  };

  const voiceSupported =
    typeof window !== "undefined" &&
    ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  const showEmpty = !loading && query.length === 0;

  const orderedCategories = useMemo(
    () => ["code", "drug", "rvu", "npi", "coverage"],
    []
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="fixed inset-0 z-[9999] bg-slate-950/72 backdrop-blur-lg flex items-start justify-center px-3 py-4 sm:px-4 sm:py-[8vh]"
          aria-modal="true"
          role="dialog"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -18 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[760px] max-h-[calc(100vh-2rem)] sm:max-h-[min(760px,calc(100vh-16vh))] appGlassStrong appCard overflow-hidden shadow-2xl flex flex-col"
          >
            {/* Input row */}
            <div className={"flex items-center gap-3 px-5 py-4 " + ((results.length > 0 || showEmpty) ? "border-b border-white/10" : "")}>
              {loading ? (
                <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-emerald-500 animate-spin flex-shrink-0" />
              ) : (
                <Search className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              )}

              <input
                ref={inputRef}
                value={query}
                onChange={(e) => handleChange(e.target.value)}
                placeholder="Search ICD, CPT, HCPCS, RVU, NPI, NDC, LCD/NCD..."
                className="flex-1 bg-transparent outline-none border-0 text-[16px] text-foreground placeholder:text-muted-foreground/80"
              />

              {intent && intent !== "general" && intent !== "empty" && (
                <div className="px-2.5 py-1 rounded-full text-[11px] font-black tracking-[0.14em] uppercase bg-emerald-600 text-white">
                  {intent}
                </div>
              )}

              {voiceSupported && (
                <button
                  onClick={
                    listening
                      ? () => {
                          recognitionRef.current?.stop();
                          setListening(false);
                        }
                      : startVoice
                  }
                  className={
                    "p-2 rounded-lg transition-colors appFocusRing " +
                    (listening
                      ? "bg-red-500/15 text-red-400"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/10")
                  }
                  aria-label={listening ? "Stop voice input" : "Start voice input"}
                >
                  {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}

              {query && (
                <button
                  onClick={() => {
                    setQuery("");
                    setResults([]);
                    inputRef.current?.focus();
                  }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors appFocusRing"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={onClose}
                className="px-2 py-1 rounded-md text-xs font-mono text-muted-foreground border border-white/15 bg-white/5 hover:bg-white/10 transition-colors appFocusRing"
                aria-label="Close (Escape)"
              >
                ESC
              </button>
            </div>

            {/* Listening bar */}
            {listening && (
              <div className="px-5 py-3 bg-red-500/10 border-b border-white/10 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                <span className="text-sm text-red-200">Listening… speak now</span>
              </div>
            )}

            {/* Results */}
            {results.length > 0 && (
              <div className="flex-1 min-h-0 overflow-y-auto py-2">
                {orderedCategories.map((cat) => {
                  const items = results.filter((r) => r.category === cat);
                  if (!items.length) return null;

                  const cfg = CATEGORY_CONFIG[cat];
                  const Icon = cfg.icon;

                  return (
                    <div key={cat} className="mb-2">
                      <div className="px-5 pt-2 pb-1 flex items-center gap-2">
                        <Icon className="w-3 h-3" style={{ color: cfg.color }} />
                        <span className="text-[10px] font-black tracking-[0.22em] uppercase text-muted-foreground/80">
                          {cfg.label}
                        </span>
                      </div>

                      {items.map((r) => {
                        const globalIdx = results.indexOf(r);
                        const isSelected = selected === globalIdx;

                        return (
                          <button
                            key={r.id}
                            onClick={() => handleSelect(r)}
                            onMouseEnter={() => setSelected(globalIdx)}
                            className={
                              "w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors border-l-2 " +
                              (isSelected
                                ? "bg-white/20 dark:bg-white/10 border-l-emerald-500"
                                : "border-l-transparent hover:bg-white/10")
                            }
                          >
                            <div
                              className="px-2 py-1 rounded-lg text-xs font-black font-mono flex-shrink-0"
                              style={{ background: cfg.bg, color: cfg.color }}
                            >
                              {r.type}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-foreground truncate">
                                {r.title}
                              </div>
                              <div className="text-xs text-muted-foreground truncate mt-0.5">
                                {r.subtitle}
                              </div>
                            </div>

                            <ChevronRight
                              className={
                                "w-4 h-4 flex-shrink-0 " +
                                (isSelected ? "text-emerald-400" : "text-white/20")
                              }
                            />
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty state */}
            {showEmpty && (
              <div className="py-3">
                {history.length > 0 && (
                  <div className="mb-2">
                    <div className="px-5 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-muted-foreground/80" />
                        <span className="text-[10px] font-black tracking-[0.22em] uppercase text-muted-foreground/80">
                          Recent
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          localStorage.removeItem(HISTORY_KEY);
                          setHistory([]);
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Clear
                      </button>
                    </div>

                    {history.slice(0, 4).map((h, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          const q = h.split(" — ")[0];
                          setQuery(q);
                          doSearch(q);
                        }}
                        className="w-full px-5 py-2 flex items-center gap-3 hover:bg-white/10 transition-colors text-left"
                      >
                        <Clock className="w-4 h-4 text-white/30 flex-shrink-0" />
                        <span className="text-sm text-muted-foreground truncate">
                          {h}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="px-5 pt-2 pb-2 flex items-center gap-2">
                  <TrendingUp className="w-3 h-3 text-muted-foreground/80" />
                  <span className="text-[10px] font-black tracking-[0.22em] uppercase text-muted-foreground/80">
                    Trending Codes
                  </span>
                </div>

                <div className="px-5 pb-3 flex flex-wrap gap-2">
                  {TRENDING.map((code) => (
                    <button
                      key={code}
                      onClick={() => handleTrending(code)}
                      className="px-3 py-1.5 rounded-full text-sm font-mono font-bold bg-white/10 hover:bg-emerald-600 hover:text-white transition-colors text-muted-foreground"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* No results */}
            {!loading && query.length > 0 && results.length === 0 && (
              <div className="p-10 text-center">
                <div className="text-2xl mb-2">No results</div>
                <div className="text-sm font-bold text-foreground">
                  No results for "{query}"
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Try a code (99213), drug/NDC, provider name, or coverage keyword.
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-5 py-3 border-t border-white/10 flex flex-wrap items-center gap-3">
              {[
                { key: "↑↓", label: "navigate" },
                { key: "Enter", label: "open" },
                { key: "ESC", label: "close" },
              ].map((k) => (
                <div key={k.key} className="flex items-center gap-2">
                  <kbd className="px-2 py-0.5 rounded text-xs font-mono border border-white/15 bg-white/5 text-muted-foreground">
                    {k.key}
                  </kbd>
                  <span className="text-xs text-muted-foreground">{k.label}</span>
                </div>
              ))}

              <div className="ml-auto flex items-center gap-2">
                <Zap className="w-3 h-3 text-emerald-400" />
                <span className="text-xs text-muted-foreground">
                  Codical Intelligence Search
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


