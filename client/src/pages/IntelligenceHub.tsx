import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import {
  BookOpen, Shield, Search, ExternalLink,
  Download, Globe,
  BookMarked, Stethoscope, Tag,
  ChevronDown, Building2, ShieldAlert,
  AlertTriangle, RefreshCw, CheckCircle2,
  Loader2, Link2, DatabaseZap, ClipboardList
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { id: "guidelines",  label: "National Guidelines",   icon: BookOpen   },
  { id: "medicare",    label: "Medicare (LCD/NCD)",     icon: Shield     },
  { id: "commercial",  label: "Commercial Carriers",    icon: Building2  },
  { id: "resources",   label: "Official Resources",     icon: Globe      },
];

// ─── Static data ──────────────────────────────────────────────────────────────
const CMS_RESOURCES = [
  {
    category: "ICD-10-CM", color: "#2563EB",
    items: [
      { title: "FY 2026 ICD-10-CM Official Coding Guidelines", desc: "Official guidelines for coding and reporting FY2026", url: "https://www.cms.gov/files/document/fy-2026-icd-10-cm-coding-guidelines.pdf", type: "PDF", date: "Oct 2025" },
      { title: "FY 2026 ICD-10-CM Codes", desc: "Complete tabular list and index", url: "https://www.cms.gov/medicare/coding-billing/icd-10-codes", type: "WEB", date: "Oct 2025" },
      { title: "ICD-10-CM Code Updates (Addenda)", desc: "Additions, deletions, and revisions to the ICD-10-CM code set", url: "https://www.cms.gov/medicare/coding-billing/icd-10-codes/icd-10-cm-code-updates", type: "WEB", date: "Oct 2025" },
    ]
  },
  {
    category: "CPT / E&M", color: "#7C3AED",
    items: [
      { title: "AMA CPT E/M Guidelines 2026", desc: "Current Procedural Terminology evaluation and management documentation guidelines", url: "https://www.ama-assn.org/practice-management/cpt/cpt-evaluation-and-management", type: "WEB", date: "Jan 2026" },
      { title: "Medicare Claims Processing Manual Ch.12", desc: "Physicians/Nonphysician Practitioners billing instructions", url: "https://www.cms.gov/regulations-and-guidance/guidance/manuals/downloads/clm104c12.pdf", type: "PDF", date: "2026" },
    ]
  },
  {
    category: "Medicare Fee Schedule", color: "#16A34A",
    items: [
      { title: "CY 2026 Physician Fee Schedule Final Rule", desc: "Complete CY2026 PFS final rule and payment rates", url: "https://www.cms.gov/medicare/payment/fee-schedules/physician", type: "WEB", date: "Nov 2025" },
      { title: "MPFS Relative Value Files", desc: "Download RVU data files for current and prior years", url: "https://www.cms.gov/medicare/payment/fee-schedules/physician/pfs-relative-value-files", type: "WEB", date: "2026" },
    ]
  },
  {
    category: "HCPCS / DME", color: "#EA580C",
    items: [
      { title: "HCPCS Level II Code Set", desc: "Alphanumeric medical code set for products, supplies, and services", url: "https://www.cms.gov/medicare/coding-billing/healthcare-common-procedure-system", type: "WEB", date: "2026" },
      { title: "DME Coverage Determination", desc: "Medicare coverage policies for durable medical equipment", url: "https://www.cms.gov/medicare/coverage/coverage-database", type: "WEB", date: "2026" },
    ]
  },
];

// Type filter tabs for guidelines
const TYPE_FILTERS = [
  { id: "All", label: "All" },
  { id: "General", label: "General" },
  { id: "ICD-10-CM", label: "ICD-10-CM" },
  { id: "CPT", label: "CPT / E&M" },
  { id: "HCPCS", label: "HCPCS" },
];

const TYPE_COLORS: Record<string, { icon: string; bg: string }> = {
  "General":    { icon: "#2563EB", bg: "#2563EB20" },
  "ICD-10-CM":  { icon: "#16A34A", bg: "#16A34A20" },
  "CPT":        { icon: "#7C3AED", bg: "#7C3AED20" },
  "HCPCS":      { icon: "#EA580C", bg: "#EA580C20" },
};

type CoverageMode = "lcd" | "ncd" | "article";
type CoveragePairStatus = "covered" | "noncovered" | "mixed" | "not_found";

interface CoveragePairEvidence {
  icdCode: string;
  procedureCode: string;
  status: CoveragePairStatus;
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

interface CoverageBatchResult {
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
  pairs: CoveragePairEvidence[];
}

function getCoverageId(item: any) {
  return String(item?.document_display_id || item?.lcd_id || item?.ncd_id || item?.article_id || item?.id || "Coverage");
}

function getCoverageVersion(item: any) {
  return String(item?.version || item?.document_version || item?.version_number || item?.ncd_version || item?.lcd_version || item?.article_version || "");
}

function getCoverageUrl(item: any, mode: CoverageMode) {
  const id = getCoverageId(item);
  const version = getCoverageVersion(item);
  const numericId = id.replace(/^[A-Z]/i, "");

  if (mode === "lcd") {
    return `https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid=${encodeURIComponent(numericId)}${version ? `&ver=${encodeURIComponent(version)}` : ""}`;
  }

  if (mode === "article") {
    return `https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleid=${encodeURIComponent(numericId)}${version ? `&ver=${encodeURIComponent(version)}` : ""}`;
  }

  return `https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?ncdid=${encodeURIComponent(id)}${version ? `&ncdver=${encodeURIComponent(version)}` : ""}`;
}

function CoverageResultCard({ item, mode }: { item: any; mode: CoverageMode }) {
  const id = getCoverageId(item);
  const title = item?.title || item?.document_title || item?.article_title || "Untitled coverage document";
  const contractor = item?.contractor_name_type || item?.contractor_name || item?.contractor || "";
  const status = item?.status || item?.document_status || "";
  const effective = item?.effective_date || item?.effectiveDate || item?.original_effective_date || "";
  const updated = item?.last_updated || item?.last_updated_date || item?.revision_effective_date || "";
  const badgeClass =
    mode === "lcd"
      ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
      : mode === "article"
        ? "bg-violet-500/20 text-violet-300 border-violet-500/30"
        : "bg-orange-500/20 text-orange-300 border-orange-500/30";

  return (
    <div className="p-4 rounded-2xl appGlass appCard border border-white/15 hover:border-emerald-500/40 transition-all">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge className={badgeClass} variant="outline">
              {mode === "article" ? "Article" : mode.toUpperCase()}
            </Badge>
            <span className="font-mono text-xs font-black text-foreground">{id}</span>
            {status && <span className="text-[10px] font-bold text-emerald-300">{status}</span>}
          </div>
          <h3 className="text-sm font-black text-foreground leading-snug">{title}</h3>
          {contractor && <p className="text-xs text-muted-foreground mt-1">{contractor}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
            {effective && <span>Effective: {effective}</span>}
            {updated && <span>Updated: {updated}</span>}
            {getCoverageVersion(item) && <span>Version: {getCoverageVersion(item)}</span>}
          </div>
        </div>
        <Button asChild size="sm" variant="outline" className="gap-1.5 flex-shrink-0">
          <a href={getCoverageUrl(item, mode)} target="_blank" rel="noreferrer noopener">
            <ExternalLink size={12} /> CMS
          </a>
        </Button>
      </div>
    </div>
  );
}

function splitCoverageCodes(value: string) {
  return value
    .split(/[\s,;]+/)
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
}

function coveragePairStatusStyle(status: CoveragePairStatus) {
  if (status === "covered") {
    return {
      label: "Covered",
      icon: CheckCircle2,
      badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      card: "border-emerald-500/25 bg-emerald-500/5",
    };
  }

  if (status === "noncovered") {
    return {
      label: "Noncovered",
      icon: ShieldAlert,
      badge: "bg-red-500/15 text-red-300 border-red-500/30",
      card: "border-red-500/25 bg-red-500/5",
    };
  }

  if (status === "mixed") {
    return {
      label: "Mixed",
      icon: AlertTriangle,
      badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      card: "border-amber-500/25 bg-amber-500/5",
    };
  }

  return {
    label: "No coverage evidence",
    icon: Shield,
    badge: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    card: "border-white/15 bg-white/[0.03]",
  };
}

function CoveragePairChecker() {
  const [procedureCode, setProcedureCode] = useState("");
  const [diagnosisInput, setDiagnosisInput] = useState("");
  const [result, setResult] = useState<CoverageBatchResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const diagnosisCodes = useMemo(() => splitCoverageCodes(diagnosisInput).slice(0, 8), [diagnosisInput]);
  const normalizedProcedureCode = procedureCode.trim().toUpperCase();
  const canCheck = normalizedProcedureCode.length > 0 && diagnosisCodes.length > 0 && !loading;

  const checkPairs = async () => {
    if (!canCheck) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/coverage/pair/batch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          procedureCodes: [normalizedProcedureCode],
          diagnosisCodes,
          limit: 8,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Coverage evidence check failed");
      }

      setResult(data);
    } catch (err: any) {
      setError(err?.message || "Coverage evidence check failed");
    } finally {
      setLoading(false);
    }
  };

  const loadExample = () => {
    setProcedureCode("29877");
    setDiagnosisInput("M17.0 E11.9");
    setResult(null);
    setError("");
  };

  return (
    <div className="p-5 rounded-2xl appGlass appCard border border-amber-500/20 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <ClipboardList className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h3 className="font-bold text-foreground mb-1">ICD-to-Procedure Coverage Evidence</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Check whether ICD-10 diagnoses appear in the same CMS article group as a CPT or HCPCS code.
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={loadExample} className="rounded-full flex-shrink-0">
          Load example
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[180px_1fr_auto]">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">CPT/HCPCS</label>
          <Input
            value={procedureCode}
            onChange={(event) => setProcedureCode(event.target.value.toUpperCase())}
            onKeyDown={(event) => event.key === "Enter" && checkPairs()}
            placeholder="29877"
            className="mt-1 font-mono"
          />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">ICD-10 diagnoses</label>
          <Input
            value={diagnosisInput}
            onChange={(event) => setDiagnosisInput(event.target.value.toUpperCase())}
            onKeyDown={(event) => event.key === "Enter" && checkPairs()}
            placeholder="M17.0, E11.9"
            className="mt-1 font-mono"
          />
        </div>
        <div className="flex items-end">
          <Button onClick={checkPairs} disabled={!canCheck} className="w-full lg:w-auto gap-2">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Shield size={15} />}
            Check Evidence
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        This is coverage-derived intelligence from CMS article groups, not an official CMS crosswalk. Verify final billing decisions against the source article.
      </p>

      {error && (
        <div className="p-3 rounded-xl border border-red-500/25 bg-red-500/10 text-sm text-red-200">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              { label: "Covered", value: result.counts.covered, className: "text-emerald-300" },
              { label: "Noncovered", value: result.counts.noncovered, className: "text-red-300" },
              { label: "Mixed", value: result.counts.mixed, className: "text-amber-300" },
              { label: "No Evidence", value: result.counts.notFound, className: "text-slate-300" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <div className={`text-xl font-black ${item.className}`}>{item.value}</div>
                <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{item.label}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-2">
            {result.pairs.map((pair) => {
              const status = coveragePairStatusStyle(pair.status);
              const StatusIcon = status.icon;

              return (
                <div key={`${pair.procedureCode}-${pair.icdCode}`} className={`rounded-xl border p-3 ${status.card}`}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-black text-emerald-200">{pair.procedureCode}</span>
                        <span className="text-muted-foreground">+</span>
                        <span className="font-mono text-xs font-black text-sky-200">{pair.icdCode}</span>
                        <Badge variant="outline" className={`${status.badge} gap-1`}>
                          <StatusIcon size={11} />
                          {status.label}
                        </Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Searched {pair.searchedDocumentCount} article{pair.searchedDocumentCount === 1 ? "" : "s"}; {pair.evidenceCount} evidence row{pair.evidenceCount === 1 ? "" : "s"}.
                      </div>
                      {pair.topEvidence && (
                        <div className="mt-2 text-xs text-muted-foreground leading-relaxed">
                          <span className="font-black text-foreground">{pair.topEvidence.displayId}</span>
                          {" group "}{pair.topEvidence.groupNumber}: {pair.topEvidence.title}
                        </div>
                      )}
                    </div>
                    {pair.topEvidence && (
                      <Button asChild size="sm" variant="outline" className="gap-1.5 flex-shrink-0">
                        <a href={getCoverageUrl({ document_display_id: pair.topEvidence.displayId, article_version: "" }, "article")} target="_blank" rel="noreferrer noopener">
                          <ExternalLink size={12} /> CMS
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LiveMedicarePolicyList() {
  const storedCoverage = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem("coverage_lcd") || "null");
    } catch {
      return null;
    }
  }, []);

  const [mode, setMode] = useState<CoverageMode>(() => storedCoverage?.coverageType === "NCD" ? "ncd" : "lcd");
  const [searchTerm, setSearchTerm] = useState(() =>
    sessionStorage.getItem("coverage_search") || storedCoverage?.search || ""
  );
  const [debouncedSearch] = useDebounce(searchTerm, 350);

  useEffect(() => {
    sessionStorage.removeItem("coverage_lcd");
    sessionStorage.removeItem("coverage_search");
  }, []);

  const query = debouncedSearch.trim();

  const lcdQuery = useQuery({
    queryKey: ["/api/coverage/lcd", "smart", query],
    queryFn: async () => {
      const endpoint = query
        ? `/api/coverage/lcd/search/smart?q=${encodeURIComponent(query)}`
        : "/api/coverage/lcd?limit=30";
      const res = await fetch(endpoint, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "CMS LCD API unavailable");
      }
      return res.json();
    },
    enabled: mode === "lcd",
    retry: false,
    staleTime: 1000 * 60 * 20,
  });

  const ncdQuery = useQuery({
    queryKey: ["/api/coverage/ncd", query],
    queryFn: async () => {
      const endpoint = `/api/coverage/ncd?limit=30${query ? `&search=${encodeURIComponent(query)}` : ""}`;
      const res = await fetch(endpoint, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "CMS NCD API unavailable");
      }
      return res.json();
    },
    enabled: mode === "ncd",
    retry: false,
    staleTime: 1000 * 60 * 20,
  });

  const articleQuery = useQuery({
    queryKey: ["/api/coverage/articles", query],
    queryFn: async () => {
      const endpoint = `/api/coverage/articles?limit=30${query ? `&search=${encodeURIComponent(query)}` : ""}`;
      const res = await fetch(endpoint, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "CMS article API unavailable");
      }
      return res.json();
    },
    enabled: mode === "article",
    retry: false,
    staleTime: 1000 * 60 * 20,
  });

  const activeQuery = mode === "lcd" ? lcdQuery : mode === "article" ? articleQuery : ncdQuery;
  const rows: any[] = mode === "lcd"
    ? Array.isArray(lcdQuery.data?.results) ? lcdQuery.data.results : Array.isArray(lcdQuery.data) ? lcdQuery.data : []
    : mode === "article"
      ? Array.isArray(articleQuery.data) ? articleQuery.data : []
      : Array.isArray(ncdQuery.data) ? ncdQuery.data : [];

  const searchTerms: string[] = mode === "lcd" && Array.isArray(lcdQuery.data?.searchTerms)
    ? lcdQuery.data.searchTerms
    : query ? [query] : [];

  const examples = mode === "lcd"
    ? ["diabetes", "cardiac", "wound care", "sleep study", "99214", "J1100"]
    : mode === "article"
      ? ["billing and coding", "cardiac", "wound care", "J1100", "sleep testing"]
      : ["diabetes", "sleep apnea", "transplants", "home health", "mri"];

  return (
    <div className="space-y-5">
      <div className="p-5 rounded-2xl appGlass appCard border border-emerald-500/20 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold text-foreground mb-1">Live Medicare Coverage</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Search LCDs, NCDs, and related coverage articles from Codical's Medicare coverage index.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {(["lcd", "ncd", "article"] as const).map((item) => (
            <Button
              key={item}
              size="sm"
              variant={mode === item ? "default" : "outline"}
              onClick={() => setMode(item)}
              className="rounded-full"
            >
              {item === "article" ? "Articles" : item.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      <CoveragePairChecker />

      <div className="p-4 rounded-2xl appGlass appCard border border-white/15">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={
              mode === "lcd"
                ? "Search LCDs by keyword, CPT/HCPCS, contractor, or LCD ID..."
                : mode === "article"
                  ? "Search coverage articles by keyword, CPT/HCPCS, contractor, or article ID..."
                  : "Search NCDs by keyword, chapter, or NCD section..."
            }
            className="pl-10 h-11"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {examples.map((item) => (
            <button
              key={item}
              onClick={() => setSearchTerm(item)}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 hover:bg-emerald-600 hover:text-white transition-colors text-muted-foreground"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {searchTerms.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Search terms:</span>
          {searchTerms.map((term) => (
            <Badge key={term} variant="outline" className="rounded-full bg-white/5">{term}</Badge>
          ))}
        </div>
      )}

      {activeQuery.isLoading || activeQuery.isFetching ? (
        <div className="grid gap-3">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="h-24 rounded-2xl appGlass border border-white/10 animate-pulse" />
          ))}
        </div>
      ) : activeQuery.isError ? (
        <div className="p-6 rounded-2xl appGlass appCard border border-amber-500/30 flex gap-4 items-start">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-foreground mb-1">Medicare coverage data could not load from this environment</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              {(activeQuery.error as Error)?.message || "The CMS Coverage API did not return JSON."}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The in-app LCD/NCD/article workflow uses Codical's coverage index first, with the live CMS Coverage API as fallback when needed.
            </p>
            <Button asChild size="sm" variant="outline" className="mt-4 gap-1.5">
              <a href="https://www.cms.gov/medicare-coverage-database/search/search-criteria.aspx" target="_blank" rel="noreferrer noopener">
                <ExternalLink size={12} /> Open Medicare Coverage Database
              </a>
            </Button>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground appGlass appCard rounded-2xl border border-white/15">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No {mode === "article" ? "article" : mode.toUpperCase()} results found{query ? ` for "${query}"` : ""}.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="text-xs text-muted-foreground">
            Showing {rows.length} {mode === "article" ? "article" : mode.toUpperCase()} result{rows.length === 1 ? "" : "s"} from the Medicare coverage index
          </p>
          {rows.map((item, index) => (
            <CoverageResultCard key={`${getCoverageId(item)}-${index}`} item={item} mode={mode} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Commercial payers ────────────────────────────────────────────────────────
function CommercialPayerList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPayerId, setSelectedPayerId] = useState<number | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [debouncedSearch] = useDebounce(searchTerm, 300);
  const queryClient = useQueryClient();

  const { data: payers = [], isLoading: payersLoading } = useQuery({
    queryKey: ["/api/payers"],
    queryFn: async () => {
      const res = await fetch("/api/payers");
      if (!res.ok) throw new Error("Unable to load carriers");
      return res.json();
    }
  });

  const policyQuery = useQuery({
    queryKey: ["/api/payer-policies", debouncedSearch, selectedPayerId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "80");
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      if (selectedPayerId) params.set("payerId", String(selectedPayerId));
      const res = await fetch(`/api/payer-policies?${params.toString()}`);
      if (!res.ok) throw new Error("Unable to load payer policies");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const normalizeUrl = (u?: string) => {
    const t = String(u || "").trim();
    if (!t) return "";
    if (/^https?:\/\//i.test(t)) return t;
    return "https://" + t;
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
  };

  const filteredPayers = payers.filter((p: any) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.shortName?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const policies = policyQuery.data?.policies || [];
  const totalPolicies = payers.reduce((sum: number, payer: any) => sum + Number(payer.policyCount || 0), 0);
  const syncedCarriers = payers.filter((payer: any) => Number(payer.policyCount || 0) > 0).length;
  const selectedPayer = selectedPayerId ? payers.find((payer: any) => payer.id === selectedPayerId) : null;

  const handleSync = async (payerId: number) => {
    setSyncingId(payerId);
    setSyncMessage("");
    try {
      const { data: authData } = await supabase.auth.getSession();
      const supabaseUid = authData.session?.user.id;
      const res = await fetch(`/api/payers/${payerId}/sync-policies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(supabaseUid ? { "x-supabase-uid": supabaseUid } : {}),
        },
        body: JSON.stringify({ limit: 20 }),
      });
      const syncData = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(syncData.message || "Sync failed");
      setSyncMessage(`${syncData.payer?.shortName || syncData.payer?.name || "Carrier"} indexed ${syncData.indexed} source${syncData.indexed === 1 ? "" : "s"} (${syncData.created} new, ${syncData.updated} updated).`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/payers"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/payer-policies"] }),
      ]);
    } catch (error: any) {
      setSyncMessage(error?.message || "Unable to sync payer policies from this environment.");
    } finally {
      setSyncingId(null);
    }
  };

  const renderCodes = (policy: any) => {
    const codes = [
      ...(policy.cptCodes || []).slice(0, 3),
      ...(policy.hcpcsCodes || []).slice(0, 3),
      ...(policy.drugCodes || []).slice(0, 2),
    ].slice(0, 6);
    if (codes.length === 0) {
      return <span className="text-[10px] text-muted-foreground/60">No code list extracted</span>;
    }
    return codes.map((code: string) => (
      <Badge key={code} variant="outline" className="rounded-full bg-white/5 text-[10px]">
        {code}
      </Badge>
    ));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          ["Carriers", payers.length, Building2],
          ["Indexed Policies", totalPolicies, DatabaseZap],
          ["Synced Sources", syncedCarriers, CheckCircle2],
        ].map(([label, value, Icon]: any) => (
          <div key={label} className="p-4 rounded-2xl appGlass appCard border border-white/15">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-black text-foreground">{Number(value).toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <Icon className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-5 rounded-2xl appGlass appCard border border-emerald-500/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-bold text-foreground mb-1">Commercial Carrier Policy Index</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Sync official carrier policy pages into Supabase, then search indexed policy titles, excerpts, CPT, HCPCS, and drug code references inside Codical.
              </p>
            </div>
          </div>
          {syncMessage && (
            <Badge variant="outline" className="w-fit max-w-full rounded-full bg-white/10 text-[11px]">
              {syncMessage}
            </Badge>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search carriers, policies, CPT, HCPCS, NDC, or policy text..."
          className="pl-10 h-11"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-5">
        <div className="space-y-3">
          <button
            onClick={() => setSelectedPayerId(null)}
            className={`w-full text-left p-4 rounded-2xl appGlass appCard border transition-all ${selectedPayerId === null ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/15 hover:bg-white/10"}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-foreground">All commercial carriers</span>
              <Badge variant="outline" className="rounded-full">{totalPolicies}</Badge>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Search the full Supabase policy index.</p>
          </button>

          {payersLoading ? (
            [...Array(6)].map((_, i) => (
              <div key={i} className="h-24 rounded-2xl appGlass appCard border border-white/15 animate-pulse" />
            ))
          ) : filteredPayers.map((payer: any) => {
            const policyUrl = normalizeUrl(payer.policyPortalUrl);
            const paUrl = normalizeUrl(payer.paPortalUrl);
            const isSelected = selectedPayerId === payer.id;
            return (
              <div key={payer.id} className={`p-4 rounded-2xl appGlass appCard border transition-all ${isSelected ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/15 hover:bg-white/10"}`}>
                <button onClick={() => setSelectedPayerId(payer.id)} className="w-full text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-foreground truncate">{payer.name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">{payer.shortName}</span>
                        <Badge variant="outline" className="rounded-full bg-white/5 text-[10px]">{payer.policyCount || 0} indexed</Badge>
                      </div>
                    </div>
                    <Building2 className="w-5 h-5 text-muted-foreground/50 flex-shrink-0" />
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    {payer.lastPolicyFetch ? `Last sync ${formatDate(payer.lastPolicyFetch)}` : "Not synced yet"}
                  </p>
                </button>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Button size="sm" variant="outline" className="h-8 text-[10px]" onClick={() => handleSync(payer.id)} disabled={syncingId === payer.id || !policyUrl}>
                    {syncingId === payer.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                    Sync
                  </Button>
                  <Button asChild size="sm" variant="outline" className="h-8 text-[10px]" disabled={!policyUrl}>
                    <a href={policyUrl || "#"} target="_blank" rel="noreferrer noopener">
                      <BookOpen className="w-3 h-3 mr-1" /> Source
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="h-8 text-[10px]" disabled={!paUrl}>
                    <a href={paUrl || "#"} target="_blank" rel="noreferrer noopener">
                      <Link2 className="w-3 h-3 mr-1" /> PA
                    </a>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-base font-black text-foreground">
                {selectedPayer ? `${selectedPayer.name} Policies` : "Indexed Commercial Policies"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {policyQuery.isFetching ? "Refreshing from Supabase..." : `${policies.length} policy record${policies.length === 1 ? "" : "s"} shown`}
              </p>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => policyQuery.refetch()}>
              <RefreshCw className="w-3 h-3" /> Refresh
            </Button>
          </div>

          {policyQuery.isLoading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="h-28 rounded-2xl appGlass appCard border border-white/15 animate-pulse" />
            ))
          ) : policyQuery.isError ? (
            <div className="p-6 rounded-2xl appGlass appCard border border-amber-500/30 flex gap-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">Commercial policies could not load from Supabase.</p>
            </div>
          ) : policies.length === 0 ? (
            <div className="py-14 text-center appGlass appCard rounded-2xl border border-white/15">
              <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm font-bold text-foreground">No indexed commercial policies yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">Use Sync on a carrier to ingest official policy sources into Supabase.</p>
            </div>
          ) : (
            policies.map((policy: any) => (
              <Card key={policy.id} className="overflow-hidden appGlass appCard border-white/20 dark:border-white/10">
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-full bg-emerald-500/10 text-[10px]">{policy.payerShortName || policy.payerName}</Badge>
                        {policy.policyNumber && <span className="font-mono text-[10px] text-muted-foreground">{policy.policyNumber}</span>}
                        <span className="text-[10px] text-muted-foreground">{policy.documentType?.replace(/_/g, " ")}</span>
                      </div>
                      <CardTitle className="text-sm leading-snug">{policy.title}</CardTitle>
                      <CardDescription className="mt-1 text-[11px]">
                        {[policy.effectiveDate && `Effective ${policy.effectiveDate}`, policy.lastPublishedAt && `Published ${policy.lastPublishedAt}`, policy.lastFetchedAt && `Fetched ${formatDate(policy.lastFetchedAt)}`].filter(Boolean).join(" · ")}
                      </CardDescription>
                    </div>
                    {policy.sourceUrl && (
                      <Button asChild size="sm" variant="outline" className="gap-1.5 flex-shrink-0">
                        <a href={policy.sourceUrl} target="_blank" rel="noreferrer noopener">
                          <ExternalLink className="w-3 h-3" /> Source
                        </a>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{policy.requirementsText}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">{renderCodes(policy)}</div>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground/70">
                    <span>{policy.sourceHost || "official carrier source"}</span>
                    <span>{policy.status || "indexed"}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <div className="p-4 appGlass appCard border border-white/15 dark:border-white/10 flex gap-4">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Commercial policy sources remain carrier-controlled and can change without notice. Codical stores indexed source metadata and searchable excerpts with source links so teams can verify final coverage requirements against the official carrier document.
        </p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function IntelligenceHub() {
  const [activeTab, setActiveTab] = useState(() =>
    sessionStorage.getItem("coverage_search") || sessionStorage.getItem("coverage_lcd")
      ? "medicare"
      : "guidelines"
  );
  const [guideSearch, setGuideSearch] = useState("");
  const [debouncedSearch] = useDebounce(guideSearch, 300);
  const [activeType, setActiveType] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch guidelines from the API
  const { data: guidelinesData, isLoading: guidelinesLoading } = useQuery({
    queryKey: ["/api/guidelines", debouncedSearch],
    queryFn: async () => {
      const url = debouncedSearch
        ? `/api/guidelines?q=${encodeURIComponent(debouncedSearch)}&pageSize=50`
        : `/api/guidelines?pageSize=50`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch guidelines");
      return res.json();
    },
  });

  const { data: statsData } = useQuery({
    queryKey: ["/api/guidelines/stats"],
    queryFn: async () => {
      const res = await fetch("/api/guidelines/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const allGuidelines: any[] = guidelinesData?.data || [];

  const filteredGuidelines = useMemo(() => {
    if (activeType === "All") return allGuidelines;
    return allGuidelines.filter((g: any) => g.type === activeType);
  }, [allGuidelines, activeType]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "CPT": return Stethoscope;
      case "HCPCS": return Tag;
      case "ICD-10-CM": return BookMarked;
      default: return BookMarked;
    }
  };

  return (
    <div className="coverage-hub-page tool-page">
      {/* Sticky header with tabs */}
      <div className="tool-panel coverage-hero-panel">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-sky-700 flex items-center justify-center shadow-lg shadow-black/10">
            <BookOpen size={20} color="white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground">Coverage & Guidelines</h1>
            <p className="text-xs text-muted-foreground">Live Medicare LCD/NCD/article search, Supabase payer policies, and coding guidelines</p>
          </div>
          {statsData && (
            <div className="ml-auto hidden md:flex items-center gap-4 text-[10px] text-muted-foreground/70">
              <span className="font-bold">{statsData.totalGuidelines} guidelines</span>
              <span>{statsData.icdChapters} ICD chapters</span>
              <span>{statsData.cptGuidelines} CPT</span>
              <span>{statsData.hcpcsGuidelines} HCPCS</span>
            </div>
          )}
        </div>

        <div className="coverage-tab-list flex gap-1 overflow-x-auto no-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/10"
                  : "text-muted-foreground hover:bg-white/10"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="coverage-content-shell">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* National Guidelines */}
            {activeTab === "guidelines" && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground/70" />
                    <Input placeholder="Search guidelines (e.g. diabetes, sepsis, E/M, fracture...)" className="pl-10" value={guideSearch} onChange={(e) => setGuideSearch(e.target.value)} />
                  </div>
                  <div className="coverage-filter-list flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {TYPE_FILTERS.map(f => (
                      <Badge
                        key={f.id}
                        onClick={() => setActiveType(f.id)}
                        className={`cursor-pointer px-4 py-1.5 rounded-full transition-colors ${
                          activeType === f.id
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            : "bg-white/5 text-muted-foreground hover:bg-white/10"
                        }`}
                        variant="outline"
                      >{f.label}</Badge>
                    ))}
                  </div>
                </div>

                {guidelinesLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-16 rounded-xl appGlass border border-white/10 animate-pulse" />
                    ))}
                  </div>
                ) : filteredGuidelines.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No guidelines found{guideSearch ? ` for "${guideSearch}"` : ""}. Try broader terms.</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    <p className="text-xs text-muted-foreground">
                      Showing {filteredGuidelines.length} of {guidelinesData?.total || 0} guidelines
                      {activeType !== "All" && ` · Filtered by ${activeType}`}
                    </p>
                    {filteredGuidelines.map((g: any) => {
                      const IconComp = getTypeIcon(g.type);
                      const colors = TYPE_COLORS[g.type] || TYPE_COLORS["General"];
                      return (
                        <Card key={g.id} className="overflow-hidden appGlass appCard border-white/20 dark:border-white/10">
                          <button
                            onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}
                            className="w-full text-left p-4 flex items-center gap-4 hover:bg-white/5 transition-colors"
                          >
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: colors.bg }}>
                              <IconComp size={18} color={colors.icon} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-foreground text-sm">{g.title}</h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-muted-foreground">{g.chapterTitle} · §{g.section}</span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: colors.bg, color: colors.icon }}>{g.type}</span>
                              </div>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-muted-foreground/50 transition-transform flex-shrink-0 ${expandedId === g.id ? "rotate-180" : ""}`} />
                          </button>
                          {expandedId === g.id && (
                            <div className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed border-t border-white/10 bg-white/5">
                              <p className="mt-4">{g.content}</p>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {g.tags?.map((tag: string) => (
                                  <span key={tag} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-muted-foreground/80">{tag}</span>
                                ))}
                              </div>
                              {g.sourceUrl && (
                                <a href={g.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-3 text-[10px] font-semibold text-sky-400 hover:text-sky-300">
                                  <ExternalLink size={10} /> View source
                                </a>
                              )}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === "medicare"   && <LiveMedicarePolicyList />}
            {activeTab === "commercial" && <CommercialPayerList />}

            {/* Official Resources */}
            {activeTab === "resources" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CMS_RESOURCES.map((section, idx) => (
                  <Card key={idx} className="appGlass appCard border-white/15">
                    <CardHeader>
                      <Badge className="w-fit" style={{ backgroundColor: section.color }}>{section.category}</Badge>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {section.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between group">
                          <div className="flex-1 pr-4">
                            <p className="text-sm font-bold text-foreground group-hover:text-emerald-400 transition-colors">{item.title}</p>
                            <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                          </div>
                          <a href={item.url} target="_blank" rel="noreferrer" className="p-2 hover:bg-emerald-500/10 rounded-lg text-emerald-500">
                            {item.type === "PDF" ? <Download size={16} /> : <ExternalLink size={16} />}
                          </a>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
