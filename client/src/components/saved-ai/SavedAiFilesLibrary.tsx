import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, Download, FileText, FolderOpen, Loader2, Pencil, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  deleteSavedAiFile,
  downloadSavedAiFilePdf,
  getSavedAiFiles,
  saveAiFile,
  type SaveAiFilePayload,
  type SavedAiFile,
  type SavedAiModule,
  updateSavedAiFile,
} from "@/lib/saved-ai-files";

type CurrentFileDraft = Omit<SaveAiFilePayload, "module">;

type SavedAiFilesLibraryProps = {
  module: SavedAiModule;
  title: string;
  description: string;
  currentFile?: CurrentFileDraft | null;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getCountdownLabel(daysRemaining: number) {
  if (daysRemaining <= 0) return "Expires today";
  if (daysRemaining === 1) return "1 day left";
  return `${daysRemaining} days left`;
}

export function SavedAiFilesLibrary({
  module,
  title,
  description,
  currentFile,
}: SavedAiFilesLibraryProps) {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<SavedAiFile | null>(null);
  const [fileName, setFileName] = useState("");
  const [patientName, setPatientName] = useState("");
  const [content, setContent] = useState("");

  const canSaveCurrent = Boolean(currentFile?.content?.trim());

  const { data: files = [], isLoading, refetch } = useQuery({
    queryKey: ["saved-ai-files", module],
    queryFn: () => getSavedAiFiles(module),
  });

  useEffect(() => {
    if (!selectedFile) return;
    setFileName(selectedFile.fileName || "");
    setPatientName(selectedFile.patientName || "");
    setContent(selectedFile.content || "");
  }, [selectedFile]);

  const saveCurrentMutation = useMutation({
    mutationFn: async () => {
      if (!currentFile) throw new Error("No generated report is ready to save.");
      return saveAiFile({
        module,
        ...currentFile,
      });
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "The file was added to your 30-day library." });
      refetch();
    },
    onError: (error: Error) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!selectedFile) throw new Error("No saved file selected.");
      return updateSavedAiFile(selectedFile.id, {
        fileName,
        patientName,
        content,
      });
    },
    onSuccess: (updatedFile) => {
      toast({ title: "Updated", description: "Saved file changes were applied." });
      setSelectedFile(updatedFile);
      refetch();
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (file: SavedAiFile) => deleteSavedAiFile(file.id),
    onSuccess: () => {
      toast({ title: "Deleted", description: "The saved file was removed." });
      setSelectedFile(null);
      refetch();
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: downloadSavedAiFilePdf,
    onError: (error: Error) => {
      toast({ title: "PDF download failed", description: error.message, variant: "destructive" });
    },
  });

  const sortedFiles = useMemo(() => files, [files]);

  return (
    <>
      <Card className="border-2">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl font-black">
                <FolderOpen className="size-5 text-primary" />
                {title}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <Button
              type="button"
              onClick={() => saveCurrentMutation.mutate()}
              disabled={!canSaveCurrent || saveCurrentMutation.isPending}
              className="w-full gap-2 sm:w-auto"
            >
              {saveCurrentMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save current
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border p-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading saved files...
            </div>
          ) : sortedFiles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <FileText className="mx-auto size-8 text-muted-foreground/70" />
              <p className="mt-3 text-sm font-bold text-foreground">No saved files yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Generated files you save here stay available for 30 days.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {sortedFiles.map((file) => (
                <div key={file.id} className="rounded-xl border border-border bg-background/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-foreground">{file.fileName}</p>
                      {file.patientName && (
                        <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{file.patientName}</p>
                      )}
                    </div>
                    <Badge variant={file.daysRemaining <= 3 ? "destructive" : "secondary"} className="shrink-0">
                      {getCountdownLabel(file.daysRemaining)}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarClock className="size-3.5" />
                    <span>Deletes {formatDate(file.expiresAt)}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => setSelectedFile(file)} className="gap-2">
                      <Pencil className="size-4" />
                      Open
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => downloadMutation.mutate(file)}
                      disabled={downloadMutation.isPending}
                      className="gap-2"
                    >
                      <Download className="size-4" />
                      PDF
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (window.confirm(`Delete "${file.fileName}" from the 30-day library?`)) {
                          deleteMutation.mutate(file);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="gap-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedFile)} onOpenChange={(open) => !open && setSelectedFile(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Saved File</DialogTitle>
          </DialogHeader>
          {selectedFile && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">File name</label>
                  <Input value={fileName} onChange={(event) => setFileName(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Patient / identifier</label>
                  <Input value={patientName} onChange={(event) => setPatientName(event.target.value)} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant={selectedFile.daysRemaining <= 3 ? "destructive" : "secondary"}>
                  {getCountdownLabel(selectedFile.daysRemaining)}
                </Badge>
                <span>Expires {formatDate(selectedFile.expiresAt)}</span>
              </div>
              <ScrollArea className="max-h-[52vh]">
                <Textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  className="min-h-[360px] resize-y font-mono text-sm leading-6"
                />
              </ScrollArea>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => downloadMutation.mutate(selectedFile)} className="gap-2">
                  <Download className="size-4" />
                  Download PDF
                </Button>
                <Button type="button" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending || !fileName.trim() || !content.trim()} className="gap-2">
                  {updateMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Save changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
