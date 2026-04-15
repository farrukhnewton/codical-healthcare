import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen, FileText, Shield, Search, ExternalLink,
  Download, ChevronRight, Globe, X, ArrowLeft,
  BookMarked, Stethoscope, Activity, Tag, Zap,
  ChevronDown, Building2, Phone, ShieldAlert
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const TABS = [
  { id: "guidelines", label: "National Guidelines", icon: BookOpen },
  { id: "medicare", label: "Medicare (LCD/NCD)", icon: Shield },
  { id: "commercial", label: "Commercial Carriers", icon: Building2 },
  { id: "resources", label: "Official Resources", icon: Globe },
];

const CMS_RESOURCES = [
  {
    category: "ICD-10-CM", color: "#2563EB", bg: "#EFF6FF",
    items: [
      { title: "FY 2026 ICD-10-CM Official Coding Guidelines", desc: "Official guidelines for coding and reporting FY2026", url: "https://www.cms.gov/files/document/fy-2026-icd-10-cm-coding-guidelines.pdf", type: "PDF", date: "Oct 2025" },
      { title: "FY 2026 ICD-10-CM Codes", desc: "Complete tabular list and index", url: "https://www.cms.gov/medicare/coding-billing/icd-10-codes", type: "WEB", date: "Oct 2025" },
    ]
  },
  {
    category: "Medicare Fee Schedule", color: "#16A34A", bg: "#F0FDF4",
    items: [
      { title: "CY 2026 Physician Fee Schedule Final Rule", desc: "Complete CY2026 PFS final rule and payment rates", url: "https://www.cms.gov/medicare/payment/fee-schedules/physician", type: "WEB", date: "Nov 2025" },
    ]
  },
];

const KEY_GUIDELINES = [
  { id: "g1", category: "General", icon: BookMarked, color: "#2563EB", title: "Code to Highest Level of Specificity", content: "Code to the highest number of characters available. A code is invalid if it has not been coded to the full number of characters required for that code, including the 7th character, if applicable.", source: "ICD-10-CM Guidelines §I.B.1", year: "FY2026" },
  { id: "g2", category: "General", icon: BookMarked, color: "#2563EB", title: "Signs and Symptoms", content: "Codes that describe symptoms and signs, as opposed to diagnoses, are acceptable for reporting purposes when a related definitive diagnosis has not been established (confirmed) by the provider.", source: "ICD-10-CM Guidelines §I.B.4", year: "FY2026" },
  { id: "g3", category: "E/M", icon: Stethoscope, color: "#7C3AED", title: "E/M Level Selection - Medical Decision Making", content: "For E/M services, the level of medical decision making (MDM) is based on three elements: number and complexity of problems, amount and/or complexity of data reviewed, and risk of complications and/or morbidity or mortality.", source: "AMA CPT E/M Guidelines 2026", year: "2026" },
];

const CATEGORIES = ["All", "General", "E/M", "Surgery", "Modifiers", "Telehealth", "Sequencing"];

function PolicyDetail({ policy, type, onBack }: { policy: any; type: "lcd" | "ncd"; onBack: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: [type === "lcd" ? "/api/coverage/lcd" : "/api/coverage/ncd", policy.document_id, policy.document_version],
    queryFn: async () => {
      const url = type === "lcd"
        ? `/api/coverage/lcd/${policy.document_id}/${policy.document_version}`
        : `/api/coverage/ncd/${policy.document_id}/${policy.document_version}`;
      const res = await fetch(url);
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack} className="gap-2 text-gray-500">
        <ArrowLeft size={16} /> Back to Medicare List
      </Button>

      <Card>
        <CardHeader className={type === "lcd" ? "bg-cyan-50/50" : "bg-orange-50/50"}>
          <div className="flex items-center gap-2 mb-2">
            <Badge className={type === "lcd" ? "bg-cyan-600" : "bg-orange-600"}>{type.toUpperCase()}</Badge>
            <span className="text-xs font-mono text-gray-500">{policy.document_display_id}</span>
          </div>
          <CardTitle className="text-lg">{policy.title}</CardTitle>
          <CardDescription>{policy.contractor_name_type?.split("\r")[0]}</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="py-12 text-center">
              <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-500">Fetching policy details...</p>
            </div>
          ) : data ? (
            <div className="space-y-6">
              {Object.entries(data).filter(([k, v]) => v && typeof v === "string" && v.length > 50).slice(0, 5).map(([k, v]) => (
                <div key={k}>
                  <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">{k.replace(/_/g, " ")}</h4>
                  <div className="text-sm text-gray-600 leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: String(v) }} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">Section details not available for this policy.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MedicarePolicyList() {
  const [type, setType] = useState<"lcd" | "ncd">("lcd");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: [type === "lcd" ? "/api/coverage/lcd" : "/api/coverage/ncd"],
    queryFn: async () => {
      const url = type === "lcd" ? "/api/coverage/lcd" : "/api/coverage/ncd";
      const res = await fetch(url);
      return res.json();
    },
  });

  if (selected) return <PolicyDetail policy={selected} type={type} onBack={() => setSelected(null)} />;

  const items = Array.isArray(data) ? data.filter((item: any) =>
    !search || item.title?.toLowerCase().includes(search.toLowerCase()) ||
    item.document_display_id?.toLowerCase().includes(search.toLowerCase())
  ) : [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button 
          variant={type === "lcd" ? "default" : "outline"} 
          onClick={() => setType("lcd")}
          className="rounded-full"
        >LCD Policies</Button>
        <Button 
          variant={type === "ncd" ? "default" : "outline"} 
          onClick={() => setType("ncd")}
          className="rounded-full"
        >NCD Policies</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
        <Input 
          placeholder={`Search ${type.toUpperCase()}...`} 
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="py-12 text-center text-gray-400">Loading Medicare Database...</div>
        ) : items.map((item, i) => (
          <button 
            key={i} 
            onClick={() => setSelected(item)}
            className="w-full text-left p-4 rounded-xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all flex items-center gap-4 bg-white/50"
          >
            <div className={`p-2 rounded-lg ${type === 'lcd' ? 'bg-cyan-50 text-cyan-600' : 'bg-orange-50 text-orange-600'}`}>
              <Shield size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900 line-clamp-1">{item.title}</p>
              <p className="text-[10px] text-gray-500 font-mono mt-0.5">{item.document_display_id}</p>
            </div>
            <ChevronRight size={14} className="text-gray-300" />
          </button>
        ))}
      </div>
    </div>
  );
}

function CommercialPayerList() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: payers, isLoading } = useQuery({
    queryKey: ["/api/payers"],
    queryFn: async () => {
      const res = await fetch("/api/payers");
      return res.json();
    }
  });

  const filteredPayers = payers?.filter((p: any) => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.shortName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search 20+ Carriers (Aetna, UHC, Cigna...)" 
          className="pl-10 h-11"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          [...Array(6)].map((_, i) => <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-2xl" />)
        ) : filteredPayers?.map((payer: any) => (
          <div key={payer.id} className="p-4 rounded-2xl bg-white border border-gray-100 hover:shadow-lg transition-all group">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">{payer.name}</h3>
                <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">{payer.shortName}</span>
              </div>
              <Building2 className="w-5 h-5 text-gray-300 group-hover:text-emerald-500 transition-colors" />
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="sm" variant="outline" className="flex-1 text-[10px] h-8" onClick={() => window.open(payer.policyPortalUrl, '_blank')}>
                <BookOpen className="w-3 h-3 mr-1" /> Policies
              </Button>
              <Button size="sm" variant="outline" className="flex-1 text-[10px] h-8" onClick={() => window.open(payer.paPortalUrl, '_blank')}>
                <Search className="w-3 h-3 mr-1" /> PA Lookup
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-4">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <p className="text-xs text-amber-800 leading-relaxed">
          Commercial policies vary significantly. While we provide links to official portals, always verify the <strong>Effective Date</strong> on the carrier's site.
        </p>
      </div>
    </div>
  );
}

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
    <div className="flex-1 overflow-y-auto bg-slate-50/50 min-h-screen">
      <div className="bg-white border-b border-slate-200 px-6 py-6 sticky top-0 z-20">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-sky-700 flex items-center justify-center shadow-lg shadow-emerald-900/10">
            <BookOpen size={20} color="white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">National Intelligence Hub</h1>
            <p className="text-xs text-gray-500">Unified Coverage Directives & Coding Guidelines</p>
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
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div 
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "guidelines" && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <Input 
                      placeholder="Search general guidelines..." 
                      className="pl-10"
                      value={guideSearch}
                      onChange={(e) => setGuideSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {CATEGORIES.map(cat => (
                      <Badge 
                        key={cat} 
                        onClick={() => setActiveCategory(cat)}
                        className={`cursor-pointer px-4 py-1.5 rounded-full transition-colors ${
                          activeCategory === cat ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-white text-gray-500 hover:bg-gray-100"
                        }`}
                        variant="outline"
                      >{cat}</Badge>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3">
                  {filteredGuidelines.map(g => (
                    <Card key={g.id} className="overflow-hidden bg-white/50 backdrop-blur-sm border-gray-100">
                      <button 
                        onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}
                        className="w-full text-left p-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: g.color + "15" }}>
                          <g.icon size={18} color={g.color} />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900 text-sm">{g.title}</h4>
                          <p className="text-[10px] text-gray-500">{g.source} · {g.year}</p>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-300 transition-transform ${expandedId === g.id ? "rotate-180" : ""}`} />
                      </button>
                      {expandedId === g.id && (
                        <div className="p-4 pt-0 pl-18 text-xs text-gray-600 leading-relaxed border-t border-gray-50 bg-gray-50/30">
                          <p className="mt-4">{g.content}</p>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "medicare" && <MedicarePolicyList />}
            {activeTab === "commercial" && <CommercialPayerList />}
            
            {activeTab === "resources" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CMS_RESOURCES.map((section, idx) => (
                  <Card key={idx}>
                    <CardHeader>
                      <Badge className="w-fit" style={{ backgroundColor: section.color }}>{section.category}</Badge>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {section.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between group">
                          <div className="flex-1 pr-4">
                            <p className="text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">{item.title}</p>
                            <p className="text-[11px] text-gray-500">{item.desc}</p>
                          </div>
                          <a href={item.url} target="_blank" rel="noreferrer" className="p-2 hover:bg-emerald-50 rounded-lg text-emerald-600">
                            {item.type === 'PDF' ? <Download size={16} /> : <ExternalLink size={16} />}
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
