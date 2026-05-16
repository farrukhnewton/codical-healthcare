import { useMemo, useState } from "react";
import { MedicalCode } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import {
  BookmarkCheck,
  BookmarkPlus,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileWarning,
  Info,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddFavorite, useRemoveFavorite, useFavorites } from "@/hooks/use-favorites";
import { useCode } from "@/hooks/use-codes";
import { ErrorState } from "../ui/ErrorState";

interface CodeDetailsProps {
  codeItem: MedicalCode;
}

interface RegulatoryGuideline {
  id: string;
  chapter: number;
  chapterTitle: string;
  section: string;
  title: string;
  content: string;
  codeRangeStart: string;
  codeRangeEnd: string;
  type: string;
  sourceUrl: string;
  tags: string[];
}

interface CodeGuidelinesResponse {
  guidelines: RegulatoryGuideline[];
  nlmInfo?: {
    code: string;
    description: string;
    source: string;
  } | null;
}

interface Icd10NotesResponse {
  code: string;
  description: string | null;
  parentCode: string | null;
  chapterName: string | null;
  chapterDesc: string | null;
  sectionId: string | null;
  sectionDesc: string | null;
  includes: string[];
  inclusionTerms: string[];
  excludes1: string[];
  excludes2: string[];
  codeFirst: string[];
  useAdditionalCode: string[];
  codeAlso: string[];
  sevenChrNote: string | null;
  sevenChrDef: Array<{ char: string; meaning: string }>;
}

function trimText(value: unknown, fallback = "No description available") {
  const text = String(value || "").replace(/^\"|\"$/g, "").trim();
  return text || fallback;
}

function shortContent(content: string) {
  return content.replace(/\s+/g, " ").trim().slice(0, 340);
}

function DetailStat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="code-detail-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

function NoteList({ label, items, tone = "neutral" }: { label: string; items?: string[]; tone?: string }) {
  if (!items?.length) return null;

  return (
    <div className="code-note-card" data-tone={tone}>
      <strong>{label}</strong>
      <ul>
        {items.slice(0, 6).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function CodeDetails({ codeItem }: CodeDetailsProps) {
  const [copied, setCopied] = useState(false);
  const { data: details, isLoading, isError, refetch } = useCode(codeItem.type, codeItem.code);

  const { data: intel } = useQuery({
    queryKey: ["/api/intel", codeItem.code],
    queryFn: async () => {
      const res = await fetch("/api/intel/" + encodeURIComponent(codeItem.code));
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!codeItem.code,
  });

  const { data: codeGuidelines } = useQuery<CodeGuidelinesResponse>({
    queryKey: ["/api/guidelines/code", codeItem.code],
    queryFn: async () => {
      const res = await fetch("/api/guidelines/code/" + encodeURIComponent(codeItem.code));
      if (!res.ok) return { guidelines: [], nlmInfo: null };
      return res.json();
    },
    enabled: !!codeItem.code,
    staleTime: 1000 * 60 * 10,
  });

  const resolvedCode = details?.code || codeItem.code;
  const resolvedType = details?.type || codeItem.type;

  const { data: icd10Notes } = useQuery<Icd10NotesResponse | null>({
    queryKey: ["/api/icd10-notes", resolvedCode],
    queryFn: async () => {
      const res = await fetch("/api/icd10-notes/" + encodeURIComponent(resolvedCode));
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!resolvedCode && resolvedType === "ICD-10-CM",
    staleTime: 1000 * 60 * 10,
  });

  const { data: favorites } = useFavorites();
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();

  const activeCode = details || codeItem;
  const cmsGuidelines = codeGuidelines?.guidelines || [];
  const favoriteRecord = favorites?.find((favorite: any) => favorite.code === activeCode.code && favorite.codeType === activeCode.type);
  const isFavorited = !!favoriteRecord;
  const rvu = intel?.rvu;

  const contextRows = useMemo(() => {
    const rows = [
      activeCode.category ? ["Classification", activeCode.category] : null,
      activeCode.procedureDetails ? ["Procedure detail", activeCode.procedureDetails] : null,
      codeGuidelines?.nlmInfo ? ["Clinical table", `${codeGuidelines.nlmInfo.code} - ${codeGuidelines.nlmInfo.source}`] : null,
      cmsGuidelines.length ? ["Guidance matches", `${cmsGuidelines.length} CMS section${cmsGuidelines.length === 1 ? "" : "s"}`] : null,
    ];

    return rows.filter(Boolean) as string[][];
  }, [activeCode.category, activeCode.procedureDetails, codeGuidelines?.nlmInfo, cmsGuidelines.length]);

  const toggleFavorite = () => {
    if (isFavorited && favoriteRecord) {
      removeFavorite.mutate(favoriteRecord.id);
      return;
    }

    addFavorite.mutate({
      codeType: activeCode.type,
      code: activeCode.code,
      description: activeCode.description,
    });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(activeCode.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (isLoading) {
    return (
      <div className="code-detail-surface">
        <div className="tool-panel code-detail-loading">
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-12 w-48 rounded-md" />
          <Skeleton className="h-24 w-full rounded-md" />
          <Skeleton className="h-40 w-full rounded-md" />
        </div>
      </div>
    );
  }

  if (isError) {
    return <ErrorState message={`Failed to load details for ${codeItem.code}.`} onRetry={() => refetch()} />;
  }

  return (
    <div className="code-detail-surface">
      <section className="tool-panel code-detail-hero">
        <div className="code-detail-title-row">
          <div>
            <span className="tool-code-chip" data-type={activeCode.type}>{activeCode.type}</span>
            <h2>{activeCode.code}</h2>
          </div>

          <div className="code-detail-actions">
            <button type="button" className="tool-icon-action" onClick={copyCode} aria-label="Copy code">
              {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
            </button>
            <button
              type="button"
              className="tool-icon-action"
              onClick={toggleFavorite}
              disabled={addFavorite.isPending || removeFavorite.isPending}
              aria-label={isFavorited ? "Remove favorite" : "Add favorite"}
            >
              {isFavorited ? <BookmarkCheck size={16} /> : <BookmarkPlus size={16} />}
            </button>
          </div>
        </div>

        <p>{trimText(activeCode.description)}</p>

        <div className="code-detail-status-row">
          <span><CheckCircle2 size={14} /> Active reference</span>
          {cmsGuidelines.length ? <span><ShieldCheck size={14} /> Guidance available</span> : null}
          {rvu ? <span><Info size={14} /> RVU data linked</span> : null}
        </div>
      </section>

      {rvu ? (
        <section className="code-detail-stat-grid">
          <DetailStat label="Work RVU" value={rvu.workRvu || "-"} sub="Current year" />
          <DetailStat label="Non-facility" value={`$${rvu.nonFacilityPayment || "-"}`} sub="Allowed amount" />
          <DetailStat label="Facility" value={`$${rvu.facilityPayment || "-"}`} sub="Allowed amount" />
          <DetailStat label="Global period" value={rvu.globalPeriod || "N/A"} sub="Surgery indicator" />
        </section>
      ) : null}

      {contextRows.length ? (
        <section className="tool-panel">
          <div className="tool-section-head">
            <div>
              <h2>Code context</h2>
              <p>Classification, source context, and procedure notes.</p>
            </div>
            <FileWarning size={17} />
          </div>

          <div className="code-detail-list">
            {contextRows.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {resolvedType === "ICD-10-CM" && icd10Notes ? (
        <section className="tool-panel">
          <div className="tool-section-head">
            <div>
              <h2>ICD-10 notes</h2>
              <p>Tabular notes for {activeCode.code}.</p>
            </div>
            <Info size={17} />
          </div>

          <div className="code-note-grid">
            <NoteList label="Excludes1" items={icd10Notes.excludes1} tone="danger" />
            <NoteList label="Excludes2" items={icd10Notes.excludes2} tone="warning" />
            <NoteList label="Code first" items={icd10Notes.codeFirst} tone="info" />
            <NoteList label="Use additional code" items={icd10Notes.useAdditionalCode} tone="success" />
            <NoteList label="Inclusion terms" items={icd10Notes.inclusionTerms} />
          </div>
        </section>
      ) : null}

      <section className="tool-panel">
        <div className="tool-section-head">
          <div>
            <h2>Guidelines</h2>
            <p>Code-specific CMS guidance and reference context.</p>
          </div>
          <ShieldCheck size={17} />
        </div>

        {cmsGuidelines.length ? (
          <div className="code-guideline-list">
            {cmsGuidelines.slice(0, 3).map((item, index) => (
              <article className="code-guideline-card" key={item.id}>
                <div>
                  <span>{index === 0 ? "Most relevant" : `Match ${index + 1}`}</span>
                  <strong>{item.title}</strong>
                  <small>Chapter {item.chapter} - {item.section} - {item.codeRangeStart}-{item.codeRangeEnd}</small>
                </div>
                <p>{shortContent(item.content)}{item.content.length > 340 ? "..." : ""}</p>
                {item.sourceUrl ? (
                  <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                    Source <ExternalLink size={13} />
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        ) : activeCode.guideline ? (
          <div className="code-guideline-card">
            <div>
              <span>Guideline</span>
              <strong>Version {activeCode.guideline.version || "current"}</strong>
              <small>{activeCode.guideline.date ? new Date(String(activeCode.guideline.date)).toLocaleDateString() : "Reference guidance"}</small>
            </div>
            <p>{activeCode.guideline.text}</p>
          </div>
        ) : (
          <div className="tool-empty-state compact">
            <Info size={28} />
            <strong>No specific guidance found</strong>
            <span>Standard coding review applies for this reference.</span>
          </div>
        )}
      </section>

      {(intel?.commonModifiers?.length || intel?.relatedDx?.length) ? (
        <section className="code-detail-grid">
          {intel?.commonModifiers?.length ? (
            <div className="tool-panel">
              <div className="tool-section-head">
                <div>
                  <h2>Common modifiers</h2>
                  <p>Frequently paired modifier context.</p>
                </div>
              </div>
              <div className="code-mini-list">
                {intel.commonModifiers.slice(0, 5).map((modifier: any) => (
                  <div key={modifier.code}>
                    <span className="tool-code-chip" data-type="HCPCS">{modifier.code}</span>
                    <strong>{modifier.description}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {intel?.relatedDx?.length ? (
            <div className="tool-panel">
              <div className="tool-section-head">
                <div>
                  <h2>Related diagnoses</h2>
                  <p>Common diagnosis pairings.</p>
                </div>
              </div>
              <div className="code-mini-list">
                {intel.relatedDx.slice(0, 5).map((dx: any) => (
                  <div key={dx.code}>
                    <span className="tool-code-chip" data-type="ICD-10-CM">{dx.code}</span>
                    <strong>{dx.description}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {cmsGuidelines.length > 3 ? (
        <Button className="tool-primary-button code-detail-more">
          View all {cmsGuidelines.length} matched guideline sections
        </Button>
      ) : null}
    </div>
  );
}
