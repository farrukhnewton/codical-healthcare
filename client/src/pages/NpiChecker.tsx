import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Search, Building, MapPin, Phone, Globe,
  ChevronRight, X, Hash, Stethoscope, AlertCircle,
  BadgeCheck, Calendar, Mail
} from "lucide-react";

interface Provider {
  number: string;
  basic: { first_name?: string; last_name?: string; organization_name?: string; gender?: string; credential?: string; sole_proprietor?: string; status?: string; enumeration_date?: string; last_updated?: string; };
  addresses: { address_1: string; address_2?: string; city: string; state: string; postal_code: string; telephone_number?: string; fax_number?: string; address_purpose: string; }[];
  taxonomies: { code: string; desc: string; primary: boolean; state?: string; license?: string; }[];
  identifiers?: { code: string; desc: string; identifier: string; state?: string; }[];
}

const SEARCH_TYPES = [
  { id: "npi", label: "NPI Number", icon: Hash, placeholder: "e.g. 1234567890" },
  { id: "individual", label: "Individual", icon: User, placeholder: "First & Last name" },
  { id: "organization", label: "Organization", icon: Building, placeholder: "Organization name" },
];

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

export function NpiChecker() {
  const [searchType, setSearchType] = useState<"npi" | "individual" | "organization">("npi");
  const [npiNumber, setNpiNumber] = useState(() => { const n = sessionStorage.getItem("npi_number") || ""; if (n) sessionStorage.removeItem("npi_number"); return n; });
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [state, setState] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [results, setResults] = useState<Provider[]>([]);
  const [resultCount, setResultCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Provider | null>(null);

  useEffect(() => { if (npiNumber) search(); }, []);

  const search = async () => {
    setLoading(true); setError(""); setSelected(null);
    try {
      const params = new URLSearchParams();
      if (searchType === "npi") params.append("number", npiNumber);
      else if (searchType === "individual") { if (firstName) params.append("firstName", firstName); if (lastName) params.append("lastName", lastName); }
      else params.append("orgName", orgName);
      if (state) params.append("state", state);
      if (specialty) params.append("specialty", specialty);
      params.append("limit", "20");
      const res = await fetch(`/api/npi/search?${params}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) setError(data.message || "Search failed");
      else { setResults(data.results || []); setResultCount(data.resultCount || 0); }
    } catch { setError("Network error. Please try again."); }
    setLoading(false);
  };

  const getProviderName = (p: Provider) =>
    p.basic?.organization_name || [p.basic?.first_name, p.basic?.last_name].filter(Boolean).join(" ") || "Unknown";

  const getPrimaryTaxonomy = (p: Provider) =>
    p.taxonomies?.find(t => t.primary)?.desc || p.taxonomies?.[0]?.desc || "";

  const getPrimaryAddress = (p: Provider) =>
    p.addresses?.find(a => a.address_purpose === "LOCATION") || p.addresses?.[0];

  const isOrg = (p: Provider) => !!p.basic?.organization_name;

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "rgba(255,255,255,0.4)", minHeight: "100vh" }}>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #0F2A4A 100%)", padding: "32px 24px", position: "relative", overflow: "hidden" }}>
        {Array.from({length: 6}).map((_, i) => (
          <div key={i} style={{ position: "absolute", width: (20+i*14)+"px", height: (20+i*14)+"px", borderRadius: "50%", border: "1px solid rgba(124,58,237,0.15)", left: ((i*29+8)%88)+"%", top: ((i*37+15)%75)+"%" }} />
        ))}
        <div style={{ position: "relative", zIndex: 1, maxWidth: "700px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "20px", background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <User size={28} color="#7C3AED" />
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: 900, color: "white", margin: "0 0 8px" }}>NPI Lookup</h1>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", margin: 0 }}>NPPES National Provider Registry · Search 7M+ providers</p>
        </div>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px" }}>
        {/* Search card */}
        <div style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderRadius: "20px", padding: "24px", border: "1px solid rgba(255,255,255,0.7)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", marginBottom: "20px" }}>
          {/* Type tabs */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "18px" }}>
            {SEARCH_TYPES.map(t => (
              <button key={t.id} onClick={() => { setSearchType(t.id as any); setResults([]); setError(""); }}
                style={{ flex: 1, padding: "10px 8px", borderRadius: "10px", border: `2px solid ${searchType === t.id ? "#7C3AED" : "#E2E8F0"}`, background: searchType === t.id ? "rgba(124,58,237,0.06)" : "white", fontSize: "12px", fontWeight: 700, color: searchType === t.id ? "#7C3AED" : "#64748B", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "all 0.15s" }}>
                <t.icon size={14} />{t.label}
              </button>
            ))}
          </div>

          {/* Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {searchType === "npi" && (
              <input value={npiNumber} onChange={e => setNpiNumber(e.target.value)} onKeyDown={e => e.key === "Enter" && search()}
                placeholder="Enter 10-digit NPI number" maxLength={10}
                style={{ height: "48px", padding: "0 16px", border: "2px solid #E2E8F0", borderRadius: "12px", fontSize: "18px", fontFamily: "monospace", fontWeight: 700, letterSpacing: "2px", outline: "none", color: "var(--text-primary, #111827)", transition: "border-color 0.2s" }}
                onFocus={e => { e.target.style.borderColor = "#7C3AED"; }} onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }}
              />
            )}
            {searchType === "individual" && (
              <div style={{ display: "flex", gap: "10px" }}>
                <input value={firstName} onChange={e => setFirstName(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} placeholder="First name"
                  style={{ flex: 1, height: "48px", padding: "0 16px", border: "2px solid #E2E8F0", borderRadius: "12px", fontSize: "14px", outline: "none", color: "var(--text-primary, #111827)", transition: "border-color 0.2s" }}
                  onFocus={e => { e.target.style.borderColor = "#7C3AED"; }} onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }}
                />
                <input value={lastName} onChange={e => setLastName(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} placeholder="Last name"
                  style={{ flex: 1, height: "48px", padding: "0 16px", border: "2px solid #E2E8F0", borderRadius: "12px", fontSize: "14px", outline: "none", color: "var(--text-primary, #111827)", transition: "border-color 0.2s" }}
                  onFocus={e => { e.target.style.borderColor = "#7C3AED"; }} onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }}
                />
              </div>
            )}
            {searchType === "organization" && (
              <input value={orgName} onChange={e => setOrgName(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} placeholder="Organization name"
                style={{ height: "48px", padding: "0 16px", border: "2px solid #E2E8F0", borderRadius: "12px", fontSize: "14px", outline: "none", color: "var(--text-primary, #111827)", transition: "border-color 0.2s" }}
                onFocus={e => { e.target.style.borderColor = "#7C3AED"; }} onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }}
              />
            )}
            {searchType !== "npi" && (
              <div style={{ display: "flex", gap: "10px" }}>
                <select value={state} onChange={e => setState(e.target.value)}
                  style={{ flex: 1, height: "42px", padding: "0 12px", border: "2px solid #E2E8F0", borderRadius: "10px", fontSize: "13px", outline: "none", color: state ? "#0F172A" : "#94A3B8", background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)" }}>
                  <option value="">All States</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="Specialty (optional)"
                  style={{ flex: 2, height: "42px", padding: "0 14px", border: "2px solid #E2E8F0", borderRadius: "10px", fontSize: "13px", outline: "none", color: "var(--text-primary, #111827)" }}
                  onFocus={e => { e.target.style.borderColor = "#7C3AED"; }} onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }}
                />
              </div>
            )}
          </div>

          <motion.button onClick={search} disabled={loading} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
            style={{ width: "100%", height: "48px", marginTop: "14px", background: "linear-gradient(135deg, #7C3AED, #4F46E5)", color: "white", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: "0 4px 16px rgba(124,58,237,0.25)" }}>
            {loading ? <div style={{ width: "18px", height: "18px", border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> : <Search size={16} />}
            {loading ? "Searching NPPES..." : "Search Providers"}
          </motion.button>
        </div>

        {error && (
          <div style={{ padding: "14px 18px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "12px", fontSize: "13px", color: "#DC2626", display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
            <div style={{ width: selected ? "340px" : "100%", flexShrink: 0 }}>
              <div style={{ fontSize: "12px", color: "var(--text-muted, #6B7280)", marginBottom: "10px", fontWeight: 600 }}>
                {resultCount.toLocaleString()} providers found · showing {results.length}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {results.map((p, i) => {
                  const addr = getPrimaryAddress(p);
                  const specialty = getPrimaryTaxonomy(p);
                  return (
                    <button key={i} onClick={() => setSelected(p)}
                      style={{ padding: "14px", background: selected?.number === p.number ? "rgba(124,58,237,0.06)" : "white", borderRadius: "16px", border: `2px solid ${selected?.number === p.number ? "#7C3AED" : "#F1F5F9"}`, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
                      onMouseOver={e => { if (selected?.number !== p.number) { e.currentTarget.style.borderColor = "#DDD6FE"; } }}
                      onMouseOut={e => { if (selected?.number !== p.number) { e.currentTarget.style.borderColor = "#F1F5F9"; } }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                        <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: isOrg(p) ? "#EFF6FF" : "#F5F3FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {isOrg(p) ? <Building size={20} color="#2563EB" /> : <User size={20} color="#7C3AED" />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary, #111827)" }}>{getProviderName(p)}</div>
                            {p.basic?.status === "A" && <BadgeCheck size={14} color="#16A34A" />}
                          </div>
                          {specialty && <div style={{ fontSize: "12px", color: "var(--text-secondary, #4B5563)", marginTop: "2px" }}>{specialty}</div>}
                          {addr && <div style={{ fontSize: "11px", color: "var(--text-muted, #6B7280)", marginTop: "3px", display: "flex", alignItems: "center", gap: "4px" }}><MapPin size={10} />{addr.city}, {addr.state}</div>}
                          <div style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--text-muted, #6B7280)", marginTop: "3px" }}>NPI: {p.number}</div>
                        </div>
                        <ChevronRight size={14} color="#CBD5E1" style={{ flexShrink: 0 }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detail */}
            <AnimatePresence>
              {selected && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  style={{ flex: 1, background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.7)", overflow: "hidden", position: "sticky", top: "24px" }}>
                  <div style={{ background: "linear-gradient(135deg, #F5F3FF, #EDE9FE)", padding: "20px", borderBottom: "1px solid #DDD6FE" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "48px", height: "48px", borderRadius: "16px", background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(124,58,237,0.15)" }}>
                          {isOrg(selected) ? <Building size={24} color="#7C3AED" /> : <User size={24} color="#7C3AED" />}
                        </div>
                        <div>
                          <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-primary, #111827)" }}>{getProviderName(selected)}</div>
                          {selected.basic?.credential && <div style={{ fontSize: "12px", color: "#7C3AED", fontWeight: 600 }}>{selected.basic.credential}</div>}
                        </div>
                      </div>
                      <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted, #6B7280)", padding: "4px", display: "flex" }}><X size={18} /></button>
                    </div>
                  </div>
                  <div style={{ padding: "20px", maxHeight: "500px", overflowY: "auto" }}>
                    {/* NPI + Status */}
                    <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
                      <div style={{ flex: 1, padding: "12px", background: "#F5F3FF", borderRadius: "10px" }}>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: "#7C3AED", marginBottom: "4px" }}>NPI NUMBER</div>
                        <div style={{ fontSize: "18px", fontWeight: 900, fontFamily: "monospace", color: "#6D28D9" }}>{selected.number}</div>
                      </div>
                      <div style={{ flex: 1, padding: "12px", background: selected.basic?.status === "A" ? "#F0FDF4" : "#FEF2F2", borderRadius: "10px" }}>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: selected.basic?.status === "A" ? "#16A34A" : "#EF4444", marginBottom: "4px" }}>STATUS</div>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: selected.basic?.status === "A" ? "#15803D" : "#DC2626" }}>{selected.basic?.status === "A" ? "✓ Active" : "Inactive"}</div>
                      </div>
                    </div>

                    {/* Specialties */}
                    {selected.taxonomies?.length > 0 && (
                      <div style={{ marginBottom: "16px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted, #6B7280)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Specialties</div>
                        {selected.taxonomies.map((t, i) => (
                          <div key={i} style={{ padding: "8px 12px", background: "rgba(255,255,255,0.4)", borderRadius: "8px", marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
                            <Stethoscope size={13} color="#7C3AED" />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary, #111827)" }}>{t.desc}</div>
                              <div style={{ fontSize: "10px", color: "var(--text-muted, #6B7280)" }}>{t.code}{t.state ? ` · ${t.state}` : ""}</div>
                            </div>
                            {t.primary && <span style={{ fontSize: "10px", padding: "1px 6px", background: "#F0FDF4", color: "#16A34A", borderRadius: "4px", fontWeight: 700 }}>PRIMARY</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Addresses */}
                    {selected.addresses?.length > 0 && (
                      <div style={{ marginBottom: "16px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted, #6B7280)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Addresses</div>
                        {selected.addresses.map((addr, i) => (
                          <div key={i} style={{ padding: "12px", background: "rgba(255,255,255,0.4)", borderRadius: "10px", marginBottom: "8px" }}>
                            <div style={{ fontSize: "10px", fontWeight: 700, color: "#7C3AED", marginBottom: "4px" }}>{addr.address_purpose}</div>
                            <div style={{ fontSize: "13px", color: "var(--text-primary, #111827)" }}>{addr.address_1}{addr.address_2 ? `, ${addr.address_2}` : ""}</div>
                            <div style={{ fontSize: "12px", color: "var(--text-secondary, #4B5563)" }}>{addr.city}, {addr.state} {addr.postal_code}</div>
                            {addr.telephone_number && <div style={{ fontSize: "12px", color: "var(--text-secondary, #4B5563)", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}><Phone size={11} /> {addr.telephone_number}</div>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Dates */}
                    <div style={{ display: "flex", gap: "10px" }}>
                      {selected.basic?.enumeration_date && (
                        <div style={{ flex: 1, padding: "10px", background: "rgba(255,255,255,0.4)", borderRadius: "8px" }}>
                          <div style={{ fontSize: "10px", color: "var(--text-muted, #6B7280)", fontWeight: 600 }}>ENUMERATED</div>
                          <div style={{ fontSize: "12px", color: "var(--text-primary, #111827)", fontWeight: 600 }}>{selected.basic.enumeration_date}</div>
                        </div>
                      )}
                      {selected.basic?.last_updated && (
                        <div style={{ flex: 1, padding: "10px", background: "rgba(255,255,255,0.4)", borderRadius: "8px" }}>
                          <div style={{ fontSize: "10px", color: "var(--text-muted, #6B7280)", fontWeight: 600 }}>LAST UPDATED</div>
                          <div style={{ fontSize: "12px", color: "var(--text-primary, #111827)", fontWeight: 600 }}>{selected.basic.last_updated}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {!loading && !results.length && !error && (
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: "#F5F3FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <User size={32} color="#7C3AED" />
            </div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary, #111827)", marginBottom: "8px" }}>Search the NPPES Registry</div>
            <div style={{ fontSize: "13px", color: "var(--text-muted, #6B7280)" }}>Find any provider by NPI number, name, or organization</div>
          </div>
        )}
      </div>
      <style dangerouslySetInnerHTML={{ __html: "@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}" }} />
    </div>
  );
}