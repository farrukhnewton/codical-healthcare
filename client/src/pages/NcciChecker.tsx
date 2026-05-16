import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Info,
  RotateCcw,
  Search,
  Shield,
  XCircle,
} from "lucide-react";

interface NcciResult {
  hasEdit: boolean;
  message: string;
  col1?: string;
  col2?: string;
  col1_code?: string;
  col2_code?: string;
  modifier_indicator?: string;
  effective_date?: string;
  deletion_date?: string;
  modifierAllowed?: boolean | string;
  source?: string;
}

interface NcciBatchPair extends NcciResult {
  inputCol1: string;
  inputCol2: string;
  type: "practitioner" | "outpatient";
  rationale?: string | null;
}

interface NcciBatchResult {
  source: string;
  type: "practitioner" | "outpatient";
  codes: string[];
  pairCount: number;
  counts: {
    edits: number;
    modifierAllowed: number;
    modifierNotAllowed: number;
    noEdit: number;
  };
  pairs: NcciBatchPair[];
}

const EXAMPLE_PAIRS = [
  { col1: "99213", col2: "93000", label: "E/M + EKG" },
  { col1: "45378", col2: "45380", label: "Colonoscopy pair" },
  { col1: "27447", col2: "27370", label: "Knee replacement" },
  { col1: "99213", col2: "99214", label: "Duplicate E/M" },
];

const BATCH_EXAMPLE = "99213 99214 93000";

function splitCodes(value: string) {
  const seen = new Set<string>();
  const codes: string[] = [];

  for (const item of value.split(/[\s,;]+/)) {
    const code = item.trim().toUpperCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
    if (codes.length >= 8) break;
  }

  return codes;
}

function isModifierAllowed(result: NcciResult) {
  return result.modifierAllowed === true || result.modifierAllowed === "1" || result.modifier_indicator === "1";
}

function getStatusTone(result: NcciResult) {
  if (!result.hasEdit) return "success";
  return isModifierAllowed(result) ? "warning" : "danger";
}

function getStatusLabel(result: NcciResult) {
  if (!result.hasEdit) return "No edit";
  return isModifierAllowed(result) ? "Edit, modifier allowed" : "Edit, modifier not allowed";
}

function CodeChip({ children }: { children: ReactNode }) {
  return <span className="tool-code-chip" data-type="CPT">{children}</span>;
}

function MetricCard({ label, value, tone = "neutral" }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="tool-metric-card" data-tone={tone}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function StatusPill({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className="tool-status-pill" data-tone={tone}>{children}</span>;
}

export function NcciChecker() {
  const [col1, setCol1] = useState("");
  const [col2, setCol2] = useState("");
  const [type, setType] = useState<"practitioner" | "outpatient">("practitioner");
  const [result, setResult] = useState<NcciResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [batchCodes, setBatchCodes] = useState("");
  const [batchResult, setBatchResult] = useState<NcciBatchResult | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState("");

  const parsedBatchCodes = useMemo(() => splitCodes(batchCodes), [batchCodes]);
  const batchPairCount = parsedBatchCodes.length > 1 ? (parsedBatchCodes.length * (parsedBatchCodes.length - 1)) / 2 : 0;

  const check = async () => {
    if (!col1.trim() || !col2.trim()) return;
    setLoading(true);
    setResult(null);
    setError("");

    try {
      const params = new URLSearchParams({
        col1: col1.trim().toUpperCase(),
        col2: col2.trim().toUpperCase(),
        type,
      });
      const res = await fetch(`/api/ncci/check?${params}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) setError(data.message || "Check failed");
      else setResult(data);
    } catch {
      setError("Network error. Please try again.");
    }

    setLoading(false);
  };

  const reset = () => {
    setCol1("");
    setCol2("");
    setResult(null);
    setError("");
  };

  const loadExample = (pair: typeof EXAMPLE_PAIRS[number]) => {
    setCol1(pair.col1);
    setCol2(pair.col2);
    setResult(null);
    setError("");
  };

  const checkBatch = async () => {
    if (parsedBatchCodes.length < 2) return;
    setBatchLoading(true);
    setBatchResult(null);
    setBatchError("");

    try {
      const res = await fetch("/api/ncci/batch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes: parsedBatchCodes, type }),
      });
      const data = await res.json();
      if (!res.ok) setBatchError(data.message || "Batch check failed");
      else setBatchResult(data);
    } catch {
      setBatchError("Network error. Please try again.");
    }

    setBatchLoading(false);
  };

  const resetBatch = () => {
    setBatchCodes("");
    setBatchResult(null);
    setBatchError("");
  };

  const loadBatchExample = () => {
    setBatchCodes(BATCH_EXAMPLE);
    setBatchResult(null);
    setBatchError("");
  };

  const resultCol1 = result?.col1_code || result?.col1 || col1;
  const resultCol2 = result?.col2_code || result?.col2 || col2;

  return (
    <div className="tool-page validation-tool-page ncci-page">
      <section className="tool-panel tool-page-header">
        <div>
          <h1>NCCI Checker</h1>
          <p>Check procedure pairs and batch CPT/HCPCS sets for correct coding edits.</p>
        </div>
        <div className="search-header-meta">
          <span>Practitioner</span>
          <span>Outpatient</span>
        </div>
      </section>

      <div className="validation-workbench">
        <section className="tool-panel validation-input-panel">
          <div className="tool-section-head">
            <div>
              <h2>Procedure pair</h2>
              <p>Enter the ordered code pair for a single edit lookup.</p>
            </div>
            <Shield size={17} />
          </div>

          <div className="ncci-pair-grid">
            <label className="tool-field">
              <span>Column 1 code</span>
              <input
                className="tool-input tool-code-input"
                value={col1}
                onChange={(event) => setCol1(event.target.value.toUpperCase())}
                onKeyDown={(event) => event.key === "Enter" && check()}
                placeholder="99213"
                maxLength={5}
              />
            </label>

            <div className="tool-pair-arrow" aria-hidden="true">
              <ArrowRight size={18} />
              <small>vs</small>
            </div>

            <label className="tool-field">
              <span>Column 2 code</span>
              <input
                className="tool-input tool-code-input"
                value={col2}
                onChange={(event) => setCol2(event.target.value.toUpperCase())}
                onKeyDown={(event) => event.key === "Enter" && check()}
                placeholder="93000"
                maxLength={5}
              />
            </label>
          </div>

          <div className="tool-segmented-control validation-segmented">
            {(["practitioner", "outpatient"] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={type === option ? "is-active" : ""}
                onClick={() => setType(option)}
              >
                {option === "practitioner" ? "Practitioner" : "Outpatient"}
              </button>
            ))}
          </div>

          <div className="tool-action-row">
            <motion.button
              type="button"
              onClick={check}
              disabled={loading || !col1.trim() || !col2.trim()}
              whileHover={{ y: col1.trim() && col2.trim() ? -1 : 0 }}
              className="tool-primary-button"
            >
              {loading ? <span className="tool-spinner" /> : <Search size={16} />}
              {loading ? "Checking" : "Check pair"}
            </motion.button>
            {(col1 || col2 || result) && (
              <button className="tool-secondary-button icon-only" onClick={reset} type="button" aria-label="Clear pair">
                <RotateCcw size={16} />
              </button>
            )}
          </div>

          <div className="tool-example-strip">
            <span>Examples</span>
            {EXAMPLE_PAIRS.map((pair) => (
              <button key={`${pair.col1}-${pair.col2}`} type="button" onClick={() => loadExample(pair)}>
                <CodeChip>{pair.col1}</CodeChip>
                <small>+</small>
                <CodeChip>{pair.col2}</CodeChip>
                <em>{pair.label}</em>
              </button>
            ))}
          </div>
        </section>

        <section className="tool-panel validation-input-panel">
          <div className="tool-section-head">
            <div>
              <h2>Batch procedure set</h2>
              <p>Enter up to eight codes. Every unique pair is checked.</p>
            </div>
            <ClipboardList size={17} />
          </div>

          <label className="tool-field">
            <span>Procedure codes</span>
            <textarea
              className="tool-textarea tool-code-textarea"
              value={batchCodes}
              onChange={(event) => setBatchCodes(event.target.value.toUpperCase())}
              placeholder="99213 99214 93000"
            />
          </label>

          <div className="tool-metric-grid four">
            <MetricCard label="Codes" value={parsedBatchCodes.length} />
            <MetricCard label="Pairs" value={batchPairCount} />
            <MetricCard label="Type" value={type === "practitioner" ? "P" : "O"} />
            <MetricCard label="Limit" value="8" />
          </div>

          <div className="tool-action-row">
            <button className="tool-secondary-button" type="button" onClick={loadBatchExample}>
              Load example
            </button>
            {(batchCodes || batchResult) && (
              <button className="tool-secondary-button" type="button" onClick={resetBatch}>
                <RotateCcw size={15} /> Clear
              </button>
            )}
            <motion.button
              type="button"
              onClick={checkBatch}
              disabled={batchLoading || parsedBatchCodes.length < 2}
              whileHover={{ y: parsedBatchCodes.length > 1 ? -1 : 0 }}
              className="tool-primary-button"
            >
              {batchLoading ? <span className="tool-spinner" /> : <Search size={15} />}
              {batchLoading ? "Checking" : "Check all pairs"}
            </motion.button>
          </div>
        </section>
      </div>

      {error && (
        <div className="tool-callout" data-tone="danger">
          <AlertTriangle size={17} /> {error}
        </div>
      )}

      {batchError && (
        <div className="tool-callout" data-tone="danger">
          <AlertTriangle size={17} /> {batchError}
        </div>
      )}

      <section className="tool-panel validation-results-panel">
        <div className="tool-section-head">
          <div>
            <h2>Results</h2>
            <p>Single-pair status and batch edit summary.</p>
          </div>
          <Info size={17} />
        </div>

        {!result && !batchResult && (
          <div className="tool-empty-state compact">
            <Shield size={28} />
            <strong>Run a pair or batch check</strong>
            <span>Validated edit status will appear here with modifier guidance and effective dates.</span>
          </div>
        )}

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="validation-result-card"
              data-tone={getStatusTone(result)}
            >
              <div className="validation-result-icon">
                {result.hasEdit ? <XCircle size={24} /> : <CheckCircle2 size={24} />}
              </div>
              <div>
                <div className="validation-code-line">
                  <CodeChip>{resultCol1}</CodeChip>
                  <ArrowRight size={16} />
                  <CodeChip>{resultCol2}</CodeChip>
                  <StatusPill tone={getStatusTone(result)}>{getStatusLabel(result)}</StatusPill>
                </div>
                <p>{result.message}</p>
                {result.hasEdit && isModifierAllowed(result) && (
                  <div className="tool-callout compact" data-tone="warning">
                    <Info size={15} /> A modifier may bypass this edit when documentation supports distinct services.
                  </div>
                )}
                {result.effective_date && (
                  <small>
                    Effective {result.effective_date}
                    {result.deletion_date && result.deletion_date !== "20991231" ? ` | Deleted ${result.deletion_date}` : ""}
                  </small>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {batchResult && (
          <div className="batch-result-block">
            <div className="tool-metric-grid four">
              <MetricCard label="Edits" value={batchResult.counts.edits} tone="danger" />
              <MetricCard label="Modifier OK" value={batchResult.counts.modifierAllowed} tone="warning" />
              <MetricCard label="No modifier" value={batchResult.counts.modifierNotAllowed} tone="danger" />
              <MetricCard label="No edit" value={batchResult.counts.noEdit} tone="success" />
            </div>

            <div className="tool-result-list">
              {batchResult.pairs.map((pair) => {
                const tone = getStatusTone(pair);
                return (
                  <div className="tool-result-row" data-tone={tone} key={`${pair.inputCol1}-${pair.inputCol2}`}>
                    <div className="validation-code-line">
                      <CodeChip>{pair.inputCol1}</CodeChip>
                      <ArrowRight size={14} />
                      <CodeChip>{pair.inputCol2}</CodeChip>
                      <StatusPill tone={tone}>{getStatusLabel(pair)}</StatusPill>
                    </div>
                    <p>
                      {pair.message}
                      {pair.rationale ? ` ${pair.rationale}` : ""}
                    </p>
                    {pair.effective_date && <small>Effective {pair.effective_date}</small>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
