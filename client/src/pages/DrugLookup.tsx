import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pill, Search, X, ChevronRight, Package, Hash, AlertCircle, Beaker, Building, Calendar, Tag } from "lucide-react";

interface DrugResult {
  product_ndc: string;
  brand_name: string;
  generic_name: string;
  labeler_name: string;
  dosage_form: string;
  route: string[];
  marketing_status: string;
  product_type: string;
  packaging?: { package_ndc: string; description: string }[];
}

const SEARCH_TYPES = [
  { id: "brand_name", label: "Brand Name" },
  { id: "generic_name", label: "Generic Name" },
  { id: "product_ndc", label: "NDC Number" },
];

const QUICK_SEARCHES = ["Aspirin", "Metformin", "Lisinopril", "Atorvastatin", "Omeprazole", "Amoxicillin"];

export function DrugLookup() {
  const [query, setQuery] = useState(() => { const q = sessionStorage.getItem("drug_query") || ""; sessionStorage.removeItem("drug_query"); return q; });
  const [searchType, setSearchType] = useState<"brand_name" | "generic_name" | "product_ndc">("brand_name");
  const [results, setResults] = useState<DrugResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState<DrugResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { if (query) handleSearch(); }, []);

  const handleSearch = async (q = query) => {
    if (!q.trim()) return;
    setLoading(true);
    setSelectedDrug(null);
    setError("");
    try {
      const res = await fetch(`/api/drug/search?q=${encodeURIComponent(q)}&type=${searchType}&limit=20`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) setError(data.message || "Search failed");
      else { setResults(data.results || []); setTotal(data.total || 0); }
    } catch { setError("Network error. Please try again."); }
    setLoading(false);
  };

  const getRouteColor = (route: string) => {
    const colors: Record<string, string> = { ORAL: "#16A34A", INTRAVENOUS: "#2563EB", TOPICAL: "#EA580C", INJECTION: "#7C3AED", INHALATION: "#0891B2" };
    return colors[route?.toUpperCase()] || "#64748B";
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "rgba(255,255,255,0.4)", minHeight: "100vh" }}>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #0F2A4A 100%)", padding: "32px 24px", position: "relative", overflow: "hidden" }}>
        {Array.from({length: 6}).map((_, i) => (
          <div key={i} style={{ position: "absolute", width: (20 + i*12) + "px", height: (20 + i*12) + "px", borderRadius: "50%", border: "1px solid rgba(234,88,12,0.15)", left: ((i*29+8)%88) + "%", top: ((i*37+15)%75) + "%", }} />
        ))}
        <div style={{ position: "relative", zIndex: 1, maxWidth: "700px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "20px", background: "rgba(234,88,12,0.2)", border: "1px solid rgba(234,88,12,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Pill size={28} color="#EA580C" />
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: 900, color: "white", margin: "0 0 8px" }}>Drug / NDC Lookup</h1>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", margin: 0 }}>FDA NDC Database · 100,000+ drug products</p>
        </div>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px" }}>
        {/* Search card */}
        <div style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderRadius: "20px", padding: "24px", border: "1px solid rgba(255,255,255,0.7)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", marginBottom: "20px" }}>
          {/* Type selector */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
            {SEARCH_TYPES.map(t => (
              <button key={t.id} onClick={() => setSearchType(t.id as any)}
                style={{ flex: 1, padding: "8px", borderRadius: "8px", border: `2px solid ${searchType === t.id ? "#EA580C" : "#E2E8F0"}`, background: searchType === t.id ? "rgba(234,88,12,0.06)" : "white", fontSize: "12px", fontWeight: 700, color: searchType === t.id ? "#EA580C" : "#64748B", cursor: "pointer", transition: "all 0.15s" }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Search input */}
          <div style={{ display: "flex", gap: "10px" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <Search size={16} color="#94A3B8" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
              <input value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder={searchType === "product_ndc" ? "e.g. 0069-0105-68" : "e.g. Aspirin, Metformin..."}
                style={{ width: "100%", height: "48px", paddingLeft: "40px", paddingRight: query ? "40px" : "14px", border: "2px solid #E2E8F0", borderRadius: "12px", fontSize: "14px", outline: "none", boxSizing: "border-box", color: "var(--text-primary, #111827)", transition: "border-color 0.2s" }}
                onFocus={e => { e.target.style.borderColor = "#EA580C"; }}
                onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }}
              />
              {query && (
                <button onClick={() => { setQuery(""); setResults([]); setSelectedDrug(null); }}
                  style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted, #6B7280)", display: "flex" }}>
                  <X size={16} />
                </button>
              )}
            </div>
            <motion.button onClick={() => handleSearch()} disabled={loading || !query.trim()} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              style={{ height: "48px", padding: "0 24px", background: query.trim() ? "linear-gradient(135deg, #EA580C, #C2410C)" : "#F1F5F9", color: query.trim() ? "white" : "#94A3B8", border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: 700, cursor: query.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: "8px", boxShadow: query.trim() ? "0 4px 16px rgba(234,88,12,0.25)" : "none", whiteSpace: "nowrap" }}>
              {loading ? <div style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> : <Search size={16} />}
              Search
            </motion.button>
          </div>

          {/* Quick searches */}
          {!results.length && !loading && (
            <div style={{ marginTop: "12px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted, #6B7280)", fontWeight: 600, alignSelf: "center" }}>Quick:</span>
              {QUICK_SEARCHES.map(s => (
                <button key={s} onClick={() => { setQuery(s); handleSearch(s); }}
                  style={{ padding: "4px 12px", background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: "20px", fontSize: "12px", fontWeight: 600, color: "#EA580C", cursor: "pointer" }}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div style={{ padding: "14px 18px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "12px", fontSize: "13px", color: "#DC2626", display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Results layout */}
        {(results.length > 0 || selectedDrug) && (
          <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
            {/* Results list */}
            <div style={{ width: selectedDrug ? "320px" : "100%", flexShrink: 0, transition: "width 0.3s" }}>
              {results.length > 0 && (
                <div style={{ fontSize: "12px", color: "var(--text-muted, #6B7280)", marginBottom: "10px", fontWeight: 600 }}>
                  {total} results · showing {results.length}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {results.map((drug, i) => (
                  <button key={i} onClick={() => setSelectedDrug(drug)}
                    style={{ padding: "14px", background: selectedDrug?.product_ndc === drug.product_ndc ? "rgba(234,88,12,0.06)" : "white", borderRadius: "16px", border: `2px solid ${selectedDrug?.product_ndc === drug.product_ndc ? "#EA580C" : "#F1F5F9"}`, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
                    onMouseOver={e => { if (selectedDrug?.product_ndc !== drug.product_ndc) { e.currentTarget.style.borderColor = "#FED7AA"; e.currentTarget.style.background = "#FFFBF5"; } }}
                    onMouseOut={e => { if (selectedDrug?.product_ndc !== drug.product_ndc) { e.currentTarget.style.borderColor = "#F1F5F9"; e.currentTarget.style.background = "white"; } }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#FFF7ED", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Pill size={18} color="#EA580C" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary, #111827)", marginBottom: "2px" }}>{drug.brand_name || drug.generic_name}</div>
                        {drug.brand_name && drug.generic_name && drug.brand_name !== drug.generic_name && (
                          <div style={{ fontSize: "11px", color: "var(--text-secondary, #4B5563)" }}>{drug.generic_name}</div>
                        )}
                        <div style={{ display: "flex", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "10px", fontFamily: "monospace", padding: "1px 6px", background: "#F1F5F9", borderRadius: "4px", color: "var(--text-secondary, #4B5563)" }}>{drug.product_ndc}</span>
                          {drug.dosage_form && <span style={{ fontSize: "10px", padding: "1px 6px", background: "#FFF7ED", color: "#EA580C", borderRadius: "4px", fontWeight: 600 }}>{drug.dosage_form}</span>}
                          {drug.route?.[0] && <span style={{ fontSize: "10px", padding: "1px 6px", background: getRouteColor(drug.route[0]) + "15", color: getRouteColor(drug.route[0]), borderRadius: "4px", fontWeight: 600 }}>{drug.route[0]}</span>}
                        </div>
                      </div>
                      <ChevronRight size={14} color="#CBD5E1" style={{ flexShrink: 0, marginTop: "4px" }} />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Detail panel */}
            <AnimatePresence>
              {selectedDrug && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  style={{ flex: 1, background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.7)", overflow: "hidden", position: "sticky", top: "24px" }}>
                  <div style={{ background: "linear-gradient(135deg, #FFF7ED, #FFEDD5)", padding: "20px", borderBottom: "1px solid #FED7AA" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                      <div>
                        <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-primary, #111827)", marginBottom: "4px" }}>{selectedDrug.brand_name || selectedDrug.generic_name}</div>
                        {selectedDrug.brand_name && selectedDrug.generic_name !== selectedDrug.brand_name && (
                          <div style={{ fontSize: "13px", color: "var(--text-secondary, #4B5563)" }}>{selectedDrug.generic_name}</div>
                        )}
                      </div>
                      <button onClick={() => setSelectedDrug(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted, #6B7280)", padding: "4px", display: "flex", flexShrink: 0 }}>
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                  <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                    {[
                      { icon: Hash, label: "NDC Number", value: selectedDrug.product_ndc, mono: true },
                      { icon: Beaker, label: "Dosage Form", value: selectedDrug.dosage_form },
                      { icon: Tag, label: "Route", value: selectedDrug.route?.join(", ") },
                      { icon: Building, label: "Labeler", value: selectedDrug.labeler_name },
                      { icon: Package, label: "Product Type", value: selectedDrug.product_type },
                      { icon: Calendar, label: "Marketing Status", value: selectedDrug.marketing_status },
                    ].filter(f => f.value).map((field, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                        <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#FFF7ED", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" }}>
                          <field.icon size={14} color="#EA580C" />
                        </div>
                        <div>
                          <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted, #6B7280)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{field.label}</div>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary, #111827)", fontFamily: (field as any).mono ? "monospace" : "inherit" }}>{field.value}</div>
                        </div>
                      </div>
                    ))}
                    {selectedDrug.packaging && selectedDrug.packaging.length > 0 && (
                      <div>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted, #6B7280)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Packaging</div>
                        {selectedDrug.packaging.slice(0, 3).map((p, i) => (
                          <div key={i} style={{ padding: "8px 12px", background: "rgba(255,255,255,0.4)", borderRadius: "8px", marginBottom: "6px", fontSize: "12px", color: "var(--text-secondary, #4B5563)" }}>
                            <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--text-primary, #111827)" }}>{p.package_ndc}</span>
                            <span style={{ marginLeft: "8px" }}>{p.description}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Empty state */}
        {!loading && !results.length && !error && (
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: "#FFF7ED", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Pill size={32} color="#EA580C" />
            </div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary, #111827)", marginBottom: "8px" }}>Search the FDA Drug Database</div>
            <div style={{ fontSize: "13px", color: "var(--text-muted, #6B7280)" }}>Search by brand name, generic name, or NDC number</div>
          </div>
        )}
      </div>
      <style dangerouslySetInnerHTML={{ __html: "@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}" }} />
    </div>
  );
}