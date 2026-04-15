import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen, FileText, Shield, Search, ExternalLink,
  Download, ChevronRight, Globe, X, ArrowLeft,
  BookMarked, Stethoscope, Activity, Tag, Zap,
  ChevronDown
} from "lucide-react";

const TABS = [
  { id: "guidelines", label: "Coding Guidelines", icon: BookOpen },
  { id: "lcd", label: "LCD Policies", icon: Shield },
  { id: "ncd", label: "NCD Policies", icon: FileText },
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
    category: "ICD-10-PCS", color: "#7C3AED", bg: "#F5F3FF",
    items: [
      { title: "2026 ICD-10-PCS Official Coding Guidelines", desc: "Official PCS guidelines for inpatient procedure coding", url: "https://www.cms.gov/files/document/2026-official-icd-10-pcs-coding-guidelines.pdf", type: "PDF", date: "Oct 2025" },
      { title: "2026 ICD-10-PCS Code Tables", desc: "Complete PCS code tables and index", url: "https://www.cms.gov/medicare/coding-billing/icd-10-codes", type: "WEB", date: "Oct 2025" },
    ]
  },
  {
    category: "Medicare Fee Schedule", color: "#16A34A", bg: "#F0FDF4",
    items: [
      { title: "CY 2026 Physician Fee Schedule Final Rule", desc: "Complete CY2026 PFS final rule and payment rates", url: "https://www.cms.gov/medicare/payment/fee-schedules/physician", type: "WEB", date: "Nov 2025" },
      { title: "CY 2026 MPFS Relative Value Files", desc: "RVU data files for all CPT codes", url: "https://www.cms.gov/medicare/payment/fee-schedules/physician", type: "WEB", date: "Jan 2026" },
    ]
  },
  {
    category: "NCCI & Billing", color: "#EA580C", bg: "#FFF7ED",
    items: [
      { title: "NCCI Policy Manual 2026", desc: "Complete NCCI coding policy manual for Medicare services", url: "https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits", type: "WEB", date: "Jan 2026" },
      { title: "NCCI Procedure-to-Procedure Edits", desc: "Downloadable PTP edit files", url: "https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits", type: "WEB", date: "Apr 2026" },
    ]
  },
];

const KEY_GUIDELINES = [
  { id: "g1", category: "General", icon: BookMarked, color: "#2563EB", title: "Code to Highest Level of Specificity", content: "Code to the highest number of characters available. A code is invalid if it has not been coded to the full number of characters required for that code, including the 7th character, if applicable.", source: "ICD-10-CM Guidelines §I.B.1", year: "FY2026" },
  { id: "g2", category: "General", icon: BookMarked, color: "#2563EB", title: "Signs and Symptoms", content: "Codes that describe symptoms and signs, as opposed to diagnoses, are acceptable for reporting purposes when a related definitive diagnosis has not been established (confirmed) by the provider.", source: "ICD-10-CM Guidelines §I.B.4", year: "FY2026" },
  { id: "g3", category: "General", icon: BookMarked, color: "#2563EB", title: "Acute and Chronic Conditions", content: "If the same condition is described as both acute (subacute) and chronic, and separate subentries exist in the Alphabetic Index at the same indentation level, code both and sequence the acute (subacute) code first.", source: "ICD-10-CM Guidelines §I.B.8", year: "FY2026" },
  { id: "g4", category: "E/M", icon: Stethoscope, color: "#7C3AED", title: "E/M Level Selection - Medical Decision Making", content: "For E/M services, the level of medical decision making (MDM) is based on three elements: number and complexity of problems, amount and/or complexity of data reviewed, and risk of complications and/or morbidity or mortality.", source: "AMA CPT E/M Guidelines 2026", year: "2026" },
  { id: "g5", category: "E/M", icon: Stethoscope, color: "#7C3AED", title: "E/M Time-Based Billing", content: "For office/outpatient E/M services, total time on the date of the encounter may be used to select the level of service. Time includes both face-to-face and non-face-to-face time.", source: "AMA CPT E/M Guidelines 2026", year: "2026" },
  { id: "g6", category: "Surgery", icon: Activity, color: "#EA580C", title: "Global Surgery Package", content: "The global surgical package includes: pre-operative visits after the decision for surgery, intra-operative services, complications following surgery, post-operative visits, and post-surgical pain management.", source: "CMS Global Surgery Policy", year: "2026" },
  { id: "g7", category: "Surgery", icon: Activity, color: "#EA580C", title: "Multiple Procedures - Modifier 51", content: "When multiple procedures are performed on the same day by the same physician, the procedure with the highest RVU is paid at 100%, and additional procedures are paid at reduced rates. Modifier 51 applies.", source: "CMS MPFS Rules", year: "CY2026" },
  { id: "g8", category: "Modifiers", icon: Tag, color: "#16A34A", title: "Modifier 25 - Significant E/M on Same Day as Procedure", content: "Modifier 25 is used when a significant, separately identifiable E/M service is performed by the same physician on the same day as a procedure. The E/M must be above and beyond the usual pre/post-operative care.", source: "CMS NCCI Policy Manual", year: "2026" },
  { id: "g9", category: "Modifiers", icon: Tag, color: "#16A34A", title: "Modifier 59 - Distinct Procedural Service", content: "Modifier 59 indicates a procedure or service that is not normally reported together but is appropriate under the circumstances. It should only be used when no other modifier more specifically describes the relationship.", source: "CMS NCCI Policy Manual", year: "2026" },
  { id: "g10", category: "Telehealth", icon: Zap, color: "#0891B2", title: "Telehealth Services POS Codes", content: "For telehealth services where the patient is at home: use POS 10. For other telehealth locations: use POS 02. The originating site modifier GT is no longer required for most Medicare telehealth services.", source: "CMS Telehealth Policy CY2026", year: "CY2026" },
  { id: "g11", category: "Sequencing", icon: BookMarked, color: "#2563EB", title: "Principal Diagnosis Selection", content: "The principal diagnosis is defined as the condition established after study to be chiefly responsible for occasioning the admission of the patient to the hospital for care.", source: "ICD-10-CM Guidelines §II", year: "FY2026" },
  { id: "g12", category: "Sequencing", icon: BookMarked, color: "#2563EB", title: "Present on Admission (POA)", content: "POA is defined as present at the time the order for inpatient admission occurs. Conditions that develop during an outpatient encounter, including emergency department, are considered POA.", source: "ICD-10-CM POA Guidelines", year: "FY2026" },
];

const CATEGORIES = ["All", "General", "E/M", "Surgery", "Modifiers", "Telehealth", "Sequencing"];

function PolicyDetail({ policy, type, onBack }: { policy: any; type: "lcd" | "ncd"; onBack: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: [type === "lcd" ? "/api/coverage/lcd" : "/api/coverage/ncd", policy.document_id, policy.document_version],
    queryFn: async () => {
      const url = type === "lcd"
        ? `/api/coverage/lcd/${policy.document_id}/${policy.document_version}`
        : `/api/coverage/ncd/${policy.document_id}/${policy.document_version}`;
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
  });

  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary, #4B5563)", fontSize: "13px", fontWeight: 600, padding: "0 0 16px", marginBottom: "4px" }}>
        <ArrowLeft size={14} /> Back to list
      </button>

      <div style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.7)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "20px", borderBottom: "1px solid #F8FAFC", background: type === "lcd" ? "#ECFEFF" : "#FFF7ED" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ padding: "3px 10px", background: type === "lcd" ? "#0891B2" : "#EA580C", color: "white", borderRadius: "6px", fontSize: "11px", fontWeight: 700 }}>{type.toUpperCase()}</span>
            <span style={{ fontSize: "12px", color: "var(--text-secondary, #4B5563)", fontFamily: "monospace" }}>{policy.document_display_id}</span>
            {policy.last_updated && <span style={{ fontSize: "11px", color: "var(--text-muted, #6B7280)" }}>Updated: {policy.last_updated}</span>}
          </div>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary, #111827)", margin: 0, lineHeight: 1.4 }}>{policy.title}</h2>
          {policy.contractor_name_type && (
            <div style={{ fontSize: "12px", color: "var(--text-secondary, #4B5563)", marginTop: "6px" }}>{String(policy.contractor_name_type).split("\r")[0]}</div>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: "20px" }}>
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <div style={{ width: "32px", height: "32px", border: "3px solid #E2E8F0", borderTop: "3px solid #15803D", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
              <div style={{ fontSize: "13px", color: "var(--text-secondary, #4B5563)" }}>Loading policy details...</div>
            </div>
          ) : data ? (
            <div>
              {/* Policy sections */}
              {["coverage_indications_limitations_and_or_medical_necessity", "bill_and_code", "icd_codes", "cpt_hcpcs_codes", "documentation_requirements", "utilization_guidelines"].map(key => {
                const val = data[key];
                if (!val) return null;
                const label = key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
                return (
                  <div key={key} style={{ marginBottom: "20px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#15803D", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>{label}</div>
                    <div style={{ fontSize: "13px", color: "var(--text-secondary, #4B5563)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                      <div className="policy-content" style={{fontSize:"13px",color:"#475569",lineHeight:1.7}} dangerouslySetInnerHTML={{ __html: typeof val === "string" ? val.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&").replace(/&nbsp;/g," ").replace(/&#(d+);/g,(_,n)=>String.fromCharCode(n)).slice(0,5000) : "" }} />
                    </div>
                  </div>
                );
              })}
              {/* Fallback: show all non-empty string fields */}
              {!Object.keys(data).some(k => ["coverage_indications_limitations_and_or_medical_necessity", "bill_and_code"].includes(k) && data[k]) && (
                <div>
                  {Object.entries(data).filter(([k, v]) => v && typeof v === "string" && v.length > 10 && !["document_id", "document_version", "document_display_id", "document_type", "title"].includes(k)).slice(0, 6).map(([k, v]) => (
                    <div key={k} style={{ marginBottom: "16px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#15803D", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>{k.replace(/_/g, " ")}</div>
                      <div className="policy-content" style={{fontSize:"13px",color:"#475569",lineHeight:1.7}} dangerouslySetInnerHTML={{ __html: (()=>{let h=String(v);h=h.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&").replace(/&nbsp;/g," ").replace(/&sol;/g,"/").replace(/&apos;/g,"'").replace(/&quot;/g,'\"').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));return h;})().slice(0,3000) }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "32px", color: "var(--text-muted, #6B7280)" }}>
              <FileText size={32} style={{ margin: "0 auto 12px", display: "block" }} />
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary, #111827)" }}>Details not available</div>
              <div style={{ fontSize: "13px", marginTop: "4px" }}>Full policy text requires CMS authentication</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PolicyList({ type }: { type: "lcd" | "ncd" }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: [type === "lcd" ? "/api/coverage/lcd" : "/api/coverage/ncd"],
    queryFn: async () => {
      const url = type === "lcd" ? "/api/coverage/lcd" : "/api/coverage/ncd";
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
  });

  const items = Array.isArray(data) ? data.filter((item: any) =>
    !search || item.title?.toLowerCase().includes(search.toLowerCase()) ||
    item.document_display_id?.toLowerCase().includes(search.toLowerCase())
  ) : [];

  if (selected) return <PolicyDetail policy={selected} type={type} onBack={() => setSelected(null)} />;

  const color = type === "lcd" ? "#0891B2" : "#EA580C";
  const bg = type === "lcd" ? "#ECFEFF" : "#FFF7ED";

  return (
    <div>
      <div style={{ position: "relative", marginBottom: "16px" }}>
        <Search size={15} color="#94A3B8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${type.toUpperCase()} policies...`}
          style={{ width: "100%", height: "42px", paddingLeft: "36px", border: "2px solid #E2E8F0", borderRadius: "10px", fontSize: "13px", outline: "none", boxSizing: "border-box", background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)" }}
          onFocus={e => { e.target.style.borderColor = "#15803D"; }}
          onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }}
        />
      </div>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <div style={{ width: "28px", height: "28px", border: "2px solid #E2E8F0", borderTop: "2px solid #15803D", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          <div style={{ fontSize: "13px", color: "var(--text-secondary, #4B5563)" }}>Loading policies...</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted, #6B7280)", marginBottom: "4px" }}>{items.length} policies found</div>
          {items.slice(0, 50).map((item: any, i: number) => (
            <button key={i} onClick={() => setSelected(item)}
              style={{ padding: "14px 16px", background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.7)", display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
              onMouseOver={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 2px 12px ${color}20`; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = "#F1F5F9"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <span style={{ padding: "2px 8px", background: bg, color, borderRadius: "6px", fontSize: "11px", fontWeight: 700, flexShrink: 0 }}>{type.toUpperCase()}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary, #111827)", lineHeight: 1.4, marginBottom: "2px" }}>{item.title}</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted, #6B7280)" }}>
                  {item.document_display_id}
                  {type === "lcd" && item.contractor_name_type && ` · ${String(item.contractor_name_type).split("\r")[0]}`}
                  {type === "ncd" && item.last_updated && ` · Updated: ${item.last_updated}`}
                </div>
              </div>
              <ChevronRight size={14} color="#CBD5E1" style={{ flexShrink: 0 }} />
            </button>
          ))}
          {items.length === 0 && (
            <div style={{ textAlign: "center", padding: "32px", color: "var(--text-muted, #6B7280)", fontSize: "13px" }}>
              No policies found for "{search}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function KnowledgeCenter() {
  const [activeTab, setActiveTab] = useState("guidelines");
  const [guideSearch, setGuideSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredGuidelines = KEY_GUIDELINES.filter(g => {
    const matchesCategory = activeCategory === "All" || g.category === activeCategory;
    const matchesSearch = !guideSearch || g.title.toLowerCase().includes(guideSearch.toLowerCase()) || g.content.toLowerCase().includes(guideSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "rgba(255,255,255,0.4)" }}>
      <div style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderBottom: "1px solid #F1F5F9", padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg, #15803D, #1B2F6E)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BookOpen size={18} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-primary, #111827)", margin: 0 }}>CMS Knowledge Center</h1>
            <p style={{ fontSize: "12px", color: "var(--text-secondary, #4B5563)", margin: 0 }}>Official guidelines, LCD/NCD policies, and CMS resources</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0", marginTop: "16px", overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}>
          <style dangerouslySetInnerHTML={{ __html: "div::-webkit-scrollbar { display: none; }" }} />
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "12px 16px", background: "none", border: "none", borderBottom: activeTab === tab.id ? "2px solid #15803D" : "2px solid transparent", cursor: "pointer", fontSize: "13px", fontWeight: activeTab === tab.id ? 700 : 500, color: activeTab === tab.id ? "#15803D" : "#64748B", transition: "all 0.15s", marginBottom: "-1px", whiteSpace: "nowrap" }}>
              <tab.icon size={14} />{tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: window.innerWidth < 640 ? "16px" : "24px", maxWidth: "900px" }}>
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>

            {activeTab === "guidelines" && (
              <div>
                <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
                  <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
                    <Search size={15} color="#94A3B8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
                    <input value={guideSearch} onChange={e => setGuideSearch(e.target.value)} placeholder="Search guidelines..."
                      style={{ width: "100%", height: "40px", paddingLeft: "36px", border: "2px solid #E2E8F0", borderRadius: "10px", fontSize: "13px", outline: "none", boxSizing: "border-box", background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)" }}
                      onFocus={e => { e.target.style.borderColor = "#15803D"; }} onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }} />
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {CATEGORIES.map(cat => (
                      <button key={cat} onClick={() => setActiveCategory(cat)} style={{ padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, border: "none", cursor: "pointer", background: activeCategory === cat ? "#15803D" : "#F1F5F9", color: activeCategory === cat ? "white" : "#64748B" }}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {filteredGuidelines.map(g => (
                    <div key={g.id} style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.7)", overflow: "hidden" }}>
                      <button onClick={() => setExpandedId(expandedId === g.id ? null : g.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                        <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: g.color + "15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <g.icon size={15} color={g.color} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary, #111827)" }}>{g.title}</div>
                          <div style={{ fontSize: "11px", color: "var(--text-muted, #6B7280)", marginTop: "1px" }}>{g.source} · {g.year}</div>
                        </div>
                        <span style={{ padding: "2px 8px", background: g.color + "15", color: g.color, borderRadius: "20px", fontSize: "10px", fontWeight: 700, flexShrink: 0 }}>{g.category}</span>
                        <ChevronDown size={14} color="#94A3B8" style={{ transform: expandedId === g.id ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }} />
                      </button>
                      <AnimatePresence>
                        {expandedId === g.id && (
                          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} style={{ overflow: "hidden" }}>
                            <div style={{ padding: "0 18px 16px 62px", fontSize: "13px", color: "var(--text-secondary, #4B5563)", lineHeight: 1.7, borderTop: "1px solid #F8FAFC" }}>
                              <div style={{ paddingTop: "12px" }}>{g.content}</div>
                              <div style={{ marginTop: "10px", fontSize: "11px", color: "var(--text-muted, #6B7280)", fontStyle: "italic" }}>Source: {g.source}</div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "lcd" && <PolicyList type="lcd" />}
            {activeTab === "ncd" && <PolicyList type="ncd" />}

            {activeTab === "resources" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div style={{ padding: "12px 16px", background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.15)", borderRadius: "10px", fontSize: "12px", color: "#0369A1", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Globe size={14} color="#15803D" />
                  All resources are official CMS public domain documents. Always use the most current version for coding.
                </div>
                {CMS_RESOURCES.map((section, si) => (
                  <div key={si}>
                    <div style={{ marginBottom: "10px" }}>
                      <span style={{ padding: "3px 10px", background: section.bg, color: section.color, borderRadius: "6px", fontSize: "12px", fontWeight: 700 }}>{section.category}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {section.items.map((item, ii) => (
                        <div key={ii} style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderRadius: "12px", padding: "14px 16px", border: "1px solid rgba(255,255,255,0.7)", display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary, #111827)", marginBottom: "3px" }}>{item.title}</div>
                            <div style={{ fontSize: "12px", color: "var(--text-secondary, #4B5563)" }}>{item.desc}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                            <span style={{ padding: "2px 8px", background: item.type === "PDF" ? "#FEF2F2" : "#F0FDF4", color: item.type === "PDF" ? "#DC2626" : "#16A34A", borderRadius: "6px", fontSize: "10px", fontWeight: 700 }}>{item.type}</span>
                            <span style={{ fontSize: "11px", color: "var(--text-muted, #6B7280)" }}>{item.date}</span>
                            <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "4px", padding: "6px 12px", background: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.7)", borderRadius: "8px", fontSize: "12px", color: "#15803D", textDecoration: "none", fontWeight: 600 }}>
                              {item.type === "PDF" ? <Download size={12} /> : <ExternalLink size={12} />}
                              {item.type === "PDF" ? "Download" : "Open"}
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
      <style dangerouslySetInnerHTML={{ __html: "@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}} .policy-content p{margin:0 0 12px;line-height:1.7} .policy-content ul{margin:0 0 12px;padding-left:20px} .policy-content li{margin-bottom:4px} .policy-content strong{font-weight:700} .policy-content sup,.policy-content sub{font-size:10px}" }} />
    </div>
  );
}

