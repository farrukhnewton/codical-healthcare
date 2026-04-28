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
  Loader2,
  Mic,
  Pill,
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
import { useToast } from "@/hooks/use-toast";
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

interface TranscriptionResult {
  success: boolean;
  id: number;
  rawTranscript: string;
  structured: StructuredMedicalRecord;
  createdAt: string | null;
}

interface ApiErrorResponse {
  message?: string;
}

const ACCEPTED_AUDIO_TYPES = ".wav,.mp3,.flac,.m4a,.ogg";
const ACCEPTED_EXTENSIONS = [".wav", ".mp3", ".flac", ".m4a", ".ogg"];
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

function formatStructuredRecord(result: TranscriptionResult) {
  const record = result.structured;
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
    "--------------------------------",
    "Raw Transcript:",
    result.rawTranscript,
  ].join("\n");
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

      const response = await fetch("/api/voice/transcribe", {
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

  const validateFile = (file: File) => {
    if (!ACCEPTED_EXTENSIONS.includes(getFileExtension(file.name))) {
      return "Invalid file type. Please upload .wav, .mp3, .flac, .m4a, or .ogg";
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
          <CardDescription>.wav, .mp3, .flac, .m4a, and .ogg files up to 25MB</CardDescription>
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
              <p className="text-sm text-muted-foreground">Supported formats: WAV, MP3, FLAC, M4A, OGG</p>
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
            Audio is processed offline with VOSK after upload.
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
    </div>
  );
}
