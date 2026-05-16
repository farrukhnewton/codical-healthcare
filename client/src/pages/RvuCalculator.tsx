import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, Building, Calculator, FileText, Info, Minus, Plus, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface RvuData {
  code: string;
  description: string;
  year: number;
  conversionFactor: number;
  workRvu: number;
  nonFacilityPeRvu: number;
  facilityPeRvu: number;
  malpracticeRvu: number;
  totalNonFacilityRvu: number;
  totalFacilityRvu: number;
  nonFacilityPayment: number;
  facilityPayment: number;
  globalPeriod: string;
  procStatus: string;
}

function getGlobalPeriodLabel(value: string) {
  const map: Record<string, string> = {
    "000": "0 days",
    "010": "10 days",
    "090": "90 days",
    MMM: "Maternity",
    XXX: "N/A",
    YYY: "By report",
    ZZZ: "Add-on",
  };

  return map[value] || value;
}

function MetricCard({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="tool-metric-card" data-tone={tone}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function RvuBar({ label, value, description, max, tone }: { label: string; value: number; description: string; max: number; tone: string }) {
  const width = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  return (
    <div className="rvu-breakdown-row" data-tone={tone}>
      <div>
        <strong>{label}</strong>
        <span>{description}</span>
      </div>
      <em>{value.toFixed(2)}</em>
      <div className="rvu-breakdown-track">
        <span style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function RvuCalculator() {
  const [cptInput, setCptInput] = useState(() => {
    const code = sessionStorage.getItem("rvu_code") || "";
    sessionStorage.removeItem("rvu_code");
    return code;
  });
  const [activeCode, setActiveCode] = useState(() => sessionStorage.getItem("rvu_code_active") || "");
  const [units, setUnits] = useState(1);
  const [setting, setSetting] = useState<"non-facility" | "facility">("non-facility");

  const { data: rvuData, isLoading, isError } = useQuery({
    queryKey: ["/api/rvu", activeCode],
    queryFn: async () => {
      const res = await fetch(`/api/rvu/${activeCode}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch RVU data");
      return res.json() as Promise<RvuData>;
    },
    enabled: !!activeCode,
  });

  useEffect(() => {
    const code = sessionStorage.getItem("rvu_code") || "";
    if (!code) return;
    sessionStorage.removeItem("rvu_code");
    setCptInput(code);
    setActiveCode(code);
  }, []);

  const handleSearch = () => {
    if (!cptInput.trim()) return;
    setActiveCode(cptInput.trim().toUpperCase());
  };

  const selectedRvu = rvuData
    ? setting === "non-facility"
      ? rvuData.totalNonFacilityRvu * units
      : rvuData.totalFacilityRvu * units
    : 0;

  const selectedPayment = rvuData
    ? setting === "non-facility"
      ? rvuData.nonFacilityPayment * units
      : rvuData.facilityPayment * units
    : 0;

  const breakdownMax = rvuData
    ? Math.max(rvuData.workRvu, rvuData.nonFacilityPeRvu, rvuData.facilityPeRvu, rvuData.malpracticeRvu)
    : 1;

  return (
    <div className="tool-page validation-tool-page rvu-page">
      <section className="tool-panel tool-page-header">
        <div>
          <h1>RVU Calculator</h1>
          <p>Calculate Medicare physician fee schedule payment from CPT RVU components.</p>
        </div>
        <div className="search-header-meta">
          <span>CY 2026</span>
          <span>CF ${rvuData?.conversionFactor?.toFixed(4) || "33.4009"}</span>
        </div>
      </section>

      <section className="tool-panel calculator-command-panel">
        <div className="tool-search-field">
          <Search size={18} />
          <input
            value={cptInput}
            onChange={(event) => setCptInput(event.target.value.toUpperCase())}
            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
            placeholder="Enter CPT code, for example 99213"
          />
        </div>
        <motion.button
          type="button"
          onClick={handleSearch}
          disabled={isLoading || !cptInput.trim()}
          className="tool-primary-button"
          whileHover={{ y: cptInput.trim() ? -1 : 0 }}
        >
          {isLoading ? <span className="tool-spinner" /> : <Calculator size={16} />}
          {isLoading ? "Calculating" : "Calculate"}
        </motion.button>
      </section>

      {rvuData && (
        <section className="tool-panel calculator-controls-panel">
          <div className="calculator-stepper">
            <span>Units</span>
            <button type="button" onClick={() => setUnits(Math.max(1, units - 1))} aria-label="Decrease units">
              <Minus size={14} />
            </button>
            <strong>{units}</strong>
            <button type="button" onClick={() => setUnits(units + 1)} aria-label="Increase units">
              <Plus size={14} />
            </button>
          </div>

          <div className="tool-segmented-control validation-segmented">
            {(["non-facility", "facility"] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={setting === option ? "is-active" : ""}
                onClick={() => setSetting(option)}
              >
                {option === "non-facility" ? "Office / Clinic" : "Hospital / Facility"}
              </button>
            ))}
          </div>
        </section>
      )}

      {isError && (
        <div className="tool-callout" data-tone="danger">
          <Info size={17} /> CPT code not found in the current fee schedule.
        </div>
      )}

      <AnimatePresence mode="wait">
        {rvuData ? (
          <motion.div
            key={rvuData.code}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="calculator-workbench"
          >
            <section className="tool-panel calculator-summary-panel">
              <div className="calculator-code-header">
                <span className="tool-code-chip" data-type="CPT">{rvuData.code}</span>
                <div>
                  <h2>{rvuData.description}</h2>
                  <p>CY {rvuData.year} Medicare Physician Fee Schedule</p>
                </div>
              </div>

              <div className="calculator-payment-hero">
                <span>{setting === "non-facility" ? "Office / clinic payment" : "Hospital / facility payment"}</span>
                <strong>${selectedPayment.toFixed(2)}</strong>
                <small>{selectedRvu.toFixed(2)} RVU x {units} unit{units === 1 ? "" : "s"}</small>
              </div>

              <div className="tool-metric-grid four">
                <MetricCard label="Work RVU" value={rvuData.workRvu.toFixed(2)} />
                <MetricCard label="MP RVU" value={rvuData.malpracticeRvu.toFixed(2)} />
                <MetricCard label="Global" value={getGlobalPeriodLabel(rvuData.globalPeriod)} />
                <MetricCard label="Status" value={rvuData.procStatus === "A" ? "Active" : rvuData.procStatus} tone="success" />
              </div>
            </section>

            <section className="tool-panel calculator-detail-panel">
              <div className="tool-section-head">
                <div>
                  <h2>Payment comparison</h2>
                  <p>Facility and non-facility amounts before locality adjustment.</p>
                </div>
                <DollarIcon />
              </div>

              <div className="payment-card-grid">
                <button
                  type="button"
                  className="payment-option-card"
                  data-selected={setting === "non-facility"}
                  onClick={() => setSetting("non-facility")}
                >
                  <Building size={18} />
                  <span>Office / Non-facility</span>
                  <strong>${(rvuData.nonFacilityPayment * units).toFixed(2)}</strong>
                  <small>{(rvuData.totalNonFacilityRvu * units).toFixed(2)} RVU</small>
                </button>

                <button
                  type="button"
                  className="payment-option-card"
                  data-selected={setting === "facility"}
                  onClick={() => setSetting("facility")}
                >
                  <Activity size={18} />
                  <span>Hospital / Facility</span>
                  <strong>${(rvuData.facilityPayment * units).toFixed(2)}</strong>
                  <small>{(rvuData.totalFacilityRvu * units).toFixed(2)} RVU</small>
                </button>
              </div>
            </section>

            <section className="tool-panel calculator-breakdown-panel">
              <div className="tool-section-head">
                <div>
                  <h2>RVU component breakdown</h2>
                  <p>Work, practice expense, and malpractice components.</p>
                </div>
                <FileText size={17} />
              </div>

              <div className="rvu-breakdown-list">
                <RvuBar label="Work RVU" value={rvuData.workRvu} description="Physician work effort" max={breakdownMax} tone="blue" />
                <RvuBar label="PE RVU, non-facility" value={rvuData.nonFacilityPeRvu} description="Practice expense in office setting" max={breakdownMax} tone="green" />
                <RvuBar label="PE RVU, facility" value={rvuData.facilityPeRvu} description="Practice expense in facility setting" max={breakdownMax} tone="teal" />
                <RvuBar label="Malpractice RVU" value={rvuData.malpracticeRvu} description="Professional liability component" max={breakdownMax} tone="amber" />
              </div>

              <div className="tool-callout compact" data-tone="info">
                <Info size={15} />
                Payment equals total RVU times the conversion factor. Geographic adjustments are not applied in this view.
              </div>
            </section>
          </motion.div>
        ) : (
          <section className="tool-panel">
            <div className="tool-empty-state">
              <Calculator size={30} />
              <strong>Enter a CPT code to calculate RVUs</strong>
              <span>Payment, component RVUs, global period, and status will appear after lookup.</span>
            </div>
          </section>
        )}
      </AnimatePresence>
    </div>
  );
}

function DollarIcon() {
  return <span className="calculator-dollar-icon">$</span>;
}
