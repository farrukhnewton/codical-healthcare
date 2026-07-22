import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  CheckCircle2,
  DatabaseZap,
  ExternalLink,
  Filter,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoHint } from "@/components/ui/info-hint";
import { Input } from "@/components/ui/input";

type CrosswalkDirection = "icd-to-cpt" | "cpt-to-icd";
type CoverageStatus = "covered" | "noncovered" | "mixed" | "unknown";
type StatusFilter = "all" | CoverageStatus;

type CrosswalkEvidence = {
  displayId: string;
  articleId: string;
  articleVersion: string;
  title: string;
  groupNumber: string;
  status: CoverageStatus;
  effectiveDate: string | null;
  endDate: string | null;
  relatedLcd: Array<Record<string, string>>;
  relatedNcd: Array<Record<string, string>>;
};

type CrosswalkResultItem = {
  code: string;
  normalizedCode: string;
  description: string;
  status: CoverageStatus;
  evidenceCount: number;
  coveredEvidenceCount: number;
  noncoveredEvidenceCount: number;
  articleCount: number;
  confidenceScore: number;
  evidence: CrosswalkEvidence[];
};

type CrosswalkLookupResult = {
  source: string;
  indexVersion: string | null;
  generatedAt: string | null;
  direction: CrosswalkDirection;
  code: string;
  normalizedCode: string;
  resultCount: number;
  totalIndexedCount: number;
  storedResultCount: number;
  filteredCount: number;
  returnedCount: number;
  resultsCapped: boolean;
  coveredCount: number;
  noncoveredCount: number;
  mixedCount: number;
  statusFilter: CoverageStatus | null;
  activeLetter: string;
  availableLetters: string[];
  alphabet: Array<{ letter: string; count: number }>;
  description: string;
  results: CrosswalkResultItem[];
  note: string;
};

const DIRECTION_COPY: Record<CrosswalkDirection, { label: string; source: string; target: string; example: string }> = {
  "cpt-to-icd": {
    label: "CPT/HCPCS to ICD-10",
    source: "CPT/HCPCS procedure",
    target: "ICD-10-CM diagnosis candidates",
    example: "88305",
  },
  "icd-to-cpt": {
    label: "ICD-10 to CPT/HCPCS",
    source: "ICD-10-CM diagnosis",
    target: "CPT/HCPCS procedure candidates",
    example: "M17.0",
  },
};

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: "all", label: "All evidence" },
  { id: "covered", label: "Covered" },
  { id: "noncovered", label: "Noncovered" },
  { id: "mixed", label: "Mixed" },
];

function getCmsArticleUrl(evidence: CrosswalkEvidence) {
  const articleId = (evidence.displayId || evidence.articleId || "").replace(/^[A-Z]/i, "");
  return `https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleid=${encodeURIComponent(articleId)}${
    evidence.articleVersion ? `&ver=${encodeURIComponent(evidence.articleVersion)}` : ""
  }`;
}

function statusStyle(status: CoverageStatus) {
  if (status === "covered") {
    return {
      label: "Covered evidence",
      className: "is-covered",
      badge: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    };
  }
  if (status === "noncovered") {
    return {
      label: "Noncovered evidence",
      className: "is-noncovered",
      badge: "bg-rose-500/10 text-rose-700 border-rose-500/20",
    };
  }
  if (status === "mixed") {
    return {
      label: "Mixed evidence",
      className: "is-mixed",
      badge: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    };
  }
  return {
    label: "Evidence found",
    className: "is-unknown",
    badge: "bg-slate-500/10 text-slate-700 border-slate-500/20",
  };
}

export function CoverageCrosswalk() {
  const [direction, setDirection] = useState<CrosswalkDirection>("cpt-to-icd");
  const [code, setCode] = useState(DIRECTION_COPY["cpt-to-icd"].example);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [activeLetter, setActiveLetter] = useState("");
  const [result, setResult] = useState<CrosswalkLookupResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const copy = DIRECTION_COPY[direction];
  const normalizedCode = code.trim().toUpperCase();
  const leadResult = result?.results?.[0] || null;
  const leadEvidence = leadResult?.evidence?.[0] || null;

  const alphabet = useMemo(() => result?.alphabet || [], [result]);

  async function runLookup(overrides: {
    direction?: CrosswalkDirection;
    code?: string;
    statusFilter?: StatusFilter;
    letter?: string;
  } = {}) {
    const nextDirection = overrides.direction || direction;
    const nextCode = (overrides.code ?? normalizedCode).trim().toUpperCase();
    const nextStatus = overrides.statusFilter || statusFilter;
    const nextLetter = overrides.letter ?? activeLetter;

    if (!nextCode) return;

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        direction: nextDirection,
        code: nextCode,
        limit: "60",
      });
      if (nextDirection === "cpt-to-icd" && nextLetter) params.set("letter", nextLetter);
      if (nextStatus !== "all") params.set("status", nextStatus);

      const response = await fetch(`/api/coverage/crosswalk?${params.toString()}`, {
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Crosswalk lookup failed");

      setDirection(nextDirection);
      setCode(nextCode);
      setStatusFilter(nextStatus);
      setActiveLetter(data.activeLetter || "");
      setResult(data);
    } catch (err: any) {
      setResult(null);
      setError(err?.message || "Crosswalk lookup failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void runLookup({
      direction: "cpt-to-icd",
      code: DIRECTION_COPY["cpt-to-icd"].example,
      statusFilter: "all",
      letter: "",
    });
    // Initial load only. runLookup intentionally reads current state for user actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeDirection(nextDirection: CrosswalkDirection) {
    const nextCode = DIRECTION_COPY[nextDirection].example;
    setDirection(nextDirection);
    setCode(nextCode);
    setActiveLetter("");
    setResult(null);
    setError("");
    void runLookup({ direction: nextDirection, code: nextCode, letter: "", statusFilter });
  }

  function changeStatus(nextStatus: StatusFilter) {
    setStatusFilter(nextStatus);
    setActiveLetter("");
    void runLookup({ statusFilter: nextStatus, letter: "" });
  }

  function chooseLetter(letter: string) {
    setActiveLetter(letter);
    void runLookup({ letter });
  }

  return (
    <div className="crosswalk-page tool-page">
      <section className="crosswalk-page-hero">
        <div className="crosswalk-hero-orb" aria-hidden="true" />
        <div className="crosswalk-hero-copy">
          <Badge variant="outline" className="crosswalk-source-badge">
            <DatabaseZap size={13} />
            CMS MCD article-group intelligence
          </Badge>
          <h1>ICD/CPT crosswalk built for coverage review.</h1>
          <p>
            Search either direction, filter coverage evidence, and use the alphabet rail for CPT/HCPCS-to-ICD review.
          </p>
        </div>
      </section>

      <section className="crosswalk-control-panel appGlass appCard">
        <div className="crosswalk-direction-tabs" role="tablist" aria-label="Crosswalk direction">
          {(Object.keys(DIRECTION_COPY) as CrosswalkDirection[]).map((item) => (
            <button
              key={item}
              type="button"
              className={direction === item ? "is-active" : ""}
              onClick={() => changeDirection(item)}
            >
              <ArrowLeftRight size={15} />
              {DIRECTION_COPY[item].label}
            </button>
          ))}
        </div>

        <div className="crosswalk-search-row">
          <label>
            <span>{copy.source}</span>
            <div>
              <Search size={17} />
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                onKeyDown={(event) => event.key === "Enter" && runLookup({ letter: "" })}
                placeholder={copy.example}
              />
            </div>
          </label>
          <Button type="button" onClick={() => runLookup({ letter: "" })} disabled={loading || !normalizedCode} className="crosswalk-run-button">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Run crosswalk
          </Button>
        </div>

        <div className="crosswalk-filter-row" aria-label="Coverage status filter">
          <span><Filter size={13} /> Evidence status</span>
          {STATUS_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={statusFilter === item.id ? "is-active" : ""}
              onClick={() => changeStatus(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {direction === "cpt-to-icd" && result && (
          <div className="crosswalk-alphabet-panel" aria-label="Available ICD-10 initial letters">
            <div className="crosswalk-alphabet-head">
              <strong>
                ICD-10 letter index
                <InfoHint label="Only letters present in the indexed evidence are shown." />
              </strong>
            </div>
            <div className="crosswalk-alphabet-rail">
              <button type="button" className={!activeLetter ? "is-active" : ""} onClick={() => chooseLetter("")}>
                All
              </button>
              {alphabet.map((item) => (
                <button
                  key={item.letter}
                  type="button"
                  className={activeLetter === item.letter ? "is-active" : ""}
                  onClick={() => chooseLetter(item.letter)}
                >
                  {item.letter}
                  <span>{item.count}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {error && (
        <div className="crosswalk-error">
          {error}
        </div>
      )}

      {result && (
        <section className="crosswalk-results-layout">
          <div className="crosswalk-results-main">
            <div className="crosswalk-context-card appGlass appCard">
              <div>
                <span>{copy.source}</span>
                <strong>{result.code}</strong>
                {result.description && <p>{result.description}</p>}
              </div>
              <div>
                <span>{copy.target}</span>
                <strong>{result.filteredCount.toLocaleString()}</strong>
                <p>{result.returnedCount.toLocaleString()} shown from indexed evidence</p>
              </div>
            </div>

            {result.results.length === 0 ? (
              <div className="crosswalk-empty appGlass appCard">
                <ArrowLeftRight size={34} />
                <strong>No evidence found for this filter.</strong>
                <p>Try all evidence, another initial letter, or a different CPT/HCPCS or ICD-10-CM code.</p>
              </div>
            ) : (
              <div className="crosswalk-card-list">
                {result.results.map((item) => {
                  const style = statusStyle(item.status);
                  const evidence = item.evidence[0];
                  return (
                    <article key={`${item.normalizedCode}-${item.status}`} className={`crosswalk-code-card appGlass appCard ${style.className}`}>
                      <div className="crosswalk-code-main">
                        <div className="crosswalk-code-title">
                          <strong>{item.code}</strong>
                          <Badge variant="outline" className={style.badge}>{style.label}</Badge>
                          <Badge variant="outline" className="crosswalk-confidence">
                            {(item.confidenceScore * 100).toFixed(0)}% confidence
                          </Badge>
                        </div>
                        {item.description && <p>{item.description}</p>}
                        <div className="crosswalk-code-meta">
                          <span>{item.evidenceCount} evidence row{item.evidenceCount === 1 ? "" : "s"}</span>
                          <span>{item.articleCount} article{item.articleCount === 1 ? "" : "s"}</span>
                          <span>{item.coveredEvidenceCount} covered</span>
                          <span>{item.noncoveredEvidenceCount} noncovered</span>
                        </div>
                        {evidence && (
                          <div className="crosswalk-evidence-strip">
                            <span>{evidence.displayId}</span>
                            <span>Group {evidence.groupNumber}</span>
                            <p>{evidence.title}</p>
                          </div>
                        )}
                      </div>
                      {evidence && (
                        <Button asChild variant="outline" size="sm" className="crosswalk-source-link">
                          <a href={getCmsArticleUrl(evidence)} target="_blank" rel="noreferrer noopener">
                            <ExternalLink size={13} />
                            CMS source
                          </a>
                        </Button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <aside className="crosswalk-side-panel appGlass appCard">
            <div className="crosswalk-side-header">
              <span>
                <CheckCircle2 size={15} />
                Evidence posture
                <InfoHint label="Coverage-derived intelligence from CMS article same-group relationships. Final decisions still require source-document review and payer-specific policy checks." />
              </span>
              <strong>{leadEvidence?.displayId || "Ready"}</strong>
              <p>{leadEvidence?.title || result.note}</p>
            </div>
            <div className="crosswalk-side-metrics">
              <div>
                <span>Total indexed</span>
                <strong>{result.resultCount.toLocaleString()}</strong>
              </div>
              <div>
                <span>Covered</span>
                <strong>{result.coveredCount.toLocaleString()}</strong>
              </div>
              <div>
                <span>Noncovered</span>
                <strong>{result.noncoveredCount.toLocaleString()}</strong>
              </div>
            </div>
            {result.resultsCapped && (
              <p className="crosswalk-disclaimer">
                Results capped.
                <InfoHint label="This high-volume code has more indexed candidates than the response carries. Use the alphabet rail and status filters to narrow review." />
              </p>
            )}
            {leadEvidence && (
              <Button asChild className="crosswalk-side-action">
                <a href={getCmsArticleUrl(leadEvidence)} target="_blank" rel="noreferrer noopener">
                  <ExternalLink size={14} />
                  Open strongest source
                </a>
              </Button>
            )}
          </aside>
        </section>
      )}
    </div>
  );
}

export default CoverageCrosswalk;
