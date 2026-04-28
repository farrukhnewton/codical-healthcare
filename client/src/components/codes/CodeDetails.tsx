import { MedicalCode } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookmarkCheck, BookmarkPlus, FileWarning, ExternalLink, Info } from "lucide-react";
import { useAddFavorite, useRemoveFavorite, useFavorites } from "@/hooks/use-favorites";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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

function renderGuidelineContent(content: string) {
  const blocks = content.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const nodes: any[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    if (/^\d+\)$/.test(block)) {
      const next = blocks[i + 1];
      nodes.push(
        <div key={"num-" + i} className="pt-2">
          <div className="inline-flex items-center justify-center min-w-9 h-9 px-3 rounded-xl bg-primary text-white text-sm font-black shadow-sm">
            {block}
          </div>
        </div>
      );

      if (next && !/^\(?[a-z]\)/i.test(next) && !/^\d+\)$/.test(next)) {
        nodes.push(
          <h4 key={"heading-" + i} className="text-lg font-black text-foreground mt-3">
            {next}
          </h4>
        );
        i += 1;
      }
      continue;
    }

    if (/^\([a-z]\)/i.test(block)) {
      nodes.push(
        <div key={"sub-" + i} className="text-[15px] text-muted-foreground leading-7 font-medium whitespace-pre-wrap">
          <span className="font-black text-foreground">{block.slice(0, 3)}</span>
          {block.slice(3)}
        </div>
      );
      continue;
    }

    const lines = block.split("\n").map((x) => x.trim()).filter(Boolean);

    if (lines.length >= 2 && lines[0].length > 0 && lines[0].length < 80 && !/^\(?[a-z]\)/i.test(lines[0])) {
      nodes.push(
        <div key={"split-" + i} className="space-y-3">
          <h4 className="text-lg font-black text-foreground">{lines[0]}</h4>
          <p className="text-[15px] text-muted-foreground leading-7 font-medium whitespace-pre-wrap">
            {lines.slice(1).join("\n")}
          </p>
        </div>
      );
      continue;
    }

    if (block.length < 90 && !block.includes(".") && !block.includes(":")) {
      nodes.push(
        <h4 key={"short-" + i} className="text-lg font-black text-foreground">
          {block}
        </h4>
      );
      continue;
    }

    nodes.push(
      <p key={"p-" + i} className="text-[15px] text-muted-foreground leading-7 font-medium whitespace-pre-wrap">
        {block}
      </p>
    );
  }

  return <div className="space-y-4">{nodes}</div>;
}

export function CodeDetails({ codeItem }: CodeDetailsProps) {
  const { data: details, isLoading, isError, refetch } = useCode(codeItem.type, codeItem.code);

  const { data: intel } = useQuery({
    queryKey: ['/api/intel', codeItem.code],
    queryFn: async () => {
      const res = await fetch('/api/intel/' + encodeURIComponent(codeItem.code));
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!codeItem.code,
  });

  const { data: codeGuidelines } = useQuery<CodeGuidelinesResponse>({
    queryKey: ['/api/guidelines/code', codeItem.code],
    queryFn: async () => {
      const res = await fetch('/api/guidelines/code/' + encodeURIComponent(codeItem.code));
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
  const noteCards = icd10Notes;

  const favoriteRecord = favorites?.find((f: any) => f.code === activeCode.code && f.codeType === activeCode.type);
  const isFavorited = !!favoriteRecord;

  const toggleFavorite = () => {
    if (isFavorited && favoriteRecord) {
      removeFavorite.mutate(favoriteRecord.id);
    } else {
      addFavorite.mutate({
        codeType: activeCode.type,
        code: activeCode.code,
        description: activeCode.description,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 h-full flex flex-col">
        <div className="flex justify-between items-start">
          <div className="space-y-3 w-2/3">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-10 w-48 rounded-md" />
          </div>
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="space-y-4 pt-6 mt-6 border-t border-border">
          <Skeleton className="h-8 w-40 rounded-md" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return <ErrorState message={`Failed to load details for ${codeItem.code}.`} onRetry={() => refetch()} />;
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-8 md:p-12 appGlassStrong appCard border-b border-border/60 shadow-sm shadow-black/10 z-10 sticky top-0">
        <div className="flex justify-between items-start gap-8">
          <div className="space-y-6 flex-1">
            <div className="flex flex-wrap items-center gap-4">
              <Badge variant="default" className="text-sm px-4 py-1.5 bg-primary shadow-lg shadow-primary/20 rounded-full font-bold">
                {activeCode.type}
              </Badge>
              {(activeCode.guideline || cmsGuidelines.length > 0) && (
                <Badge variant="outline" className="text-xs px-4 py-1.5 bg-secondary/10 text-secondary border-secondary/30 rounded-full font-bold animate-pulse">
                  <FileWarning className="w-3.5 h-3.5 mr-1.5" /> CMS Compliance Updated
                </Badge>
              )}
            </div>
            <h2 className="text-6xl font-black font-mono text-primary tracking-tighter leading-none">
              {activeCode.code}
            </h2>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className={`h-16 w-16 rounded-[2rem] transition-all shadow-xl hover:scale-110 active:scale-95 border-2 ${isFavorited ? "text-secondary border-secondary bg-secondary/5" : "text-muted-foreground hover:text-primary hover:border-primary"}`}
                  onClick={toggleFavorite}
                  disabled={addFavorite.isPending || removeFavorite.isPending}
                >
                  {isFavorited ? (
                    <BookmarkCheck className="w-8 h-8 fill-current" />
                  ) : (
                    <BookmarkPlus className="w-8 h-8" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-bold">{isFavorited ? 'Remove from Workspace' : 'Add to Workspace'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="appGlass appCard rounded-3xl p-8 border border-border/60 dark:border-border/60 shadow-xl shadow-black/10 flex flex-col justify-center min-h-[160px]">
            <h3 className="text-xs font-black text-primary/50 uppercase tracking-[0.2em] mb-4">Official Clinical Description</h3>
            <p className="text-xl text-foreground leading-tight font-bold">
              {activeCode.description}
            </p>
          </div>
          
          <div className="space-y-4">
            {activeCode.category && (
              <div className="bg-secondary/5 rounded-2xl p-6 border border-secondary/10 shadow-sm">
                <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-2">Classification</h3>
                <p className="text-lg text-foreground font-bold leading-none">{activeCode.category}</p>
              </div>
            )}

            {activeCode.procedureDetails && (
              <div className="bg-accent/5 rounded-2xl p-6 border border-accent/10 shadow-sm">
                <h3 className="text-[10px] font-black text-accent-foreground/50 uppercase tracking-[0.2em] mb-2">Procedure Protocol</h3>
                <p className="text-sm text-foreground/70 font-medium leading-relaxed italic">{activeCode.procedureDetails}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-8 md:p-12 flex-1">
        <div className="max-w-4xl mx-auto space-y-12">
          {activeCode.type === "ICD-10-CM" && noteCards && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-10 w-2 bg-secondary rounded-full shadow-lg shadow-secondary/20" />
                <div>
                  <h2 className="text-2xl font-black text-foreground tracking-tight">ICD-10 Code Notes</h2>
                  <p className="text-sm text-muted-foreground font-medium">
                    Exact tabular notes for <span className="font-mono font-black">{activeCode.code}</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {noteCards.excludes1?.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-5 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-3">Excludes1</p>
                    <div className="space-y-2">
                      {noteCards.excludes1.slice(0, 8).map((item) => (
                        <div key={item} className="text-sm text-muted-foreground font-medium leading-6">- {item}</div>
                      ))}
                    </div>
                  </div>
                )}

                {noteCards.excludes2?.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-3">Excludes2</p>
                    <div className="space-y-2">
                      {noteCards.excludes2.slice(0, 8).map((item) => (
                        <div key={item} className="text-sm text-muted-foreground font-medium leading-6">- {item}</div>
                      ))}
                    </div>
                  </div>
                )}

                {noteCards.codeFirst?.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-3">Code First</p>
                    <div className="space-y-2">
                      {noteCards.codeFirst.slice(0, 8).map((item) => (
                        <div key={item} className="text-sm text-muted-foreground font-medium leading-6">- {item}</div>
                      ))}
                    </div>
                  </div>
                )}

                {noteCards.useAdditionalCode?.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-3">Use Additional Code</p>
                    <div className="space-y-2">
                      {noteCards.useAdditionalCode.slice(0, 8).map((item) => (
                        <div key={item} className="text-sm text-muted-foreground font-medium leading-6">- {item}</div>
                      ))}
                    </div>
                  </div>
                )}

                {noteCards.inclusionTerms?.length > 0 && (
                  <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-violet-600 mb-3">Inclusion Terms</p>
                    <div className="space-y-2">
                      {noteCards.inclusionTerms.slice(0, 8).map((item) => (
                        <div key={item} className="text-sm text-muted-foreground font-medium leading-6">- {item}</div>
                      ))}
                    </div>
                  </div>
                )}

                {(noteCards.sevenChrNote || (noteCards.sevenChrDef?.length || 0) > 0) && (
                  <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-5 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-cyan-700 mb-3">7th Character</p>
                    {noteCards.sevenChrNote && (
                      <p className="text-sm text-muted-foreground font-medium leading-6 mb-3">{noteCards.sevenChrNote}</p>
                    )}
                    {noteCards.sevenChrDef?.length > 0 && (
                      <div className="space-y-2">
                        {noteCards.sevenChrDef.map((item) => (
                          <div key={item.char} className="flex items-center justify-between rounded-xl bg-background/500 border border-cyan-100 px-3 py-2">
                            <span className="font-mono font-black text-cyan-800">{item.char}</span>
                            <span className="text-sm text-muted-foreground font-medium">{item.meaning}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-2 bg-primary rounded-full shadow-lg shadow-primary/20" />
              <div>
                <h2 className="text-2xl font-black text-foreground tracking-tight">Regulatory Guidelines</h2>
                <p className="text-sm text-muted-foreground font-medium">
                  Code-specific CMS guidance and coding context for <span className="font-mono font-black">{activeCode.code}</span>
                </p>
              </div>
            </div>
            
            {cmsGuidelines.length > 0 ? (
              <div className="space-y-4">
                {codeGuidelines?.nlmInfo && (
                  <div className="bg-gradient-to-r from-[#0057A8] to-[#003d75] text-white rounded-2xl p-5 shadow-lg">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-2">NLM Clinical Tables - Live Confirmation</p>
                    <p className="text-sm font-black">{codeGuidelines.nlmInfo.code} - {codeGuidelines.nlmInfo.source}</p>
                    <p className="text-white/90 font-medium text-sm mt-1">{codeGuidelines.nlmInfo.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="appGlass appCard border border-border/60 dark:border-border/60 rounded-2xl p-5 shadow-sm shadow-black/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary/50 mb-2">Primary Code</p>
                    <p className="font-mono text-xl font-black text-primary">{activeCode.code}</p>
                    <p className="text-sm text-muted-foreground font-medium mt-2">{activeCode.description}</p>
                  </div>

                  <div className="appGlass appCard border border-border/60 dark:border-border/60 rounded-2xl p-5 shadow-sm shadow-black/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary/50 mb-2">Relevant Guidance</p>
                    <p className="text-2xl font-black text-foreground">{cmsGuidelines.length}</p>
                    <p className="text-sm text-muted-foreground font-medium mt-2">Matched CMS guideline {cmsGuidelines.length === 1 ? "section" : "sections"}</p>
                  </div>

                  <div className="appGlass appCard border border-border/60 dark:border-border/60 rounded-2xl p-5 shadow-sm shadow-black/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary/50 mb-2">Coverage Scope</p>
                    <p className="text-sm font-bold text-foreground">
                      {cmsGuidelines[0]?.chapterTitle || "Official ICD-10-CM Guidance"}
                    </p>
                    <p className="text-xs text-muted-foreground/80 font-medium mt-2">Most relevant chapter context for this code</p>
                  </div>
                </div>

                <div className="rounded-[2rem] appGlass appCard border border-border/60 shadow-xl shadow-black/20 overflow-hidden">
                  <div className="px-6 py-5 border-b border-border/60 bg-background/40 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary/50">Regulatory Match Set</p>
                      <p className="text-sm font-bold text-muted-foreground mt-1">
                        Top {Math.min(cmsGuidelines.length, 3)} relevant guideline{Math.min(cmsGuidelines.length, 3) === 1 ? "" : "s"} shown first
                      </p>
                    </div>
                    {cmsGuidelines.length > 3 && (
                      <div className="bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-xl text-xs font-black">
                        + {cmsGuidelines.length - 3} more match{cmsGuidelines.length - 3 === 1 ? "" : "es"}
                      </div>
                    )}
                  </div>

                  <Accordion type="single" collapsible defaultValue={cmsGuidelines[0]?.id} className="w-full">
                    {cmsGuidelines.slice(0, 3).map((item, idx) => (
                      <AccordionItem key={item.id} value={item.id} className="border-b border-border/60 last:border-b-0">
                        <AccordionTrigger className="px-6 py-5 hover:no-underline">
                          <div className="flex-1 text-left">
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              {idx === 0 && (
                                <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                                  Most Relevant
                                </span>
                              )}
                              <span className="bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                                Chapter {item.chapter}
                              </span>
                              <span className="bg-secondary/10 text-secondary border border-secondary/20 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                                {item.section}
                              </span>
                              <span className="bg-background/50 text-muted-foreground border border-border/60 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                                {item.codeRangeStart}-{item.codeRangeEnd}
                              </span>
                            </div>
                            <h3 className="text-base md:text-lg font-black text-foreground leading-tight">{item.title}</h3>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mt-1">{item.chapterTitle}</p>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-6">
                          <div className="space-y-5">
                            <div className="rounded-2xl bg-background/40 border border-border/60 p-5">
                              {renderGuidelineContent(item.content)}
                            </div>

                            {item.tags?.length > 0 && (
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">Keywords</p>
                                <div className="flex flex-wrap gap-2">
                                  {item.tags.slice(0, 8).map((tag) => (
                                    <span key={tag} className="px-2.5 py-1 rounded-full bg-background/50 text-muted-foreground text-xs font-bold border border-border/60">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3 text-muted-foreground">
                                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-xs font-bold uppercase tracking-widest">CMS Source Verified</span>
                              </div>
                              <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                                <Button className="rounded-2xl bg-slate-900 hover:bg-primary text-white font-black px-5 py-3 h-auto shadow-lg transition-all hover:scale-105 active:scale-95 group">
                                  View Official Documentation
                                  <ExternalLink className="w-4 h-4 ml-2 group-hover:rotate-45 transition-transform" />
                                </Button>
                              </a>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              </div>
            ) : activeCode.guideline ? (
              <div className="group relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-[2.5rem] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
                <div className="relative appGlass appCard border border-border/60 rounded-[2rem] shadow-2xl shadow-black/25 overflow-hidden p-8 space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-3">
                      <div className="bg-primary/10 px-4 py-2 rounded-xl text-primary font-black text-xs uppercase tracking-wider border border-primary/20">
                        Ver {activeCode.guideline.version}
                      </div>
                      <div className="bg-secondary/10 px-4 py-2 rounded-xl text-secondary font-black text-xs uppercase tracking-wider border border-secondary/20">
                        Effective {new Date(String(activeCode.guideline.date || "")).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="prose prose-slate max-w-none">
                    <p className="text-xl text-muted-foreground leading-relaxed font-medium">
                      {activeCode.guideline.text}
                    </p>
                  </div>

                  <div className="pt-8 border-t border-border/60 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs font-bold uppercase tracking-widest">Source Verified</span>
                    </div>
                    <Button className="rounded-2xl bg-slate-900 hover:bg-primary text-white font-black px-8 py-6 h-auto shadow-2xl transition-all hover:scale-105 active:scale-95 group">
                      View Official Documentation 
                      <ExternalLink className="w-5 h-5 ml-3 group-hover:rotate-45 transition-transform" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-background/30 rounded-[2rem] border-2 border-dashed border-border/60 p-20 text-center space-y-4">
                <div className="w-20 h-20 appGlass rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-black/25 border border-border/60 mb-6">
                  <Info className="w-10 h-10 text-muted-foreground/50" />
                </div>
                <h3 className="text-xl font-black text-foreground">No Regulatory Flags Found</h3>
                <p className="text-muted-foreground/80 font-medium max-w-xs mx-auto">Standard enterprise coding protocols are currently applicable for this record.</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-2 bg-secondary rounded-full shadow-lg shadow-secondary/20" />
              <h2 className="text-2xl font-black text-foreground tracking-tight">Intelligence Mapping</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {intel?.rvu && (
                <div className="appGlass appCard border border-border/60 dark:border-border/60 rounded-3xl p-6 shadow-sm shadow-black/10">
                  <h4 className="text-xs font-black text-primary/50 uppercase tracking-widest mb-4">RVU Data</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between"><span className="text-sm text-muted-foreground/80">Work RVU</span><span className="font-bold">{intel.rvu.workRvu}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-muted-foreground/80">Non-Facility</span><span className="font-bold text-green-600">${intel.rvu.nonFacilityPayment}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-muted-foreground/80">Facility</span><span className="font-bold text-blue-600">${intel.rvu.facilityPayment}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-muted-foreground/80">Global Period</span><span className="font-bold">{intel.rvu.globalPeriod || 'N/A'}</span></div>
                  </div>
                </div>
              )}

              {intel?.commonModifiers && intel.commonModifiers.length > 0 && (
                <div className="appGlass appCard border border-border/60 dark:border-border/60 rounded-3xl p-6 shadow-sm shadow-black/10">
                  <h4 className="text-xs font-black text-primary/50 uppercase tracking-widest mb-4">Common Modifiers</h4>
                  <div className="space-y-2">
                    {intel.commonModifiers.map((m: any, i: number) => (
                      <div key={i} className="flex justify-between gap-3">
                        <span className="font-mono font-bold text-sm">{m.code}</span>
                        <span className="text-sm text-muted-foreground text-right">{m.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {intel?.relatedDx && intel.relatedDx.length > 0 && (
                <div className="appGlass appCard border border-border/60 dark:border-border/60 rounded-3xl p-6 shadow-sm shadow-black/10">
                  <h4 className="text-xs font-black text-primary/50 uppercase tracking-widest mb-4">Related Diagnoses</h4>
                  <div className="space-y-2">
                    {intel.relatedDx.slice(0, 5).map((dx: any, i: number) => (
                      <div key={i} className="flex justify-between gap-3">
                        <span className="font-mono font-bold text-sm">{dx.code}</span>
                        <span className="text-sm text-muted-foreground text-right">{dx.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}




