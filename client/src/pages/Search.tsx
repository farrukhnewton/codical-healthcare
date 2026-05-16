import { useEffect, useMemo, useState } from "react";
import { Filter, Search as SearchIcon, SlidersHorizontal, X } from "lucide-react";
import { useLocation } from "wouter";
import { useDebounce } from "use-debounce";
import { AnimatePresence, motion } from "framer-motion";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useSearchCodes } from "@/hooks/use-codes";
import { CodeCard } from "@/components/codes/CodeCard";
import { CodeDetails } from "@/components/codes/CodeDetails";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { MedicalCode } from "shared/schema";

const CODE_TYPES = ["All", "ICD-10-CM", "CPT", "HCPCS"];

const FILTER_GROUPS = [
  { label: "Status", values: ["Active", "With guidance", "Favorites"] },
  { label: "Place of service", values: ["Office", "Facility", "Telehealth"] },
  { label: "Context", values: ["RVU", "Edits", "Coverage"] },
];

export function Search() {
  const [location, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState(() => {
    const q = sessionStorage.getItem("codicalhealth_sq") || "";
    sessionStorage.removeItem("codicalhealth_sq");
    return q;
  });
  const [debouncedSearch] = useDebounce(searchTerm, 300);
  const [selectedType, setSelectedType] = useState(() => {
    const t = sessionStorage.getItem("codicalhealth_type") || "All";
    sessionStorage.removeItem("codicalhealth_type");
    return t;
  });
  const [selectedCode, setSelectedCode] = useState<MedicalCode | null>(null);

  useEffect(() => {
    const q = sessionStorage.getItem("codicalhealth_sq") || "";
    const t = sessionStorage.getItem("codicalhealth_type") || "";
    if (q) {
      sessionStorage.removeItem("codicalhealth_sq");
      setSearchTerm(q);
    }
    if (t) {
      sessionStorage.removeItem("codicalhealth_type");
      setSelectedType(t);
    }
  }, [location]);

  const { data: codes, isLoading, isError, refetch } = useSearchCodes(debouncedSearch, selectedType);
  const resultCount = codes?.length || 0;

  useEffect(() => {
    if (!codes?.length) {
      setSelectedCode(null);
      return;
    }

    const stillVisible = selectedCode
      ? codes.some((code) => code.code === selectedCode.code && code.type === selectedCode.type)
      : false;

    if (!stillVisible) setSelectedCode(codes[0] as MedicalCode);
  }, [codes, selectedCode]);

  const selectedMeta = useMemo(() => {
    if (!selectedCode) return "Select a result to review code details, guidance, edits, and reimbursement context.";
    return `${selectedCode.type} ${selectedCode.code}`;
  }, [selectedCode]);

  return (
    <div className="tool-page search-page">
      <section className="tool-page-header tool-panel">
        <div>
          <h1>Code Directory</h1>
          <p>Search CPT, ICD-10-CM, and HCPCS references with coding context in one view.</p>
        </div>

        <div className="search-header-meta">
          <span>{resultCount} results</span>
          <span>{selectedMeta}</span>
        </div>
      </section>

      <section className="search-command-panel tool-panel">
        <div className="tool-search-field">
          <SearchIcon size={18} aria-hidden="true" />
          <input
            type="text"
            placeholder="Search codes, descriptions, guidelines, docs..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          {searchTerm ? (
            <button type="button" onClick={() => setSearchTerm("")} aria-label="Clear search">
              <X size={16} />
            </button>
          ) : null}
        </div>

        <div className="tool-segmented-control" role="tablist" aria-label="Code type">
          {CODE_TYPES.map((type) => (
            <button
              type="button"
              key={type}
              className={selectedType === type ? "is-active" : ""}
              onClick={() => setSelectedType(type)}
            >
              {type}
            </button>
          ))}
        </div>
      </section>

      <div className="search-workbench">
        <aside className="tool-filter-panel tool-panel">
          <div className="tool-section-head">
            <div>
              <h2>Filters</h2>
              <p>Refine the working result set.</p>
            </div>
            <SlidersHorizontal size={17} />
          </div>

          <div className="filter-stack">
            {FILTER_GROUPS.map((group) => (
              <div className="filter-group" key={group.label}>
                <span>{group.label}</span>
                {group.values.map((value) => (
                  <label key={value}>
                    <input type="checkbox" />
                    {value}
                  </label>
                ))}
              </div>
            ))}
          </div>

          <button
            type="button"
            className="tool-secondary-button"
            onClick={() => {
              setSearchTerm("");
              setSelectedType("All");
            }}
          >
            Reset filters
          </button>
        </aside>

        <section className="search-results-panel tool-panel">
          <div className="tool-section-head">
            <div>
              <h2>Search results</h2>
              <p>{debouncedSearch ? `Exact and related matches for "${debouncedSearch}"` : "Commonly used codes and recent references"}</p>
            </div>
            <Filter size={17} />
          </div>

          <ScrollArea className="search-results-scroll">
            <div className="search-results-list">
              {isLoading ? (
                <LoadingState message="Searching code directory..." variant="dots" />
              ) : isError ? (
                <ErrorState title="Search failed" message="Could not retrieve codes. Please try again." onRetry={() => refetch()} />
              ) : codes?.length === 0 ? (
                <div className="tool-empty-state">
                  <Filter size={34} />
                  <strong>No matches found</strong>
                  <span>Try a broader code, descriptor, or keyword.</span>
                  {searchTerm ? (
                    <button type="button" className="tool-secondary-button" onClick={() => setSearchTerm("")}>
                      Clear search
                    </button>
                  ) : null}
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {codes?.map((code, index) => (
                    <motion.div
                      key={`${code.type}-${code.code}-${index}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ delay: Math.min(index * 0.015, 0.12) }}
                    >
                      <CodeCard
                        isFavorite={false}
                        onToggleFavorite={() => {}}
                        code={code as MedicalCode}
                        isSelected={selectedCode?.code === code.code && selectedCode?.type === code.type}
                        onClick={() => {
                          setSelectedCode(code as MedicalCode);
                          if (window.innerWidth < 1024) setLocation(`/intel/${code.code}`);
                        }}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </ScrollArea>
        </section>

        <section className="search-detail-panel">
          {selectedCode ? (
            <motion.div key={`${selectedCode.type}-${selectedCode.code}`} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}>
              <CodeDetails codeItem={selectedCode as MedicalCode} />
            </motion.div>
          ) : (
            <div className="tool-empty-state tool-panel">
              <SearchIcon size={38} />
              <strong>Select a code</strong>
              <span>Details, guidelines, edits, and payment context will appear here.</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
