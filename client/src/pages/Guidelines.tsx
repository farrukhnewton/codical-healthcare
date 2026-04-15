import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, FileText, Shield, Calendar, ExternalLink,
  Loader2, ChevronLeft, ChevronRight, BookOpen,
  X, AlertCircle, RefreshCw, Layers, Hash,
  Tag, ChevronDown, ChevronRight as CRight
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Tab = "icd" | "cpt-hcpcs" | "code" | "search";

interface GuidelineItem {
  id: string;
  chapter: number;
  chapterTitle: string;
  section: string;
  title: string;
  content: string;
  codeRangeStart: string;
  codeRangeEnd: string;
  type: "ICD-10-CM" | "CPT" | "HCPCS" | "General";
  sourceUrl: string;
  tags: string[];
}

interface GuidelinesPage { data: GuidelineItem[]; total: number; page: number; pageSize: number; hasMore: boolean; }
interface ChapterInfo { chapter: number; title: string; count: number; }
interface StatsData {
  totalGuidelines: number; icdChapters: number; cptGuidelines: number; hcpcsGuidelines: number;
  lastSync: string; chapters: ChapterInfo[];
}
interface NlmCode { code: string; description: string; source: string; }
interface CodeLookupResult { guidelines: GuidelineItem[]; nlmInfo: NlmCode | null; }

function useDebounce<T>(v: T, d: number): T {
  const [val, set] = useState(v);
  useEffect(() => { const t = setTimeout(() => set(v), d); return () => clearTimeout(t); }, [v, d]);
  return val;
}

const TYPE_COLORS: Record<string, string> = {
  "ICD-10-CM": "bg-[#0057A8] text-white",
  "CPT": "bg-[#F28C28] text-white",
  "HCPCS": "bg-purple-600 text-white",
  "General": "bg-slate-600 text-white",
};

const CHAPTER_RANGES: Record<number, string> = {
  0: "General", 1: "A00–B99", 2: "C00–D49", 3: "D50–D89", 4: "E00–E89", 5: "F01–F99",
  6: "G00–G99", 7: "H00–H59", 8: "H60–H95", 9: "I00–I99", 10: "J00–J99", 11: "K00–K95",
  12: "L00–L99", 13: "M00–M99", 14: "N00–N99", 15: "O00–O9A", 16: "P00–P96",
  17: "Q00–Q99", 18: "R00–R99", 19: "S00–T88", 20: "V00–Y99", 21: "Z00–Z99",
};

function GuidelineCard({ item, expanded = false }: { item: GuidelineItem; expanded?: boolean }) {
  const [open, setOpen] = useState(expanded);
  return (
    <motion.div
      layout
      className="bg-white rounded-2xl border border-border/50 shadow-sm hover:shadow-md transition-all overflow-hidden group"
    >
      <div className={`h-1 w-full ${item.type === "ICD-10-CM" ? "bg-gradient-to-r from-[#0057A8] to-blue-400" : item.type === "CPT" ? "bg-gradient-to-r from-[#F28C28] to-amber-400" : item.type === "HCPCS" ? "bg-gradient-to-r from-purple-600 to-purple-400" : "bg-gradient-to-r from-slate-500 to-slate-400"}`} />
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="flex flex-wrap gap-1.5 items-center mt-0.5 flex-shrink-0">
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide ${TYPE_COLORS[item.type]}`}>
                {item.type}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-muted-foreground font-mono bg-slate-100 px-2 py-0.5 rounded-lg">{item.section}</span>
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {item.codeRangeStart === item.codeRangeEnd ? item.codeRangeStart : `${item.codeRangeStart}–${item.codeRangeEnd}`}
                </span>
              </div>
              <h3 className="text-sm font-black text-foreground leading-snug">{item.title}</h3>
            </div>
          </div>
          <div className="flex-shrink-0 text-muted-foreground mt-1">
            {open ? <ChevronDown className="w-4 h-4" /> : <CRight className="w-4 h-4" />}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-border/50 pt-4">
              <p className="text-sm text-foreground/80 font-medium leading-relaxed">{item.content}</p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {item.tags.map(tag => (
                  <span key={tag} className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
                    #{tag}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-3 pt-3 border-t border-border/50">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-semibold">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  CMS 2026 Official Guidelines
                </div>
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="ml-auto flex items-center gap-1.5 text-[10px] font-bold text-[#0057A8] hover:text-[#003d75] transition-colors"
                >
                  View Source <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PaginationBar({ page, hasMore, total, pageSize, onPage }: {
  page: number; hasMore: boolean; total: number; pageSize: number; onPage: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between mt-5 pt-4 border-t border-border/50">
      <span className="text-xs font-bold text-muted-foreground">
        {total > 0 ? `${((page - 1) * pageSize) + 1}–${Math.min(page * pageSize, total)} of ${total} guidelines` : "No results"}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} className="h-8 w-8 p-0 rounded-xl">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-xs font-black px-2">{page} / {totalPages}</span>
        <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => onPage(page + 1)} className="h-8 w-8 p-0 rounded-xl">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-center py-16 bg-white rounded-2xl border border-border/50">
      <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
      <p className="text-sm font-bold text-muted-foreground mb-3">Failed to load guidelines</p>
      <Button onClick={onRetry} size="sm" variant="outline" className="gap-2">
        <RefreshCw className="w-3.5 h-3.5" /> Retry
      </Button>
    </div>
  );
}

// ── ICD-10 Chapters Tab ──────────────────────────────────────────────────────
function IcdChaptersTab({ chapters }: { chapters: ChapterInfo[] }) {
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery<GuidelinesPage>({
    queryKey: ["/api/guidelines/type/ICD-10-CM-chapters", selectedChapter, page],
    queryFn: async () => {
      const url = selectedChapter !== null
        ? `/api/guidelines/chapter/${selectedChapter}?pageSize=15&page=${page}`
        : `/api/guidelines/type/ICD-10-CM?pageSize=15&page=${page}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const icdChapters = chapters.filter(c => c.chapter > 0).concat(
    chapters.filter(c => c.chapter === 0).map(c => ({ ...c, title: "General Guidelines" }))
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
      <div className="xl:col-span-1">
        <div className="bg-white rounded-2xl border border-border/50 shadow-sm p-4">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3">ICD-10-CM Chapters</p>
          <div className="space-y-1 max-h-[calc(100vh-22rem)] overflow-y-auto pr-1">
            <button
              onClick={() => { setSelectedChapter(null); setPage(1); }}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                selectedChapter === null
                  ? "bg-[#0057A8] text-white shadow-md"
                  : "text-muted-foreground hover:bg-slate-50 hover:text-foreground"
              }`}
            >
              All ICD-10-CM
            </button>
            {icdChapters.map(c => (
              <button
                key={c.chapter}
                onClick={() => { setSelectedChapter(c.chapter); setPage(1); }}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all ${
                  selectedChapter === c.chapter
                    ? "bg-[#0057A8] text-white shadow-md font-bold"
                    : "text-muted-foreground hover:bg-slate-50 hover:text-foreground font-semibold"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">
                    {c.chapter === 0 ? "General" : `Ch. ${c.chapter}`}: {c.title.length > 20 ? c.title.substring(0, 20) + "…" : c.title}
                  </span>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0 ml-1 ${selectedChapter === c.chapter ? "bg-white/20" : "bg-slate-100"}`}>
                    {c.count}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="xl:col-span-3">
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-border/50 p-16 flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-[#0057A8] animate-spin" />
            <p className="text-sm font-bold text-muted-foreground">Loading guidelines...</p>
          </div>
        ) : isError ? (
          <ErrorCard onRetry={() => refetch()} />
        ) : data && data.data.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground">
                <span className="font-black text-foreground">{data.total}</span> guidelines
                {selectedChapter !== null ? ` in Chapter ${selectedChapter}` : " (ICD-10-CM)"}
              </p>
            </div>
            <motion.div
              key={`${selectedChapter}-${page}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              {data.data.map(item => <GuidelineCard key={item.id} item={item} />)}
            </motion.div>
            <PaginationBar page={page} hasMore={data.hasMore} total={data.total} pageSize={data.pageSize} onPage={setPage} />
          </>
        ) : (
          <div className="bg-white rounded-2xl border border-border/50 p-16 text-center">
            <FileText className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm font-bold text-muted-foreground">No guidelines found for this selection</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── CPT/HCPCS Tab ────────────────────────────────────────────────────────────
function CptHcpcsTab() {
  const [activeType, setActiveType] = useState<"CPT" | "HCPCS" | "General">("CPT");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery<GuidelinesPage>({
    queryKey: ["/api/guidelines/type", activeType, page],
    queryFn: async () => {
      const res = await fetch(`/api/guidelines/type/${encodeURIComponent(activeType)}?pageSize=15&page=${page}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const types = [
    { id: "CPT" as const, label: "CPT Procedure Guidelines", color: "bg-[#F28C28]" },
    { id: "HCPCS" as const, label: "HCPCS Level II", color: "bg-purple-600" },
    { id: "General" as const, label: "General / Reporting", color: "bg-slate-600" },
  ];

  return (
    <div>
      <div className="flex gap-2 mb-5 flex-wrap">
        {types.map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveType(t.id); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeType === t.id ? `${t.color} text-white shadow-md` : "bg-white border border-border/50 text-muted-foreground hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-border/50 p-16 flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-[#0057A8] animate-spin" />
          <p className="text-sm font-bold text-muted-foreground">Loading {activeType} guidelines...</p>
        </div>
      ) : isError ? (
        <ErrorCard onRetry={() => refetch()} />
      ) : data && data.data.length > 0 ? (
        <>
          <p className="text-xs font-bold text-muted-foreground mb-4">
            <span className="font-black text-foreground">{data.total}</span> {activeType} guidelines in CMS database
          </p>
          <motion.div
            key={`${activeType}-${page}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            {data.data.map(item => <GuidelineCard key={item.id} item={item} />)}
          </motion.div>
          <PaginationBar page={page} hasMore={data.hasMore} total={data.total} pageSize={data.pageSize} onPage={setPage} />
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-border/50 p-12 text-center">
          <p className="text-sm font-bold text-muted-foreground">No {activeType} guidelines found</p>
        </div>
      )}
    </div>
  );
}

// ── Code Lookup Tab ───────────────────────────────────────────────────────────
function CodeLookupTab() {
  const [input, setInput] = useState("");
  const [code, setCode] = useState("");

  const { data, isLoading, isError } = useQuery<CodeLookupResult>({
    queryKey: ["/api/guidelines/code", code],
    queryFn: async () => {
      const res = await fetch(`/api/guidelines/code/${encodeURIComponent(code)}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: code.length > 0,
    staleTime: 1000 * 60 * 10,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) setCode(input.trim().toUpperCase());
  };

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="relative flex-1">
          <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          <Input
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            placeholder="Enter ICD-10, CPT, or HCPCS code (e.g., E11.9, 99213, J0171)..."
            className="pl-12 h-12 rounded-2xl border-border/50 bg-white shadow-sm focus-visible:ring-[#0057A8] font-mono font-bold text-sm"
          />
        </div>
        <Button type="submit" disabled={!input.trim()} className="h-12 px-6 rounded-2xl bg-[#0057A8] hover:bg-[#003d75] font-bold gap-2 shadow-lg">
          <Search className="w-4 h-4" /> Lookup
        </Button>
      </form>

      {!code ? (
        <div className="bg-white rounded-2xl border border-border/50 p-12 text-center">
          <div className="w-16 h-16 bg-[#0057A8]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Hash className="w-8 h-8 text-[#0057A8]/40" />
          </div>
          <p className="text-base font-bold text-muted-foreground">Enter any medical code to retrieve its guidelines</p>
          <p className="text-sm text-muted-foreground/60 font-medium mt-1">Covers ICD-10-CM, CPT procedure codes, and HCPCS Level II</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {["E11.9", "I10", "J18.9", "99213", "A41.9", "Z79.4", "O00.1", "S72.001A"].map(ex => (
              <button
                key={ex}
                onClick={() => { setInput(ex); setCode(ex); }}
                className="text-xs font-black font-mono bg-[#0057A8]/10 text-[#0057A8] px-3 py-1.5 rounded-xl hover:bg-[#0057A8]/20 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      ) : isLoading ? (
        <div className="bg-white rounded-2xl border border-border/50 p-16 flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-[#0057A8] animate-spin" />
          <p className="text-sm font-bold text-muted-foreground">Searching CMS guidelines for <span className="font-mono font-black">{code}</span>...</p>
        </div>
      ) : isError ? (
        <ErrorCard onRetry={() => setCode("")} />
      ) : data ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {data.nlmInfo && (
            <div className="bg-gradient-to-r from-[#0057A8] to-[#003d75] text-white rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/50">NLM Clinical Tables · Live</p>
                  <p className="text-sm font-black">{data.nlmInfo.code} — {data.nlmInfo.source}</p>
                </div>
              </div>
              <p className="text-white/90 font-medium text-sm">{data.nlmInfo.description}</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-lg text-[#0057A8] bg-[#0057A8]/10 px-3 py-1 rounded-xl">{code}</span>
              <button onClick={() => { setCode(""); setInput(""); }} className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1">
                <X className="w-3 h-3" /> Clear
              </button>
            </div>
            <p className="text-xs font-bold text-muted-foreground">
              <span className="font-black text-foreground">{data.guidelines.length}</span> applicable guidelines found
            </p>
          </div>

          {data.guidelines.length > 0 ? (
            <div className="space-y-3">
              {data.guidelines.map(item => <GuidelineCard key={item.id} item={item} expanded />)}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-border/50 p-10 text-center">
              <Shield className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm font-bold text-muted-foreground">No specific guidelines found for code <span className="font-mono">{code}</span></p>
              <p className="text-xs text-muted-foreground/60 font-medium mt-1">Try searching for related terms in the Search tab</p>
            </div>
          )}
        </motion.div>
      ) : null}
    </div>
  );
}

// ── Search Tab ────────────────────────────────────────────────────────────────
function SearchTab() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const debouncedQ = useDebounce(q, 400);

  useEffect(() => setPage(1), [debouncedQ]);

  const { data, isLoading, isError, refetch } = useQuery<GuidelinesPage>({
    queryKey: ["/api/guidelines/search", debouncedQ, page],
    queryFn: async () => {
      const params = new URLSearchParams({ q: debouncedQ, page: String(page), pageSize: "12" });
      const res = await fetch(`/api/guidelines/search?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 1000 * 60 * 2,
  });

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        <Input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search all CMS guidelines — sepsis, diabetes, fracture, Z codes, COPD, hypertension..."
          className="pl-12 pr-10 h-12 rounded-2xl border-border/50 bg-white shadow-sm focus-visible:ring-[#0057A8] text-sm"
        />
        {q && (
          <button onClick={() => setQ("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {!debouncedQ ? (
        <div className="bg-white rounded-2xl border border-border/50 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-bold text-muted-foreground">Search all {data?.total || "42+"} CMS official guidelines</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {["sepsis", "diabetes", "hypertension", "fracture", "Z codes", "COVID-19", "pregnancy", "neoplasm", "COPD", "heart failure"].map(s => (
              <button key={s} onClick={() => setQ(s)} className="text-xs font-bold bg-[#0057A8]/10 text-[#0057A8] px-3 py-1.5 rounded-xl hover:bg-[#0057A8]/20 transition-colors">
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : isLoading ? (
        <div className="bg-white rounded-2xl border border-border/50 p-16 flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-[#0057A8] animate-spin" />
          <p className="text-sm font-bold text-muted-foreground">Searching guidelines for "{debouncedQ}"...</p>
        </div>
      ) : isError ? (
        <ErrorCard onRetry={() => refetch()} />
      ) : data && data.data.length > 0 ? (
        <>
          <p className="text-xs font-bold text-muted-foreground">
            Found <span className="font-black text-foreground">{data.total}</span> guidelines matching
            <span className="font-black text-foreground"> "{debouncedQ}"</span>
          </p>
          <motion.div
            key={`${debouncedQ}-${page}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {data.data.map(item => <GuidelineCard key={item.id} item={item} />)}
          </motion.div>
          <PaginationBar page={page} hasMore={data.hasMore} total={data.total} pageSize={data.pageSize} onPage={setPage} />
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-border/50 p-12 text-center">
          <p className="text-sm font-bold text-muted-foreground">No guidelines found for "{debouncedQ}"</p>
          <p className="text-xs text-muted-foreground/60 font-medium mt-1">Try broader keywords or browse by chapter</p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function Guidelines() {
  const [tab, setTab] = useState<Tab>("icd");

  const { data: stats, isLoading: statsLoading } = useQuery<StatsData>({
    queryKey: ["/api/guidelines/stats"],
    queryFn: async () => {
      const res = await fetch("/api/guidelines/stats");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 1000 * 60 * 30,
  });

  const tabs: Array<{ id: Tab; label: string; icon: any; desc: string }> = [
    { id: "icd", label: "ICD-10-CM", icon: Layers, desc: "Chapters 1–21" },
    { id: "cpt-hcpcs", label: "CPT / HCPCS", icon: Tag, desc: "Procedure codes" },
    { id: "code", label: "Code Lookup", icon: Hash, desc: "Any code" },
    { id: "search", label: "Full Search", icon: Search, desc: "All guidelines" },
  ];

  return (
    <div className="p-6 min-h-full space-y-5">
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl p-6 text-white"
        style={{ background: "linear-gradient(135deg, #0057A8 0%, #003d75 65%, #001f3f 100%)" }}
      >
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-32 h-32 bg-[#F28C28]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-xs font-black uppercase tracking-widest text-white/50">CMS ICD-10-CM 2026 · NLM Live Integration</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight">Official CMS Coding Guidelines</h1>
            <p className="text-white/60 text-sm font-medium mt-1">
              ICD-10-CM 2026 Official Guidelines for Coding and Reporting · CPT & HCPCS Rules
            </p>
          </div>
          {statsLoading ? (
            <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
          ) : stats && (
            <div className="flex gap-5 flex-wrap">
              {[
                { label: "Guidelines", value: stats.totalGuidelines },
                { label: "ICD Chapters", value: stats.icdChapters },
                { label: "CPT Rules", value: stats.cptGuidelines },
                { label: "HCPCS Rules", value: stats.hcpcsGuidelines },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className="text-xl font-black">{s.value}</p>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      <div className="flex items-center gap-2 bg-white rounded-2xl border border-border/50 shadow-sm p-1.5">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex-1 flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
              tab === t.id
                ? "bg-[#0057A8] text-white shadow-lg"
                : "text-muted-foreground hover:text-foreground hover:bg-slate-50"
            }`}
          >
            <t.icon className="w-4 h-4" />
            <span>{t.label}</span>
            <span className={`hidden sm:inline text-[9px] font-semibold opacity-70`}>{t.desc}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "icd" && <IcdChaptersTab chapters={stats?.chapters || []} />}
          {tab === "cpt-hcpcs" && <CptHcpcsTab />}
          {tab === "code" && <CodeLookupTab />}
          {tab === "search" && <SearchTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
