import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, FileText, Shield, ChevronRight, Calendar, Building, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";

type PolicyType = "ncd" | "lcd";

interface NcdItem {
  document_id: number;
  document_version: number;
  document_display_id: string;
  title: string;
  last_updated: string;
  document_type: string;
  chapter: string;
  is_lab: number;
}

interface LcdItem {
  document_id: number;
  document_version: number;
  document_display_id: string;
  title: string;
  contractor_name_type: string;
  updated_on: string;
  effective_date: string;
  retirement_date: string;
  note: string;
}

interface LcdDetail {
  title: string;
  display_id: string;
  orig_det_eff_date: string;
  rev_eff_date: string;
  last_reviewed_on: string;
  cms_cov_policy: string;
  indication: string;
  associated_info: string;
  coding_guidelines: string;
  doc_reqs: string;
  diagnoses_support: string;
  diagnoses_dont_support: string;
  keywords: string;
  status: string;
  bibliography: string;
}

interface NcdDetail {
  title: string;
  document_display_id: string;
  effective_date: string;
  benefit_category: string;
  item_service_description: string;
  indications_limitations: string;
  reasons_for_denial: string;
}

function stripHtml(html: string) {
  if (!html) return "";
  let text = html;
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&sol;/g, '/');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&#[0-9]+;/g, ' ');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

export function Coverage() {
  const [policyType, setPolicyType] = useState<PolicyType>("ncd");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedNcd, setSelectedNcd] = useState<NcdItem | null>(null);
  const [selectedLcd, setSelectedLcd] = useState<LcdItem | null>(null);
  const [lcdSearch, setLcdSearch] = useState("");
  const [activeLcdSearch, setActiveLcdSearch] = useState("");
  const [searchTermsUsed, setSearchTermsUsed] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: ncdList, isLoading: ncdLoading } = useQuery({
    queryKey: ["/api/coverage/ncd", debouncedSearch],
    queryFn: async () => {
      const res = await fetch(`/api/coverage/ncd?search=${debouncedSearch}`, { credentials: "include" });
      return res.json();
    },
    enabled: policyType === "ncd"
  });

  const { data: lcdData, isLoading: lcdLoading } = useQuery({
    queryKey: ["/api/coverage/lcd/smart", activeLcdSearch],
    queryFn: async () => {
      if (!activeLcdSearch) return { results: [], searchTerms: [] };
      const res = await fetch(`/api/coverage/lcd/search/smart?q=${encodeURIComponent(activeLcdSearch)}`, { credentials: "include" });
      return res.json();
    },
    enabled: policyType === "lcd" && !!activeLcdSearch
  });

  const { data: ncdDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["/api/coverage/ncd/detail", selectedNcd?.document_id],
    queryFn: async () => {
      const res = await fetch(`/api/coverage/ncd/${selectedNcd?.document_id}/${selectedNcd?.document_version}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedNcd
  });

  const { data: lcdDetail, isLoading: lcdDetailLoading } = useQuery({
    queryKey: ["/api/coverage/lcd/detail", selectedLcd?.document_id],
    queryFn: async () => {
      const res = await fetch(`/api/coverage/lcd/${selectedLcd?.document_id}/${selectedLcd?.document_version}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedLcd
  });

  const handleNcdSearch = (value: string) => {
    setSearch(value);
    clearTimeout((window as any)._searchTimeout);
    (window as any)._searchTimeout = setTimeout(() => setDebouncedSearch(value), 400);
  };

  const handleLcdSearch = (value: string) => {
    setLcdSearch(value);
    if (value.length > 1) {
      // Generate autocomplete suggestions
      const isCpt = /^\d{3,5}[A-Z]?$/.test(value.toUpperCase());
      if (!isCpt && value.length > 2) {
        const commonTerms = [
          "colonoscopy", "endoscopy", "ultrasound", "MRI", "CT scan", "biopsy",
          "physical therapy", "occupational therapy", "speech therapy", "dialysis",
          "cardiac", "ophthalmology", "radiology", "laboratory", "surgery",
          "anesthesia", "dermatology", "neurology", "orthopedic", "wound care",
          "diabetes", "cancer", "oxygen therapy", "chemotherapy", "radiation"
        ];
        const filtered = commonTerms.filter(t => t.toLowerCase().startsWith(value.toLowerCase()));
        setSuggestions(filtered.slice(0, 5));
        setShowSuggestions(filtered.length > 0);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  const executeSearch = (term: string) => {
    setLcdSearch(term);
    setActiveLcdSearch(term);
    setShowSuggestions(false);
    setSelectedLcd(null);
  };

  const lcdResults: LcdItem[] = lcdData?.results || [];
  const isLoading = policyType === "ncd" ? ncdLoading : lcdLoading;
  const list = policyType === "ncd" ? (ncdList || []) : lcdResults;

  return (
    <div className="flex gap-6 p-8 h-full">
      {/* Left Panel */}
      <div className="w-[420px] flex-shrink-0 space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-black">Coverage Policies</CardTitle>
                  <p className="text-xs text-muted-foreground font-medium">NCD and LCD from CMS</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                {(["ncd", "lcd"] as PolicyType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setPolicyType(t); setSelectedNcd(null); setSelectedLcd(null); }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-black border-2 transition-all uppercase tracking-wider ${
                      policyType === t
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {t === "ncd" ? "National (NCD)" : "Local (LCD)"}
                  </button>
                ))}
              </div>

              {policyType === "ncd" ? (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search NCDs by name..."
                    className="pl-10 h-11 border-2"
                    value={search}
                    onChange={(e) => handleNcdSearch(e.target.value)}
                  />
                </div>
              ) : (
                <div ref={searchRef} className="relative">
                  <div className="relative flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="CPT code or procedure name..."
                        className="w-full h-11 pl-10 pr-4 rounded-xl border-2 border-border text-sm font-medium focus:border-primary outline-none"
                        value={lcdSearch}
                        onChange={(e) => handleLcdSearch(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && executeSearch(lcdSearch)}
                        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                      />
                    </div>
                    <button
                      onClick={() => executeSearch(lcdSearch)}
                      className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors"
                    >
                      Search
                    </button>
                  </div>

                  {/* Autocomplete Suggestions */}
                  <AnimatePresence>
                    {showSuggestions && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute top-12 left-0 right-12 bg-white border-2 border-border rounded-xl shadow-xl z-50 overflow-hidden"
                      >
                        {suggestions.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => executeSearch(s)}
                            className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-primary/5 hover:text-primary flex items-center gap-2 transition-colors"
                          >
                            <Search className="w-3 h-3 text-muted-foreground" />
                            {s}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {activeLcdSearch && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground">Searching:</span>
                      <span className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">{activeLcdSearch}</span>
                      {lcdData?.searchTerms?.length > 0 && lcdData.isCptCode && (
                        <span className="text-xs text-muted-foreground">
                          Keywords: {lcdData.searchTerms.join(", ")}
                        </span>
                      )}
                      <button
                        onClick={() => { setActiveLcdSearch(""); setLcdSearch(""); setSelectedLcd(null); }}
                        className="ml-auto text-xs text-red-500 hover:underline flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Clear
                      </button>
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground font-medium">
                {isLoading ? "Loading..." : activeLcdSearch || policyType === "ncd" ? `${list.length} policies found` : "Enter a CPT code or procedure name to search"}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-26rem)]">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary/50" />
              <p className="font-medium text-sm">Loading policies...</p>
            </div>
          ) : !activeLcdSearch && policyType === "lcd" ? (
            <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-2xl">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-bold text-base">Search for LCDs</p>
              <p className="text-xs mt-1 max-w-xs mx-auto">Enter a CPT code like 45378 or a procedure name like "colonoscopy"</p>
            </div>
          ) : list.length === 0 && (activeLcdSearch || policyType === "ncd") ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-2xl">
              <p className="font-bold">No policies found</p>
              <p className="text-xs mt-1">Try different search terms</p>
            </div>
          ) : (
            list.map((item: any) => (
              <motion.div
                key={`${item.document_id}-${item.document_version}`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => {
                  if (policyType === "ncd") setSelectedNcd(item);
                  else setSelectedLcd(item);
                }}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  (policyType === "ncd" ? selectedNcd?.document_id : selectedLcd?.document_id) === item.document_id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-white hover:border-primary/30 hover:shadow-md"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs font-black">
                        {item.document_display_id}
                      </Badge>
                      {(item.note === "Retired" || item.title?.includes("RETIRED")) && (
                        <Badge variant="secondary" className="text-xs">Retired</Badge>
                      )}
                    </div>
                    <p className="text-sm font-bold text-foreground line-clamp-2">{item.title}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {item.last_updated || item.updated_on}
                      </span>
                      {item.contractor_name_type && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <Building className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{item.contractor_name_type.split('\r\n')[0]}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 flex-shrink-0 mt-1 transition-colors ${
                    (policyType === "ncd" ? selectedNcd?.document_id : selectedLcd?.document_id) === item.document_id
                      ? "text-primary" : "text-muted-foreground"
                  }`} />
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {policyType === "lcd" && selectedLcd && lcdDetail ? (
            <motion.div
              key={selectedLcd.document_id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <Card className="border-2">
                <CardContent className="p-8">
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <Badge className="text-sm px-3 py-1 font-black">
                          {"LCD " + selectedLcd.document_display_id}
                        </Badge>
                        {lcdDetail.status === "A" && (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">Active</Badge>
                        )}
                      </div>
                      <h2 className="text-2xl font-black text-foreground">{lcdDetail.title}</h2>
                      <p className="text-sm text-muted-foreground mt-1">{"Effective: " + lcdDetail.orig_det_eff_date}</p>
                      {lcdDetail.keywords && (
                        <p className="text-xs text-primary mt-1 font-medium">{lcdDetail.keywords.replace(/\|/g, " | ")}</p>
                      )}
                    </div>
                  </div>

                  {lcdDetail.indication && (
                    <div className="mb-6">
                      <h3 className="text-sm font-black text-muted-foreground uppercase tracking-wider mb-3">Coverage Indications</h3>
                      <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
                        <p className="text-sm text-foreground leading-relaxed">{stripHtml(lcdDetail.indication).slice(0, 1500)}</p>
                      </div>
                    </div>
                  )}

                  {lcdDetail.cms_cov_policy && (
                    <div className="mb-6">
                      <h3 className="text-sm font-black text-muted-foreground uppercase tracking-wider mb-3">CMS Coverage Policy</h3>
                      <div className="bg-slate-50 rounded-2xl p-6 border border-border/50">
                        <p className="text-sm text-foreground leading-relaxed">{stripHtml(lcdDetail.cms_cov_policy).slice(0, 1000)}</p>
                      </div>
                    </div>
                  )}

                  {lcdDetail.coding_guidelines && (
                    <div className="mb-6">
                      <h3 className="text-sm font-black text-muted-foreground uppercase tracking-wider mb-3">Coding Guidelines</h3>
                      <div className="bg-green-50 rounded-2xl p-6 border border-green-100">
                        <p className="text-sm text-foreground leading-relaxed">{stripHtml(lcdDetail.coding_guidelines).slice(0, 1000)}</p>
                      </div>
                    </div>
                  )}

                  {lcdDetail.diagnoses_support && (
                    <div className="mb-6">
                      <h3 className="text-sm font-black text-muted-foreground uppercase tracking-wider mb-3">Diagnoses Supporting Medical Necessity</h3>
                      <div className="bg-green-50 rounded-2xl p-6 border border-green-100">
                        <p className="text-sm text-foreground leading-relaxed">{stripHtml(lcdDetail.diagnoses_support).slice(0, 1000)}</p>
                      </div>
                    </div>
                  )}

                  {lcdDetail.diagnoses_dont_support && (
                    <div className="mb-6">
                      <h3 className="text-sm font-black text-muted-foreground uppercase tracking-wider mb-3">Diagnoses Not Supporting Medical Necessity</h3>
                      <div className="bg-red-50 rounded-2xl p-6 border border-red-100">
                        <p className="text-sm text-foreground leading-relaxed">{stripHtml(lcdDetail.diagnoses_dont_support).slice(0, 1000)}</p>
                      </div>
                    </div>
                  )}

                  {lcdDetail.doc_reqs && (
                    <div className="mb-6">
                      <h3 className="text-sm font-black text-muted-foreground uppercase tracking-wider mb-3">Documentation Requirements</h3>
                      <div className="bg-yellow-50 rounded-2xl p-6 border border-yellow-100">
                        <p className="text-sm text-foreground leading-relaxed">{stripHtml(lcdDetail.doc_reqs).slice(0, 1000)}</p>
                      </div>
                    </div>
                  )}

                  {lcdDetail.associated_info && (
                    <div>
                      <h3 className="text-sm font-black text-muted-foreground uppercase tracking-wider mb-3">Additional Information</h3>
                      <div className="bg-yellow-50 rounded-2xl p-6 border border-yellow-100">
                        <p className="text-sm text-foreground leading-relaxed">{stripHtml(lcdDetail.associated_info).slice(0, 800)}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ) : policyType === "lcd" && lcdDetailLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
            </div>
          ) : selectedNcd && ncdDetail ? (
            <motion.div
              key={selectedNcd.document_id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <Card className="border-2">
                <CardContent className="p-8">
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <Badge className="text-sm px-3 py-1 font-black">
                          {"NCD " + ncdDetail.document_display_id}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{ncdDetail.benefit_category}</Badge>
                      </div>
                      <h2 className="text-2xl font-black text-foreground">{ncdDetail.title}</h2>
                      <p className="text-sm text-muted-foreground mt-1">{"Effective: " + ncdDetail.effective_date}</p>
                    </div>
                  </div>

                  {ncdDetail.item_service_description && (
                    <div className="mb-6">
                      <h3 className="text-sm font-black text-muted-foreground uppercase tracking-wider mb-3">Item/Service Description</h3>
                      <div className="bg-slate-50 rounded-2xl p-6 border border-border/50">
                        <p className="text-sm text-foreground leading-relaxed">{stripHtml(ncdDetail.item_service_description).slice(0, 1000)}</p>
                      </div>
                    </div>
                  )}

                  {ncdDetail.indications_limitations && (
                    <div className="mb-6">
                      <h3 className="text-sm font-black text-muted-foreground uppercase tracking-wider mb-3">Indications and Limitations</h3>
                      <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
                        <p className="text-sm text-foreground leading-relaxed">{stripHtml(ncdDetail.indications_limitations).slice(0, 1500)}</p>
                      </div>
                    </div>
                  )}

                  {ncdDetail.reasons_for_denial && (
                    <div>
                      <h3 className="text-sm font-black text-muted-foreground uppercase tracking-wider mb-3">Reasons for Denial</h3>
                      <div className="bg-red-50 rounded-2xl p-6 border border-red-100">
                        <p className="text-sm text-foreground leading-relaxed">{stripHtml(ncdDetail.reasons_for_denial).slice(0, 800)}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ) : detailLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center text-muted-foreground p-12 text-center border-2 border-dashed border-border/50 rounded-3xl"
            >
              <div className="w-24 h-24 bg-primary/5 rounded-[2rem] flex items-center justify-center mb-6 border border-primary/10">
                <FileText className="w-12 h-12 text-primary/30" />
              </div>
              <h2 className="text-2xl font-black text-foreground mb-2">Select a Policy</h2>
              <p className="text-sm font-medium max-w-xs">
                {policyType === "ncd"
                  ? "Click any NCD from the list to view full coverage policy details"
                  : "Search for LCDs by CPT code or procedure name, then click a result"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
