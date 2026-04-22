import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen, FileText, Shield, Search, ExternalLink,
  Download, ChevronRight, Globe, ArrowLeft,
  BookMarked, Stethoscope, Tag,
  ChevronDown, Building2, ShieldAlert,
  Database, AlertTriangle, RefreshCw, Table2,
  Layers, Activity, CheckCircle2, XCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { id: "guidelines",  label: "National Guidelines",   icon: BookOpen   },
  { id: "medicare",    label: "Medicare (LCD/NCD)",     icon: Shield     },
  { id: "commercial",  label: "Commercial Carriers",    icon: Building2  },
  { id: "cmsdata",     label: "CMS Open Data",          icon: Database   },
  { id: "resources",   label: "Official Resources",     icon: Globe      },
];

// ─── Static data ──────────────────────────────────────────────────────────────
const CMS_RESOURCES = [
  {
    category: "ICD-10-CM", color: "#2563EB",
    items: [
      { title: "FY 2026 ICD-10-CM Official Coding Guidelines", desc: "Official guidelines for coding and reporting FY2026", url: "https://www.cms.gov/files/document/fy-2026-icd-10-cm-coding-guidelines.pdf", type: "PDF", date: "Oct 2025" },
      { title: "FY 2026 ICD-10-CM Codes", desc: "Complete tabular list and index", url: "https://www.cms.gov/medicare/coding-billing/icd-10-codes", type: "WEB", date: "Oct 2025" },
    ]
  },
  {
    category: "Medicare Fee Schedule", color: "#16A34A",
    items: [
      { title: "CY 2026 Physician Fee Schedule Final Rule", desc: "Complete CY2026 PFS final rule and payment rates", url: "https://www.cms.gov/medicare/payment/fee-schedules/physician", type: "WEB", date: "Nov 2025" },
    ]
  },
];

const KEY_GUIDELINES = [
  { id: "g1", category: "General",  icon: BookMarked,  color: "#2563EB", title: "Code to Highest Level of Specificity",              content: "Code to the highest number of characters available. A code is invalid if it has not been coded to the full number of characters required for that code, including the 7th character, if applicable.", source: "ICD-10-CM Guidelines §I.B.1",       year: "FY2026" },
  { id: "g2", category: "General",  icon: BookMarked,  color: "#2563EB", title: "Signs and Symptoms",                                 content: "Codes that describe symptoms and signs, as opposed to diagnoses, are acceptable for reporting purposes when a related definitive diagnosis has not been established (confirmed) by the provider.", source: "ICD-10-CM Guidelines §I.B.4",       year: "FY2026" },
  { id: "g3", category: "E/M",      icon: Stethoscope, color: "#7C3AED", title: "E/M Level Selection - Medical Decision Making",       content: "For E/M services, the level of medical decision making (MDM) is based on three elements: number and complexity of problems, amount and/or complexity of data reviewed, and risk of complications and/or morbidity or mortality.", source: "AMA CPT E/M Guidelines 2026",        year: "2026"   },
];

const CATEGORIES = ["All", "General", "E/M", "Surgery", "Modifiers", "Telehealth", "Sequencing"];

const CATEGORY_COLORS: Record<string, string> = {
  Compliance:  "bg-red-500/20 text-red-300 border-red-500/30",
  Drugs:       "bg-violet-500/20 text-violet-300 border-violet-500/30",
  Provider:    "bg-sky-500/20 text-sky-300 border-sky-500/30",
  Utilization: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  General:     "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

// ─── Medicare blocked notice ──────────────────────────────────────────────────
function MedicarePolicyList() {
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl appGlass appCard border border-amber-500/30 flex gap-4 items-start">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-foreground mb-1">Medicare LCD/NCD Temporarily Unavailable</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            The CMS Coverage API (<code className="text-xs bg-black/20 px-1 py-0.5 rounded">api.coverage.cms.gov</code>) is
            currently returning a 403 CloudFront block in this environment. This affects LCD and NCD list lookups.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            As an alternative, use the <strong className="text-foreground">CMS Open Data</strong> tab to browse real Medicare
            datasets directly from <code className="text-xs bg-black/20 px-1 py-0.5 rounded">data.cms.gov</code>.
          </p>
          <div className="flex gap-2 flex-wrap">
            <a
              href="https://www.cms.gov/medicare/coverage/coverage-database"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
            >
              <ExternalLink size={12} /> Open CMS LCD/NCD Database Directly
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl appGlass appCard border border-white/10 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="font-bold text-sm text-foreground">Local Coverage Determinations</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            LCDs are made by Medicare Administrative Contractors (MACs) and specify when items/services are covered in their jurisdiction.
          </p>
          <a href="https://www.cms.gov/medicare-coverage-database/search/search-criteria.aspx" target="_blank" rel="noreferrer noopener">
            <Button size="sm" variant="outline" className="w-full text-xs gap-1.5">
              <ExternalLink size={12} /> Search LCD Database
            </Button>
          </a>
        </div>

        <div className="p-5 rounded-2xl appGlass appCard border border-white/10 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <FileText className="w-4 h-4 text-orange-400" />
            </div>
            <span className="font-bold text-sm text-foreground">National Coverage Determinations</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            NCDs are made by CMS centrally and apply nationwide. They define coverage for specific services for all Medicare beneficiaries.
          </p>
          <a href="https://www.cms.gov/medicare-coverage-database/search/search-criteria.aspx?searchType=NCD" target="_blank" rel="noreferrer noopener">
            <Button size="sm" variant="outline" className="w-full text-xs gap-1.5">
              <ExternalLink size={12} /> Search NCD Database
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Commercial payers ────────────────────────────────────────────────────────
function CommercialPayerList() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: payers, isLoading } = useQuery({
    queryKey: ["/api/payers"],
    queryFn: async () => {
      const res = await fetch("/api/payers");
      return res.json();
    }
  });

  const normalizeUrl = (u?: string) => {
    const t = String(u || "").trim();
    if (!t) return "";
    if (/^https?:\/\//i.test(t)) return t;
    return "https://" + t;
  };

  const filteredPayers = payers?.filter((p: any) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.shortName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search carriers (Aetna, UHC, Cigna...)" className="pl-10 h-11" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl appGlass appCard border border-white/15 dark:border-white/10 animate-pulse" />
          ))
        ) : filteredPayers?.map((payer: any) => {
          const policyUrl = normalizeUrl(payer.policyPortalUrl);
          const paUrl = normalizeUrl(payer.paPortalUrl);
          return (
            <div key={payer.id} className="p-4 rounded-2xl appGlass appCard border border-white/20 dark:border-white/10 hover:bg-white/10 transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-foreground truncate">{payer.name}</h3>
                  <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">{payer.shortName}</span>
                </div>
                <Building2 className="w-5 h-5 text-muted-foreground/50 group-hover:text-emerald-500 transition-colors" />
              </div>
              <div className="flex gap-2 mt-4">
                {policyUrl ? (
                  <Button asChild size="sm" variant="outline" className="flex-1 text-[10px] h-8">
                    <a href={policyUrl} target="_blank" rel="noreferrer noopener" className="w-full justify-center">
                      <BookOpen className="w-3 h-3 mr-1" /> Policies
                    </a>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="flex-1 text-[10px] h-8" disabled>
                    <BookOpen className="w-3 h-3 mr-1" /> Policies
                  </Button>
                )}
                {paUrl ? (
                  <Button asChild size="sm" variant="outline" className="flex-1 text-[10px] h-8">
                    <a href={paUrl} target="_blank" rel="noreferrer noopener" className="w-full justify-center">
                      <Search className="w-3 h-3 mr-1" /> PA Lookup
                    </a>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="flex-1 text-[10px] h-8" disabled>
                    <Search className="w-3 h-3 mr-1" /> PA Lookup
                  </Button>
                )}
              </div>
              <div className="mt-3 text-[10px] text-muted-foreground/80 flex items-center justify-between">
                <span className="truncate">{payer.phone ? "Phone: " + payer.phone : " "}</span>
                <span className="text-muted-foreground/60">External</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 appGlass appCard border border-white/15 dark:border-white/10 flex gap-4">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Commercial policies vary significantly. We link to official portals when available. Next, we will ingest key payer policies into Codical so your team can search and view them without leaving the app.
        </p>
      </div>
    </div>
  );
}

// ─── Dataset preview table ────────────────────────────────────────────────────
function DatasetPreview({ uuid, title, onBack }: { uuid: string; title: string; onBack: () => void }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["/api/cms/dataset", uuid],
    queryFn: async () => {
      const res = await fetch("/api/cms/dataset/" + uuid + "?size=25");
      if (!res.ok) throw new Error("Failed to fetch dataset");
      return res.json();
    },
    staleTime: 1000 * 60 * 30,
  });

  const rows: any[] = data?.rows || [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack} className="gap-2 text-muted-foreground">
        <ArrowLeft size={16} /> Back to CMS Datasets
      </Button>

      <div className="p-5 rounded-2xl appGlass appCard border border-white/15">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-black text-foreground">{title}</h2>
            <p className="text-[11px] font-mono text-muted-foreground/70 mt-0.5">{uuid}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1.5 flex-shrink-0">
            <RefreshCw size={12} /> Refresh
          </Button>
        </div>

        {isLoading && (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Fetching live data from CMS...</p>
          </div>
        )}

        {isError && (
          <div className="py-10 text-center space-y-3">
            <XCircle className="w-8 h-8 text-red-400 mx-auto" />
            <p className="text-sm text-muted-foreground">Could not load this dataset. It may not have a data API endpoint.</p>
            <a
              href={"https://data.cms.gov/search#dataset-uuid=" + uuid}
              target="_blank"
              rel="noreferrer noopener"
            >
              <Button size="sm" variant="outline" className="gap-1.5">
                <ExternalLink size={12} /> View on data.cms.gov
              </Button>
            </a>
          </div>
        )}

        {!isLoading && !isError && rows.length === 0 && (
          <div className="py-10 text-center space-y-3">
            <Table2 className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">No rows returned. This dataset may require specific filter parameters.</p>
          </div>
        )}

        {!isLoading && rows.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  {columns.map(col => (
                    <th key={col} className="px-3 py-2.5 text-left font-bold text-muted-foreground/80 whitespace-nowrap uppercase tracking-wider text-[10px]">
                      {col.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    {columns.map(col => (
                      <td key={col} className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">
                        {String(row[col] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-3 py-2 text-[10px] text-muted-foreground/60 border-t border-white/5">
              Showing first {rows.length} rows · Live from data.cms.gov
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CMS Open Data hub ────────────────────────────────────────────────────────
function CmsOpenDataHub() {
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedDataset, setSelectedDataset] = useState<{ uuid: string; title: string } | null>(null);
  const [activeView, setActiveView] = useState<"registry" | "catalog">("registry");

  const { data: registry, isLoading: regLoading } = useQuery({
    queryKey: ["/api/cms/registry"],
    queryFn: async () => {
      const res = await fetch("/api/cms/registry");
      if (!res.ok) throw new Error("Registry unavailable");
      return res.json();
    },
    staleTime: 1000 * 60 * 60,
  });

  const { data: catalogData, isLoading: catLoading, isFetching: catFetching } = useQuery({
    queryKey: ["/api/cms/catalog", catalogSearch],
    queryFn: async () => {
      const url = catalogSearch
        ? "/api/cms/catalog?q=" + encodeURIComponent(catalogSearch)
        : "/api/cms/catalog";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Catalog unavailable");
      return res.json();
    },
    staleTime: 1000 * 60 * 60,
    enabled: activeView === "catalog",
  });

  if (selectedDataset) {
    return (
      <DatasetPreview
        uuid={selectedDataset.uuid}
        title={selectedDataset.title}
        onBack={() => setSelectedDataset(null)}
      />
    );
  }

  const registryItems: any[] = Array.isArray(registry) ? registry : [];
  const catalogItems: any[] = catalogData?.datasets || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl appGlass appCard border border-emerald-500/20 flex gap-4 items-start">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="font-bold text-foreground mb-1">CMS Open Data Catalog</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Live data from <code className="text-xs bg-black/20 px-1 py-0.5 rounded">data.cms.gov</code> — the official CMS Open Data portal.
            Browse curated datasets or search the full catalog of {catalogData?.total?.toLocaleString() || "1,000+"} datasets.
          </p>
        </div>
      </div>

      {/* View switcher */}
      <div className="flex gap-2">
        <Button
          variant={activeView === "registry" ? "default" : "outline"}
          onClick={() => setActiveView("registry")}
          className="rounded-full gap-2"
          size="sm"
        >
          <Layers size={14} /> Curated ({registryItems.length})
        </Button>
        <Button
          variant={activeView === "catalog" ? "default" : "outline"}
          onClick={() => setActiveView("catalog")}
          className="rounded-full gap-2"
          size="sm"
        >
          <Globe size={14} /> Full Catalog
        </Button>
      </div>

      {/* Registry view */}
      {activeView === "registry" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Datasets curated for Codical Health — click any to preview live data.</p>
          {regLoading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl appGlass border border-white/10 animate-pulse" />
            ))
          ) : registryItems.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              No datasets in registry yet. Run the seed script to populate.
            </div>
          ) : (
            registryItems.map((ds: any) => (
              <button
                key={ds.uuid}
                onClick={() => setSelectedDataset({ uuid: ds.uuid, title: ds.title })}
                className="w-full text-left p-4 appGlass appCard rounded-xl border border-white/15 hover:border-emerald-500/40 hover:bg-white/10 transition-all flex items-center gap-4 group"
              >
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Database size={14} className="text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{ds.title}</p>
                  {ds.notes && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{ds.notes}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[ds.category] || CATEGORY_COLORS.General}`}>
                    {ds.category}
                  </span>
                  <ChevronRight size={14} className="text-muted-foreground/40 group-hover:text-emerald-400 transition-colors" />
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Full catalog view */}
      {activeView === "catalog" && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground/70" />
            <Input
              placeholder="Search CMS datasets (e.g. telehealth, drug spending, DME...)"
              className="pl-10"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
            />
          </div>

          {(catLoading || catFetching) && (
            <div className="py-8 text-center">
              <div className="w-6 h-6 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-muted-foreground">Loading catalog from data.cms.gov...</p>
            </div>
          )}

          {!catLoading && catalogItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{catalogData?.total?.toLocaleString()} total datasets{catalogSearch ? " matching your search" : ""} — showing first {catalogItems.length}</p>
              {catalogItems.slice(0, 50).map((ds: any) => {
                const hasApi = !!ds.apiUrl;
                return (
                  <button
                    key={ds.identifier}
                    onClick={() => hasApi && setSelectedDataset({ uuid: ds.identifier, title: ds.title })}
                    className={`w-full text-left p-4 appGlass appCard rounded-xl border border-white/10 transition-all flex items-start gap-3 group ${hasApi ? "hover:border-emerald-500/40 hover:bg-white/10 cursor-pointer" : "opacity-70 cursor-default"}`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${hasApi ? "bg-emerald-500/20" : "bg-white/5"}`}>
                      {hasApi ? <Activity size={13} className="text-emerald-400" /> : <FileText size={13} className="text-muted-foreground/50" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground line-clamp-1">{ds.title}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{ds.description}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {hasApi ? (
                          <span className="text-[10px] text-emerald-400 font-bold">● Data API available</span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/50">Download only</span>
                        )}
                        {ds.modified && <span className="text-[10px] text-muted-foreground/40">Updated {ds.modified.slice(0, 10)}</span>}
                      </div>
                    </div>
                    {hasApi && <ChevronRight size={14} className="text-muted-foreground/40 group-hover:text-emerald-400 transition-colors flex-shrink-0 mt-1" />}
                  </button>
                );
              })}
            </div>
          )}

          {!catLoading && !catFetching && catalogItems.length === 0 && catalogSearch && (
            <div className="py-10 text-center text-muted-foreground text-sm">
              No datasets found for "{catalogSearch}". Try broader terms.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function IntelligenceHub() {
  const [activeTab, setActiveTab] = useState("guidelines");
  const [guideSearch, setGuideSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredGuidelines = KEY_GUIDELINES.filter(g => {
    const matchesCategory = activeCategory === "All" || g.category === activeCategory;
    const matchesSearch = !guideSearch || g.title.toLowerCase().includes(guideSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex-1 overflow-y-auto min-h-screen">
      {/* Sticky header with tabs */}
      <div className="appGlassStrong appCard border-b border-white/15 dark:border-white/10 px-6 py-6 sticky top-0 z-20">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-sky-700 flex items-center justify-center shadow-lg shadow-black/10">
            <BookOpen size={20} color="white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground">Coverage & Guidelines</h1>
            <p className="text-xs text-muted-foreground">Medicare LCD/NCD, payer policies, CMS open data & coding guidelines</p>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto no-scrollbar">
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
      <div className="p-6 max-w-6xl mx-auto">
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
                    <Input placeholder="Search general guidelines..." className="pl-10" value={guideSearch} onChange={(e) => setGuideSearch(e.target.value)} />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {CATEGORIES.map(cat => (
                      <Badge
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`cursor-pointer px-4 py-1.5 rounded-full transition-colors ${
                          activeCategory === cat
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            : "bg-white/5 text-muted-foreground hover:bg-white/10"
                        }`}
                        variant="outline"
                      >{cat}</Badge>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3">
                  {filteredGuidelines.map(g => (
                    <Card key={g.id} className="overflow-hidden appGlass appCard border-white/20 dark:border-white/10">
                      <button
                        onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}
                        className="w-full text-left p-4 flex items-center gap-4 hover:bg-white/5 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: g.color + "20" }}>
                          <g.icon size={18} color={g.color} />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-foreground text-sm">{g.title}</h4>
                          <p className="text-[10px] text-muted-foreground">{g.source} · {g.year}</p>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground/50 transition-transform ${expandedId === g.id ? "rotate-180" : ""}`} />
                      </button>
                      {expandedId === g.id && (
                        <div className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed border-t border-white/10 bg-white/5">
                          <p className="mt-4">{g.content}</p>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "medicare"   && <MedicarePolicyList />}
            {activeTab === "commercial" && <CommercialPayerList />}
            {activeTab === "cmsdata"    && <CmsOpenDataHub />}

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
