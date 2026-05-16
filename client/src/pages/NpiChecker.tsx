import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  BadgeCheck,
  Building,
  Calendar,
  ChevronRight,
  Hash,
  MapPin,
  Phone,
  Search,
  Stethoscope,
  User,
  X,
} from "lucide-react";

interface Provider {
  number: string;
  basic: {
    first_name?: string;
    last_name?: string;
    organization_name?: string;
    gender?: string;
    credential?: string;
    sole_proprietor?: string;
    status?: string;
    enumeration_date?: string;
    last_updated?: string;
  };
  addresses: {
    address_1: string;
    address_2?: string;
    city: string;
    state: string;
    postal_code: string;
    telephone_number?: string;
    fax_number?: string;
    address_purpose: string;
  }[];
  taxonomies: { code: string; desc: string; primary: boolean; state?: string; license?: string }[];
  identifiers?: { code: string; desc: string; identifier: string; state?: string }[];
}

const SEARCH_TYPES = [
  { id: "npi", label: "NPI Number", icon: Hash },
  { id: "individual", label: "Individual", icon: User },
  { id: "organization", label: "Organization", icon: Building },
] as const;

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

function getProviderName(provider: Provider) {
  return provider.basic?.organization_name || [provider.basic?.first_name, provider.basic?.last_name].filter(Boolean).join(" ") || "Unknown provider";
}

function getPrimaryTaxonomy(provider: Provider) {
  return provider.taxonomies?.find((taxonomy) => taxonomy.primary)?.desc || provider.taxonomies?.[0]?.desc || "";
}

function getPrimaryAddress(provider: Provider) {
  return provider.addresses?.find((address) => address.address_purpose === "LOCATION") || provider.addresses?.[0];
}

function isOrganization(provider: Provider) {
  return Boolean(provider.basic?.organization_name);
}

function ProviderAvatar({ provider }: { provider: Provider }) {
  return (
    <span className="provider-avatar" data-type={isOrganization(provider) ? "organization" : "individual"}>
      {isOrganization(provider) ? <Building size={19} /> : <User size={19} />}
    </span>
  );
}

export function NpiChecker() {
  const [searchType, setSearchType] = useState<"npi" | "individual" | "organization">("npi");
  const [npiNumber, setNpiNumber] = useState(() => {
    const value = sessionStorage.getItem("npi_number") || "";
    if (value) sessionStorage.removeItem("npi_number");
    return value;
  });
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

  useEffect(() => {
    if (!npiNumber) return;
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = async () => {
    setLoading(true);
    setError("");
    setSelected(null);

    try {
      const params = new URLSearchParams();
      if (searchType === "npi") {
        params.append("number", npiNumber);
      } else if (searchType === "individual") {
        if (firstName) params.append("firstName", firstName);
        if (lastName) params.append("lastName", lastName);
      } else {
        params.append("orgName", orgName);
      }
      if (state) params.append("state", state);
      if (specialty) params.append("specialty", specialty);
      params.append("limit", "20");

      const res = await fetch(`/api/npi/search?${params}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) setError(data.message || "Search failed");
      else {
        setResults(data.results || []);
        setResultCount(data.resultCount || 0);
      }
    } catch {
      setError("Network error. Please try again.");
    }

    setLoading(false);
  };

  return (
    <div className="tool-page validation-tool-page npi-page">
      <section className="tool-panel tool-page-header">
        <div>
          <h1>NPI Lookup</h1>
          <p>Search the NPPES registry by provider number, individual, or organization.</p>
        </div>
        <div className="search-header-meta">
          <span>Registry search</span>
          <span>{resultCount ? `${resultCount.toLocaleString()} found` : "NPPES"}</span>
        </div>
      </section>

      <section className="tool-panel npi-search-panel">
        <div className="tool-segmented-control npi-search-tabs">
          {SEARCH_TYPES.map((typeOption) => {
            const Icon = typeOption.icon;
            return (
              <button
                key={typeOption.id}
                type="button"
                className={searchType === typeOption.id ? "is-active" : ""}
                onClick={() => {
                  setSearchType(typeOption.id);
                  setResults([]);
                  setError("");
                  setSelected(null);
                }}
              >
                <Icon size={14} />
                {typeOption.label}
              </button>
            );
          })}
        </div>

        <div className="npi-search-fields">
          {searchType === "npi" && (
            <label className="tool-field">
              <span>NPI number</span>
              <input
                className="tool-input tool-code-input"
                value={npiNumber}
                onChange={(event) => setNpiNumber(event.target.value.replace(/\D/g, "").slice(0, 10))}
                onKeyDown={(event) => event.key === "Enter" && search()}
                placeholder="1234567890"
                maxLength={10}
              />
            </label>
          )}

          {searchType === "individual" && (
            <div className="tool-form-grid two">
              <label className="tool-field">
                <span>First name</span>
                <input className="tool-input" value={firstName} onChange={(event) => setFirstName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && search()} placeholder="First name" />
              </label>
              <label className="tool-field">
                <span>Last name</span>
                <input className="tool-input" value={lastName} onChange={(event) => setLastName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && search()} placeholder="Last name" />
              </label>
            </div>
          )}

          {searchType === "organization" && (
            <label className="tool-field">
              <span>Organization</span>
              <input className="tool-input" value={orgName} onChange={(event) => setOrgName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && search()} placeholder="Organization name" />
            </label>
          )}

          {searchType !== "npi" && (
            <div className="tool-form-grid two">
              <label className="tool-field">
                <span>State</span>
                <select className="tool-select" value={state} onChange={(event) => setState(event.target.value)}>
                  <option value="">All states</option>
                  {US_STATES.map((stateCode) => <option key={stateCode} value={stateCode}>{stateCode}</option>)}
                </select>
              </label>
              <label className="tool-field">
                <span>Specialty</span>
                <input className="tool-input" value={specialty} onChange={(event) => setSpecialty(event.target.value)} placeholder="Optional specialty" />
              </label>
            </div>
          )}
        </div>

        <motion.button type="button" onClick={search} disabled={loading} whileHover={{ y: -1 }} className="tool-primary-button full-width">
          {loading ? <span className="tool-spinner" /> : <Search size={16} />}
          {loading ? "Searching" : "Search providers"}
        </motion.button>
      </section>

      {error && (
        <div className="tool-callout" data-tone="danger">
          <AlertCircle size={17} /> {error}
        </div>
      )}

      <div className="npi-workbench">
        <section className="tool-panel npi-results-panel">
          <div className="tool-section-head">
            <div>
              <h2>Search results</h2>
              <p>{results.length ? `${resultCount.toLocaleString()} providers found, showing ${results.length}` : "Run a search to review provider registry records."}</p>
            </div>
            <Search size={17} />
          </div>

          {!loading && !results.length && !error && (
            <div className="tool-empty-state compact">
              <User size={28} />
              <strong>Search the registry</strong>
              <span>Provider matches appear here with specialty, location, and NPI status.</span>
            </div>
          )}

          <div className="provider-result-list">
            {results.map((provider) => {
              const address = getPrimaryAddress(provider);
              const taxonomy = getPrimaryTaxonomy(provider);

              return (
                <button
                  key={provider.number}
                  type="button"
                  className="provider-result-card"
                  data-selected={selected?.number === provider.number}
                  onClick={() => setSelected(provider)}
                >
                  <ProviderAvatar provider={provider} />
                  <span>
                    <strong>{getProviderName(provider)}</strong>
                    {taxonomy && <small>{taxonomy}</small>}
                    {address && <em><MapPin size={11} /> {address.city}, {address.state}</em>}
                    <code>NPI {provider.number}</code>
                  </span>
                  {provider.basic?.status === "A" && <BadgeCheck size={15} />}
                  <ChevronRight size={16} />
                </button>
              );
            })}
          </div>
        </section>

        <AnimatePresence>
          {selected && (
            <motion.section
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="tool-panel provider-detail-panel"
            >
              <div className="provider-detail-hero">
                <div>
                  <ProviderAvatar provider={selected} />
                  <span>
                    <strong>{getProviderName(selected)}</strong>
                    {selected.basic?.credential && <small>{selected.basic.credential}</small>}
                  </span>
                </div>
                <button type="button" className="tool-icon-action" onClick={() => setSelected(null)} aria-label="Close provider detail">
                  <X size={16} />
                </button>
              </div>

              <div className="tool-metric-grid two">
                <div className="tool-metric-card" data-tone="info">
                  <strong>{selected.number}</strong>
                  <span>NPI number</span>
                </div>
                <div className="tool-metric-card" data-tone={selected.basic?.status === "A" ? "success" : "danger"}>
                  <strong>{selected.basic?.status === "A" ? "Active" : "Inactive"}</strong>
                  <span>Status</span>
                </div>
              </div>

              {selected.taxonomies?.length > 0 && (
                <div className="provider-detail-section">
                  <h3>Specialties</h3>
                  <div className="tool-result-list compact">
                    {selected.taxonomies.map((taxonomy) => (
                      <div className="tool-result-row" key={`${taxonomy.code}-${taxonomy.state || ""}`}>
                        <div className="validation-code-line">
                          <Stethoscope size={15} />
                          <strong>{taxonomy.desc}</strong>
                          {taxonomy.primary && <span className="tool-status-pill" data-tone="success">Primary</span>}
                        </div>
                        <p>{taxonomy.code}{taxonomy.state ? ` | ${taxonomy.state}` : ""}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.addresses?.length > 0 && (
                <div className="provider-detail-section">
                  <h3>Addresses</h3>
                  <div className="tool-result-list compact">
                    {selected.addresses.map((address, index) => (
                      <div className="tool-result-row" key={`${address.address_purpose}-${index}`}>
                        <div className="validation-code-line">
                          <MapPin size={15} />
                          <strong>{address.address_purpose}</strong>
                        </div>
                        <p>{address.address_1}{address.address_2 ? `, ${address.address_2}` : ""}</p>
                        <p>{address.city}, {address.state} {address.postal_code}</p>
                        {address.telephone_number && <small><Phone size={12} /> {address.telephone_number}</small>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="provider-date-grid">
                {selected.basic?.enumeration_date && (
                  <div>
                    <Calendar size={14} />
                    <span>Enumerated</span>
                    <strong>{selected.basic.enumeration_date}</strong>
                  </div>
                )}
                {selected.basic?.last_updated && (
                  <div>
                    <Calendar size={14} />
                    <span>Last updated</span>
                    <strong>{selected.basic.last_updated}</strong>
                  </div>
                )}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
