import { UnifiedSearch } from "@/components/layout/UnifiedSearch";
import { Bell, Search, Clock, TrendingUp, ArrowRight, Moon, Sun } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Command Center", subtitle: "Real-time healthcare intelligence overview" },
  "/search": { title: "Code Directory", subtitle: "114,000+ ICD-10-CM, CPT & HCPCS records" },
  "/analytics": { title: "Analytics Hub", subtitle: "Usage trends, patterns & performance insights" },
  "/guidelines": { title: "Regulatory Intelligence", subtitle: "Live CMS compliance & coding standards" },
  "/favorites": { title: "Your Workspace", subtitle: "Curated codes for rapid clinical reference" },
  "/reports": { title: "Reports Center", subtitle: "Generate, export & audit coding reports" },
  "/ncci": { title: "NCCI Checker", subtitle: "National Correct Coding Initiative edits" },
  "/coverage": { title: "Coverage Policies", subtitle: "NCD & LCD from CMS" },
  "/rvu": { title: "RVU Calculator", subtitle: "CY 2026 Medicare Physician Fee Schedule" },
  "/anesthesia": { title: "Anesthesia Calculator", subtitle: "Locality-adjusted conversion factors" },
  "/npi": { title: "NPI Lookup", subtitle: "NPPES provider registry search" },
  "/codelookup": { title: "POS & Modifiers", subtitle: "Place of service and modifier reference" },
  "/druglookup": { title: "Drug / NDC Lookup", subtitle: "FDA NDC drug database" },
};

const TRENDING = ["99213", "45378", "Z23", "G0439", "99214", "J0696"];
const HISTORY_KEY = "codicalhealth_search_history";

function getHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}
function addToHistory(term: string) {
  const history = getHistory().filter(h => h !== term).slice(0, 9);
  localStorage.setItem(HISTORY_KEY, JSON.stringify([term, ...history]));
}

interface SearchResult { type: string; code: string; description: string; }

export function TopBar() {
  const [location, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [userEmail, setUserEmail] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<any>(null);

  const { theme, toggle: toggleTheme } = useTheme();
  const page = PAGE_TITLES[location] || { title: "Codical Health", subtitle: "Enterprise Medical Coding" };

  useEffect(() => { supabase.auth.getUser().then(({ data }) => { if (data.user?.email) setUserEmail(data.user.email); }); }, []);
  useEffect(() => { setHistory(getHistory()); }, [focused]);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && inputRef.current && !inputRef.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/codes/search?query=" + encodeURIComponent(q) + "&limit=8", { credentials: "include" });
      const data = await res.json();
      setResults(Array.isArray(data) ? data.slice(0, 8) : []);
    } catch { setResults([]); }
    setLoading(false);
  }, []);

  const handleChange = (value: string) => { setQuery(value); clearTimeout(debounceRef.current); debounceRef.current = setTimeout(() => doSearch(value), 220); };
  const handleSelect = (r: SearchResult) => { addToHistory(r.code + " - " + r.description.slice(0, 40)); setQuery(r.code + " - " + r.description.slice(0, 40)); setFocused(false); sessionStorage.setItem("codicalhealth_sq", r.code); setLocation("/search"); };
  const handleHistorySelect = (term: string) => { setQuery(term); setFocused(false); doSearch(term); sessionStorage.setItem("codicalhealth_sq", term.split(" - ")[0]); setLocation("/search"); };
  const handleTrending = (code: string) => { setQuery(code); setFocused(false); sessionStorage.setItem("codicalhealth_sq", code); setLocation("/search"); };
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!query.trim()) return; addToHistory(query.trim()); setFocused(false); sessionStorage.setItem("codicalhealth_sq", query.trim()); setLocation("/search"); };

  const showDropdown = focused && (query.length === 0 || results.length > 0 || loading);
  const userInitials = userEmail ? userEmail.slice(0, 2).toUpperCase() : "CH";

  return (
    <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="h-14 flex items-center justify-between px-4 lg:px-6 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border-b border-emerald-100/60 dark:border-emerald-900/30 z-40 flex-shrink-0 gap-4">
      <div className="flex-shrink-0 min-w-0">
        <h1 className="text-sm lg:text-base font-bold text-gray-900 dark:text-white leading-tight truncate">{page.title}</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 hidden sm:block truncate">{page.subtitle}</p>
      </div>

      <div className="flex-1 max-w-xl relative">
        <button onClick={() => setSearchOpen(true)} className="w-full flex items-center gap-3 h-9 px-4 bg-white/60 border-2 border-emerald-200/60 rounded-xl cursor-pointer transition-all text-gray-500 hover:border-emerald-400 hover:bg-white hover:shadow-[0_0_0_3px_rgba(74,222,128,0.08)]">
          <Search className="w-4 h-4 flex-shrink-0 text-emerald-500" />
          <span className="flex-1 text-left text-sm">Search codes, providers, drugs...</span>
          <kbd className="px-2 py-0.5 bg-emerald-50 rounded text-xs text-emerald-600 font-mono hidden sm:block">/</kbd>
        </button>

        <AnimatePresence>
          {showDropdown && (
            <motion.div ref={dropdownRef} initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }} transition={{ duration: 0.15 }} className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl rounded-xl shadow-xl border border-emerald-100/60 overflow-hidden z-50">
              {results.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 tracking-wider">RESULTS</div>
                  {results.map((r, i) => (
                    <button key={i} onClick={() => handleSelect(r)} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-emerald-50/50 transition-colors">
                      <div className={"px-2 py-0.5 rounded text-xs font-bold font-mono flex-shrink-0 " + (r.type === "ICD-10-CM" ? "bg-sky-50 text-sky-600" : r.type === "CPT" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>{r.code}</div>
                      <span className="text-sm text-gray-700 flex-1 truncate">{r.description?.replace(/^"|"$/g, "")}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{r.type}</span>
                    </button>
                  ))}
                </div>
              )}
              {query.length === 0 && history.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 tracking-wider flex justify-between">
                    <span>RECENT</span>
                    <button onClick={() => { localStorage.removeItem(HISTORY_KEY); setHistory([]); }} className="text-gray-300 hover:text-gray-500">Clear</button>
                  </div>
                  {history.slice(0, 5).map((h, i) => (
                    <button key={i} onClick={() => handleHistorySelect(h)} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-emerald-50/50 transition-colors">
                      <Clock className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                      <span className="text-sm text-gray-600 flex-1 truncate">{h}</span>
                      <ArrowRight className="w-3 h-3 text-gray-200 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
              {query.length === 0 && (
                <div className="px-4 pt-2 pb-3">
                  <div className="text-[10px] font-bold text-gray-400 tracking-wider mb-2 flex items-center gap-1"><TrendingUp className="w-2.5 h-2.5" />TRENDING</div>
                  <div className="flex flex-wrap gap-1.5">
                    {TRENDING.map(code => (
                      <button key={code} onClick={() => handleTrending(code)} className="px-2.5 py-1 bg-emerald-50 rounded-full text-xs font-semibold text-emerald-700 hover:bg-emerald-500 hover:text-white transition-all font-mono">{code}</button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={toggleTheme} className="w-9 h-9 rounded-xl bg-white/60 dark:bg-white/10 border border-emerald-200/60 dark:border-emerald-800/30 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button className="w-9 h-9 rounded-xl bg-white/60 dark:bg-white/10 border border-emerald-200/60 dark:border-emerald-800/30 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full border border-white" />
        </button>
        <div className="hidden sm:flex items-center gap-2 px-2 py-1.5 bg-white/60 border border-emerald-200/60 rounded-xl">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: "linear-gradient(135deg, #15803D, #0369A1)" }}>{userInitials}</div>
          <div>
            <p className="text-xs font-bold text-gray-900 leading-none">{userEmail ? userEmail.split("@")[0] : "Admin"}</p>
            <p className="text-[10px] text-gray-400 leading-none mt-0.5">Pro Plan</p>
          </div>
        </div>
      </div>

      <UnifiedSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </motion.header>
  );
}
