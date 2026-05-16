import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Clock,
  MapPin,
  Search,
  Tag,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Locality {
  id: number;
  Contractor: string;
  Locality: string;
  "Locality Name": string;
  "2026 Work GPCI": string;
  "2026 PE GPCI": string;
  "2026 MP GPCI": string;
  non_qualifying_cf: string;
  qualifying_cf: string;
}

interface BaseUnitResult {
  cpt: string;
  description: string;
  baseUnits: number;
}

interface AnesthesiaModifier {
  id: number;
  Modifier: string;
  Description: string;
  REQUIRED: string;
  "PAYMENT ADJUSTMENT": string;
}

const QUICK_CODES = [
  { code: "00100", label: "Head / salivary" },
  { code: "00400", label: "Extremities" },
  { code: "00700", label: "Abdomen" },
  { code: "00800", label: "Lower abdomen" },
  { code: "01200", label: "Hip" },
  { code: "01400", label: "Knee" },
  { code: "01610", label: "Shoulder" },
  { code: "00840", label: "Intraperitoneal" },
];

function MetricCard({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="tool-metric-card" data-tone={tone}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function AnesthesiaCalculator() {
  const [code, setCode] = useState("");
  const [minutes, setMinutes] = useState("");
  const [selectedLocality, setSelectedLocality] = useState("");
  const [qualifyingAnesthesia, setQualifyingAnesthesia] = useState(false);
  const [selectedModifier, setSelectedModifier] = useState("");
  const [baseUnitInfo, setBaseUnitInfo] = useState<BaseUnitResult | null>(null);
  const [baseUnitLoading, setBaseUnitLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: localities } = useQuery<Locality[]>({
    queryKey: ["/api/anesthesia/localities"],
    queryFn: async () => {
      const res = await fetch("/api/anesthesia/localities", { credentials: "include" });
      return res.json();
    },
  });

  const { data: modifiers } = useQuery<AnesthesiaModifier[]>({
    queryKey: ["/api/anesthesia/modifiers"],
    queryFn: async () => {
      const res = await fetch("/api/anesthesia/modifiers", { credentials: "include" });
      return res.json();
    },
  });

  useEffect(() => {
    if (code.length < 4) {
      setBaseUnitInfo(null);
      return;
    }

    const controller = new AbortController();
    setBaseUnitLoading(true);
    fetch(`/api/anesthesia/baseunits/${code.trim()}`, { credentials: "include", signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.baseUnits) setBaseUnitInfo(data);
        else setBaseUnitInfo(null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setBaseUnitInfo(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBaseUnitLoading(false);
      });

    return () => controller.abort();
  }, [code]);

  const selectedModifierData = modifiers?.find((modifier) => modifier.Modifier === selectedModifier);
  const timeUnits = minutes ? Math.round(Number(minutes) / 15) : 0;
  const canCalculate = Boolean(baseUnitInfo && minutes && selectedLocality);

  const getModifierMultiplier = () => {
    if (!selectedModifierData) return 1;
    const adjustment = selectedModifierData["PAYMENT ADJUSTMENT"];
    if (adjustment === "100%") return 1;
    if (adjustment === "50%") return 0.5;
    return 1;
  };

  const calculate = async () => {
    if (!baseUnitInfo || !minutes || !selectedLocality) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(
        `/api/anesthesia/calculate?locality=${encodeURIComponent(selectedLocality)}&baseUnits=${baseUnitInfo.baseUnits}&timeUnits=${timeUnits}&qualifying=${qualifyingAnesthesia}`,
        { credentials: "include" },
      );
      const data = await res.json();
      if (!res.ok) setError(data.message || "Calculation failed");
      else setResult({ ...data, timeUnits, modifier: selectedModifierData, modifierMultiplier: getModifierMultiplier() });
    } catch {
      setError("Network error. Please try again.");
    }

    setLoading(false);
  };

  const selectedPayment = result
    ? (result.totalUnits * (qualifyingAnesthesia ? result.qualifyingCf : result.nonQualifyingCf) * result.modifierMultiplier).toFixed(2)
    : "0.00";

  return (
    <div className="tool-page validation-tool-page anesthesia-page">
      <section className="tool-panel tool-page-header">
        <div>
          <h1>Anesthesia Calculator</h1>
          <p>Calculate anesthesia payment from base units, time units, locality, and modifier policy.</p>
        </div>
        <div className="search-header-meta">
          <span>CY 2026</span>
          <span>Base units</span>
          <span>109 localities</span>
        </div>
      </section>

      <div className="calculator-workbench anesthesia-workbench">
        <section className="tool-panel validation-input-panel">
          <div className="tool-section-head">
            <div>
              <h2>Calculation parameters</h2>
              <p>Enter the anesthesia code, time, locality, and optional modifier.</p>
            </div>
            <Activity size={17} />
          </div>

          <label className="tool-field">
            <span>Anesthesia CPT code</span>
            <div className="tool-input-with-status">
              <input
                className="tool-input tool-code-input"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 5))}
                placeholder="00100"
              />
              {baseUnitLoading ? <span className="tool-spinner dark" /> : baseUnitInfo ? <CheckCircle2 size={17} /> : <Search size={17} />}
            </div>
          </label>

          {baseUnitInfo && (
            <div className="tool-callout compact" data-tone="info">
              <CheckCircle2 size={15} />
              <span>
                <strong>{baseUnitInfo.baseUnits} base units</strong> for {baseUnitInfo.description}
              </span>
            </div>
          )}

          <div className="tool-example-strip compact">
            <span>Common codes</span>
            {QUICK_CODES.map((quickCode) => (
              <button
                key={quickCode.code}
                type="button"
                className={code === quickCode.code ? "is-active" : ""}
                onClick={() => setCode(quickCode.code)}
              >
                <span className="tool-code-chip" data-type="CPT">{quickCode.code}</span>
                <em>{quickCode.label}</em>
              </button>
            ))}
          </div>

          <div className="tool-form-grid two">
            <label className="tool-field">
              <span>Anesthesia time</span>
              <div className="tool-input-with-icon">
                <Clock size={16} />
                <input
                  className="tool-input"
                  type="number"
                  value={minutes}
                  onChange={(event) => setMinutes(event.target.value)}
                  min="0"
                  max="600"
                  placeholder="90"
                />
              </div>
              {minutes && <small>{timeUnits} time units</small>}
            </label>

            <label className="tool-field">
              <span>Anesthesia modifier</span>
              <div className="tool-select-wrap">
                <Tag size={16} />
                <select className="tool-select" value={selectedModifier} onChange={(event) => setSelectedModifier(event.target.value)}>
                  <option value="">No modifier</option>
                  {modifiers?.map((modifier) => (
                    <option key={modifier.Modifier} value={modifier.Modifier}>
                      {modifier.Modifier} - {modifier.Description}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} />
              </div>
              {selectedModifierData && (
                <small>
                  Payment {selectedModifierData["PAYMENT ADJUSTMENT"]}; required {selectedModifierData.REQUIRED}
                </small>
              )}
            </label>
          </div>

          <label className="tool-field">
            <span>MAC locality</span>
            <div className="tool-select-wrap">
              <MapPin size={16} />
              <select className="tool-select" value={selectedLocality} onChange={(event) => setSelectedLocality(event.target.value)}>
                <option value="">Select locality</option>
                {localities?.map((locality, index) => (
                  <option key={`${locality.Locality}-${index}`} value={(locality.Locality || "").trim()}>
                    {locality["Locality Name"] || ""} - {(locality.Locality || "").trim()}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} />
            </div>
          </label>

          <button
            type="button"
            className="tool-toggle-row"
            data-active={qualifyingAnesthesia}
            onClick={() => setQualifyingAnesthesia((value) => !value)}
          >
            <span>
              <strong>Qualifying APM payment</strong>
              <small>Use the higher Advanced Alternative Payment Model conversion factor.</small>
            </span>
            <em />
          </button>

          <motion.button
            type="button"
            onClick={calculate}
            disabled={loading || !canCalculate}
            className="tool-primary-button full-width"
            whileHover={{ y: canCalculate ? -1 : 0 }}
          >
            {loading ? <span className="tool-spinner" /> : <Calculator size={17} />}
            {loading ? "Calculating" : !baseUnitInfo ? "Enter a CPT code first" : !selectedLocality ? "Select locality" : "Calculate payment"}
          </motion.button>
        </section>

        <section className="tool-panel calculator-summary-panel">
          <div className="tool-section-head">
            <div>
              <h2>Payment summary</h2>
              <p>Base units plus time units, adjusted by conversion factor and modifier.</p>
            </div>
            <Calculator size={17} />
          </div>

          {error && (
            <div className="tool-callout" data-tone="danger">
              <AlertCircle size={17} /> {error}
            </div>
          )}

          <AnimatePresence>
            {result ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="anesthesia-result-stack">
                <div className="calculator-payment-hero" data-tone={qualifyingAnesthesia ? "info" : "success"}>
                  <span>{qualifyingAnesthesia ? "Qualifying APM payment" : "Non-qualifying payment"}</span>
                  <strong>${selectedPayment}</strong>
                  <small>
                    {result.totalUnits} units x $
                    {(qualifyingAnesthesia ? result.qualifyingCf : result.nonQualifyingCf)?.toFixed(4)}
                    {result.modifier ? ` x ${result.modifier["PAYMENT ADJUSTMENT"]}` : ""}
                  </small>
                </div>

                <div className="tool-metric-grid three">
                  <MetricCard label="Base units" value={result.baseUnits} />
                  <MetricCard label="Time units" value={result.timeUnits} />
                  <MetricCard label="Total units" value={result.totalUnits} tone="info" />
                </div>

                <div className="payment-card-grid">
                  <div className="payment-option-card">
                    <span>Non-qualifying</span>
                    <strong>${(result.totalUnits * result.nonQualifyingCf * result.modifierMultiplier).toFixed(2)}</strong>
                    <small>CF ${result.nonQualifyingCf?.toFixed(4)}</small>
                  </div>
                  <div className="payment-option-card">
                    <span>Qualifying APM</span>
                    <strong>${(result.totalUnits * result.qualifyingCf * result.modifierMultiplier).toFixed(2)}</strong>
                    <small>CF ${result.qualifyingCf?.toFixed(4)}</small>
                  </div>
                </div>

                {result.modifier && (
                  <div className="tool-result-row">
                    <div className="validation-code-line">
                      <span className="tool-code-chip">{result.modifier.Modifier}</span>
                      <strong>{result.modifier.Description}</strong>
                    </div>
                    <p>Payment adjustment {result.modifier["PAYMENT ADJUSTMENT"]}; required {result.modifier.REQUIRED}.</p>
                  </div>
                )}

                <div className="tool-result-row">
                  <div className="validation-code-line">
                    <MapPin size={16} />
                    <strong>{result.localityName}</strong>
                  </div>
                  <div className="tool-metric-grid three compact">
                    <MetricCard label="Work GPCI" value={result.workGpci} />
                    <MetricCard label="PE GPCI" value={result.peGpci} />
                    <MetricCard label="MP GPCI" value={result.mpGpci} />
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="tool-empty-state compact">
                <Calculator size={28} />
                <strong>Complete the calculator inputs</strong>
                <span>Payment details and locality factors will appear after calculation.</span>
              </div>
            )}
          </AnimatePresence>
        </section>
      </div>

      {modifiers && !result && (
        <section className="tool-panel">
          <div className="tool-section-head">
            <div>
              <h2>Anesthesia modifiers</h2>
              <p>Payment adjustments available for the current calculator.</p>
            </div>
            <Tag size={17} />
          </div>

          <div className="modifier-reference-list">
            {modifiers.map((modifier) => (
              <div key={modifier.Modifier}>
                <span className="tool-code-chip">{modifier.Modifier}</span>
                <strong>{modifier.Description}</strong>
                <small>{modifier["PAYMENT ADJUSTMENT"]}</small>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
