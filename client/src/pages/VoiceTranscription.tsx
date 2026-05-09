import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ClipboardList,
  Copy,
  FileAudio,
  FileText,
  Hash,
  Loader2,
  Mic,
  Pill,
  ShieldCheck,
  Stethoscope,
  Upload,
  User,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { SavedAiFilesLibrary } from "@/components/saved-ai/SavedAiFilesLibrary";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface StructuredMedicalRecord {
  patientName: string;
  patientAge: string;
  dateOfVisit: string;
  chiefComplaint: string;
  diagnosis: string;
  medications: string;
  dosage: string;
  doctorName: string;
  doctorNotes: string;
  followupDate: string;
}

interface CodingSuggestion {
  code: string;
  description: string;
  rationale?: string;
  confidence?: string;
  type?: string;
}

interface TranscriptionCodingSuggestions {
  cpt_codes: CodingSuggestion[];
  icd10_codes: CodingSuggestion[];
  hcpcs_codes: CodingSuggestion[];
  coding_notes: string;
}

type CoverageStatus = "covered" | "noncovered" | "mixed" | "not_found";

interface CoverageValidationPair {
  icdCode: string;
  procedureCode: string;
  status: CoverageStatus;
  searchedDocumentCount: number;
  evidenceCount: number;
  coveredEvidenceCount: number;
  noncoveredEvidenceCount: number;
  topEvidence: {
    displayId: string;
    articleId: string;
    title: string;
    groupNumber: string;
    effectiveDate: string | null;
    endDate: string | null;
  } | null;
}

interface CoverageValidationResult {
  source: string;
  diagnosisCodes: string[];
  procedureCodes: string[];
  pairCount: number;
  counts: {
    covered: number;
    noncovered: number;
    mixed: number;
    notFound: number;
    evidence: number;
  };
  pairs: CoverageValidationPair[];
}

interface TranscriptionResult {
  success: boolean;
  id: number;
  rawTranscript: string;
  structured: StructuredMedicalRecord;
  codingSuggestions?: TranscriptionCodingSuggestions;
  coverageValidation?: CoverageValidationResult | null;
  createdAt: string | null;
}

interface ApiErrorResponse {
  message?: string;
}

const ACCEPTED_AUDIO_TYPES = ".wav,.mp3,.flac,.m4a,.aac,.aif,.aiff,.ogg";
const ACCEPTED_EXTENSIONS = [".wav", ".mp3", ".flac", ".m4a", ".aac", ".aif", ".aiff", ".ogg"];
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const NOT_DETECTED = "Not detected";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getFileExtension(fileName: string) {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
}

function hasCodingSuggestions(suggestions?: TranscriptionCodingSuggestions) {
  return Boolean(
    suggestions &&
      ((suggestions.cpt_codes || []).length > 0 ||
        (suggestions.icd10_codes || []).length > 0 ||
        (suggestions.hcpcs_codes || []).length > 0 ||
        (suggestions.coding_notes && suggestions.coding_notes !== NOT_DETECTED)),
  );
}

function coverageStatusLabel(status: CoverageStatus) {
  if (status === "covered") return "Covered";
  if (status === "noncovered") return "Noncovered";
  if (status === "mixed") return "Mixed";
  return "No MCD evidence";
}

function coverageStatusClasses(status: CoverageStatus) {
  if (status === "covered") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "noncovered") return "border-red-200 bg-red-50 text-red-700";
  if (status === "mixed") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function formatStructuredRecord(result: TranscriptionResult) {
  const record = result.structured;
  const suggestions = result.codingSuggestions;
  const coverage = result.coverageValidation;
  return [
    "MEDICAL TRANSCRIPTION RECORD",
    "--------------------------------",
    `Patient Name      : ${record.patientName || NOT_DETECTED}`,
    `Patient Age       : ${record.patientAge || NOT_DETECTED}`,
    `Date of Visit     : ${record.dateOfVisit || NOT_DETECTED}`,
    `Chief Complaint   : ${record.chiefComplaint || NOT_DETECTED}`,
    `Diagnosis         : ${record.diagnosis || NOT_DETECTED}`,
    `Medications       : ${record.medications || NOT_DETECTED}`,
    `Dosage            : ${record.dosage || NOT_DETECTED}`,
    `Doctor Name       : ${record.doctorName || NOT_DETECTED}`,
    `Doctor Notes      : ${record.doctorNotes || NOT_DETECTED}`,
    `Follow-Up Date    : ${record.followupDate || NOT_DETECTED}`,
    ...(hasCodingSuggestions(suggestions)
      ? [
          "--------------------------------",
          "Coding Suggestions:",
          "CPT Codes:",
          ...((suggestions?.cpt_codes || []).map((code) => `${code.code} | ${code.description}${code.rationale ? ` | ${code.rationale}` : ""}`)),
          "ICD-10-CM Codes:",
          ...((suggestions?.icd10_codes || []).map((code) => `${code.code}${code.type ? ` (${code.type})` : ""} | ${code.description}${code.rationale ? ` | ${code.rationale}` : ""}`)),
          "HCPCS Codes:",
          ...((suggestions?.hcpcs_codes || []).map((code) => `${code.code} | ${code.description}${code.rationale ? ` | ${code.rationale}` : ""}`)),
          `Coding Notes      : ${suggestions?.coding_notes || NOT_DETECTED}`,
        ]
      : []),
    ...(coverage
      ? [
          "--------------------------------",
          "CMS Coverage Evidence:",
          `Pairs checked: ${coverage.pairCount} | Covered: ${coverage.counts.covered} | Noncovered: ${coverage.counts.noncovered} | Mixed: ${coverage.counts.mixed} | No MCD evidence: ${coverage.counts.notFound}`,
          ...coverage.pairs.map((pair) => {
            const evidence = pair.topEvidence
              ? ` | ${pair.topEvidence.displayId} group ${pair.topEvidence.groupNumber}: ${pair.topEvidence.title}`
              : "";
            return `${pair.procedureCode} + ${pair.icdCode}: ${coverageStatusLabel(pair.status)} | evidence rows: ${pair.evidenceCount}${evidence}`;
          }),
        ]
      : []),
    "--------------------------------",
    "Raw Transcript:",
    result.rawTranscript,
  ].join("\n");
}

function getTranscriptionFileName(result: TranscriptionResult, fileName?: string | null) {
  const patientName = result.structured.patientName && result.structured.patientName !== NOT_DETECTED
    ? result.structured.patientName
    : "";
  const visitDate = result.structured.dateOfVisit && result.structured.dateOfVisit !== NOT_DETECTED
    ? result.structured.dateOfVisit
    : "";

  return [patientName || fileName?.replace(/\.[^.]+$/, "") || "Medical transcription", visitDate]
    .filter(Boolean)
    .join(" - ");
}

export function VoiceTranscription() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [rawTranscriptOpen, setRawTranscriptOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("audio", file);

      const response = await fetch(apiUrl("/api/voice/transcribe"), {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? ((await response.json().catch(() => null)) as TranscriptionResult | ApiErrorResponse | null)
        : null;

      if (!response.ok) {
        const message = data && "message" in data ? data.message : null;
        throw new Error(message || "Transcription failed");
      }

      if (!data || !("success" in data) || !data.success) {
        throw new Error("Transcription endpoint returned an invalid response. Please restart the server and try again.");
      }

      return data;
    },
    onSuccess: (data) => {
      setResult(data);
      setError("");
      setRawTranscriptOpen(false);
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message);
      setResult(null);
    },
  });

  const fields = useMemo(() => {
    if (!result) return [];

    return [
      { label: "Patient Name", value: result.structured.patientName, icon: User },
      { label: "Patient Age", value: result.structured.patientAge, icon: Calendar },
      { label: "Date of Visit", value: result.structured.dateOfVisit, icon: Calendar },
      { label: "Chief Complaint", value: result.structured.chiefComplaint, icon: ClipboardList },
      { label: "Diagnosis", value: result.structured.diagnosis, icon: Stethoscope },
      { label: "Medications", value: result.structured.medications, icon: Pill },
      { label: "Dosage", value: result.structured.dosage, icon: Pill },
      { label: "Doctor Name", value: result.structured.doctorName, icon: Stethoscope },
      { label: "Doctor Notes", value: result.structured.doctorNotes, icon: FileText },
      { label: "Follow-Up Date", value: result.structured.followupDate, icon: Calendar },
    ];
  }, [result]);

  const codingSections = useMemo(() => {
    if (!result?.codingSuggestions) return [];

    return [
      {
        label: "CPT",
        icon: Hash,
        color: "text-emerald-700",
        bg: "bg-emerald-50",
        border: "border-emerald-100",
        codes: result.codingSuggestions.cpt_codes || [],
      },
      {
        label: "ICD-10-CM",
        icon: Stethoscope,
        color: "text-sky-700",
        bg: "bg-sky-50",
        border: "border-sky-100",
        codes: result.codingSuggestions.icd10_codes || [],
      },
      {
        label: "HCPCS",
        icon: Pill,
        color: "text-orange-700",
        bg: "bg-orange-50",
        border: "border-orange-100",
        codes: result.codingSuggestions.hcpcs_codes || [],
      },
    ].filter((section) => section.codes.length > 0);
  }, [result]);

  const currentSavedFile = useMemo(() => {
    if (!result) return null;

    return {
      fileName: getTranscriptionFileName(result, selectedFile?.name),
      patientName: result.structured.patientName && result.structured.patientName !== NOT_DETECTED
        ? result.structured.patientName
        : null,
      content: formatStructuredRecord(result),
      sourceText: result.rawTranscript,
      structuredData: {
        transcriptionId: result.id,
        structured: result.structured,
        codingSuggestions: result.codingSuggestions || null,
        coverageValidation: result.coverageValidation || null,
        sourceAudioFileName: selectedFile?.name || null,
      },
    };
  }, [result, selectedFile?.name]);

  const validateFile = (file: File) => {
    if (!ACCEPTED_EXTENSIONS.includes(getFileExtension(file.name))) {
      return "Invalid file type. Please upload .wav, .mp3, .flac, .m4a, .aac, .aiff, or .ogg";
    }

    if (file.size > MAX_FILE_SIZE) {
      return "File too large. Maximum size is 25MB";
    }

    return "";
  };

  const selectFile = (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      setResult(null);
      return;
    }

    setSelectedFile(file);
    setError("");
    setResult(null);
    mutation.reset();
  };

  const clearFile = () => {
    setSelectedFile(null);
    setError("");
    setResult(null);
    mutation.reset();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files.item(0);
    if (file) selectFile(file);
  };

  const handleCopy = async () => {
    if (!result) return;

    await navigator.clipboard.writeText(formatStructuredRecord(result));
    toast({
      title: "Copied",
      description: "Structured medical record copied to clipboard.",
    });
  };

  const handleNewTranscription = () => {
    clearFile();
    setRawTranscriptOpen(false);
  };

  const isLoading = mutation.isPending;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Mic className="size-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-black text-foreground tracking-tight">Codical AI Transcription</h1>
            <p className="text-muted-foreground font-medium">
              Upload a medical consultation audio file and get a structured medical record instantly
            </p>
          </div>
        </div>
      </div>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-black">
            <FileAudio className="size-5 text-primary" />
            Audio Upload
          </CardTitle>
          <CardDescription>.wav, .mp3, .flac, .m4a, .aac, .aiff, and .ogg files up to 25MB</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div
            className={cn(
              "rounded-2xl border-2 border-dashed p-8 transition-colors",
              "bg-background/40 flex flex-col items-center justify-center gap-4 text-center",
              isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
            )}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDragging(false);
            }}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_AUDIO_TYPES}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.item(0);
                if (file) selectFile(file);
              }}
            />

            <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Upload className="size-7 text-primary" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-black text-foreground">Drop audio file here</p>
              <p className="text-sm text-muted-foreground">Supported formats: WAV, MP3, FLAC, M4A, AAC, AIFF, OGG</p>
            </div>
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload data-icon="inline-start" />
              Click to Browse
            </Button>
          </div>

          {selectedFile && (
            <div className="rounded-2xl border border-border bg-background/50 p-4 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileAudio className="size-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-foreground truncate">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">{formatBytes(selectedFile.size)}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={clearFile} aria-label="Remove selected file">
                <X />
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-medium text-muted-foreground">
            Audio is processed by the Codical AI transcription service after upload.
          </p>
          <Button
            type="button"
            disabled={!selectedFile || isLoading}
            onClick={() => selectedFile && mutation.mutate(selectedFile)}
            className="w-full sm:w-auto font-bold"
          >
            {isLoading ? (
              <>
                <Loader2 data-icon="inline-start" className="animate-spin" />
                Transcribing...
              </>
            ) : (
              <>
                <Mic data-icon="inline-start" />
                Transcribe Audio
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {error && (
        <Alert className="border-destructive/30 bg-destructive/10 text-destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Transcription failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Card className="border-2 overflow-hidden">
          <CardHeader className="bg-primary/5 border-b border-border">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-wide">
                  <ClipboardList className="size-5 text-primary" />
                  Medical Transcription Record
                </CardTitle>
                <CardDescription>
                  Saved record #{result.id}
                  {result.createdAt ? ` · ${new Date(result.createdAt).toLocaleString()}` : ""}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 text-sm font-bold text-primary">
                <CheckCircle className="size-4" />
                Complete
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid md:grid-cols-2">
              {fields.map((field) => {
                const Icon = field.icon;
                const isMissing = !field.value || field.value === NOT_DETECTED;

                return (
                  <div key={field.label} className="flex gap-3 border-b border-border p-4 md:odd:border-r">
                    <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="size-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">{field.label}</p>
                      <p className={cn("mt-1 text-sm font-bold text-foreground leading-6", isMissing && "text-muted-foreground font-medium")}>
                        {field.value || NOT_DETECTED}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {result.codingSuggestions && hasCodingSuggestions(result.codingSuggestions) && (
              <div className="border-t border-border p-4">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Coding Suggestions</p>
                    <p className="text-sm font-medium text-muted-foreground">
                      Assistive candidates from the transcript, pending coder review.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                    <AlertCircle className="size-3.5" />
                    Verify before billing
                  </div>
                </div>

                {codingSections.length > 0 && (
                  <div className="grid gap-3 lg:grid-cols-3">
                    {codingSections.map((section) => {
                      const Icon = section.icon;

                      return (
                        <div key={section.label} className={cn("rounded-2xl border p-4", section.bg, section.border)}>
                          <div className={cn("mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wide", section.color)}>
                            <Icon className="size-4" />
                            {section.label}
                          </div>
                          <div className="flex flex-col gap-3">
                            {section.codes.map((code) => (
                              <div key={code.code} className="rounded-xl bg-white/70 p-3">
                                <div className="mb-1 flex flex-wrap items-center gap-2">
                                  <span className={cn("font-mono text-sm font-black", section.color)}>{code.code}</span>
                                  {code.confidence && (
                                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase text-muted-foreground">
                                      {code.confidence}
                                    </span>
                                  )}
                                  {code.type && (
                                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase text-muted-foreground">
                                      {code.type}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm font-bold text-foreground">{code.description || NOT_DETECTED}</p>
                                {code.rationale && (
                                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{code.rationale}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {result.codingSuggestions.coding_notes && result.codingSuggestions.coding_notes !== NOT_DETECTED && (
                  <div className="mt-3 rounded-2xl border border-border bg-background/50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Coding Notes</p>
                    <p className="mt-1 text-sm leading-6 text-foreground">{result.codingSuggestions.coding_notes}</p>
                  </div>
                )}
              </div>
            )}

            {result.coverageValidation && (
              <div className="border-t border-border p-4">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
                      <ShieldCheck className="size-4 text-emerald-600" />
                      CMS Coverage Evidence
                    </p>
                    <p className="text-sm font-medium text-muted-foreground">
                      Coverage-derived intelligence from CMS article groups, not an official CMS crosswalk.
                    </p>
                  </div>
                  <div className="text-xs font-bold text-muted-foreground">
                    {result.coverageValidation.pairCount} pair{result.coverageValidation.pairCount === 1 ? "" : "s"} checked
                  </div>
                </div>

                <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                  {[
                    { label: "Covered", value: result.coverageValidation.counts.covered, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-100" },
                    { label: "Noncovered", value: result.coverageValidation.counts.noncovered, color: "text-red-700", bg: "bg-red-50", border: "border-red-100" },
                    { label: "Mixed", value: result.coverageValidation.counts.mixed, color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-100" },
                    { label: "No Evidence", value: result.coverageValidation.counts.notFound, color: "text-slate-700", bg: "bg-slate-50", border: "border-slate-100" },
                  ].map((item) => (
                    <div key={item.label} className={cn("rounded-xl border p-3", item.bg, item.border)}>
                      <div className={cn("text-xl font-black", item.color)}>{item.value}</div>
                      <div className={cn("text-[10px] font-black uppercase tracking-wide", item.color)}>{item.label}</div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-2">
                  {result.coverageValidation.pairs.map((pair) => (
                    <div key={`${pair.procedureCode}-${pair.icdCode}`} className={cn("rounded-xl border p-3", coverageStatusClasses(pair.status))}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-black">{pair.procedureCode}</span>
                            <span className="text-muted-foreground">+</span>
                            <span className="font-mono text-sm font-black">{pair.icdCode}</span>
                            <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-black uppercase">
                              {coverageStatusLabel(pair.status)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs">
                            {pair.evidenceCount} evidence row{pair.evidenceCount === 1 ? "" : "s"} across {pair.searchedDocumentCount} article{pair.searchedDocumentCount === 1 ? "" : "s"}
                          </p>
                          {pair.topEvidence && (
                            <p className="mt-2 text-xs leading-5">
                              <span className="font-black">{pair.topEvidence.displayId}</span>
                              {" group "}{pair.topEvidence.groupNumber}: {pair.topEvidence.title}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Collapsible open={rawTranscriptOpen} onOpenChange={setRawTranscriptOpen}>
              <div className="p-4 flex flex-col gap-4">
                <Separator />
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="outline" className="w-full sm:w-fit">
                    <FileText data-icon="inline-start" />
                    {rawTranscriptOpen ? "Hide Raw Transcript" : "Show Raw Transcript"}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="rounded-2xl border border-border bg-muted/30 p-4">
                    <p className="text-sm leading-7 text-foreground">{result.rawTranscript}</p>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 border-t border-border bg-background/40 p-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={handleCopy} className="w-full sm:w-auto">
              <Copy data-icon="inline-start" />
              Copy to Clipboard
            </Button>
            <Button type="button" onClick={handleNewTranscription} className="w-full sm:w-auto">
              <Mic data-icon="inline-start" />
              New Transcription
            </Button>
          </CardFooter>
        </Card>
      )}

      <SavedAiFilesLibrary
        module="transcription"
        title="Saved Transcriptions"
        description="Save generated medical transcription records for 30 days, rename them, edit the text, and download permanent PDFs."
        currentFile={currentSavedFile}
      />
    </div>
  );
}
