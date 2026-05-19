import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, Download, FileText, FolderOpen, Loader2, Pencil, RotateCcw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  onUseFile?: (file: SavedAiFile) => void;
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

function getCountdownTone(daysRemaining: number) {
  if (daysRemaining <= 3) return "danger";
  if (daysRemaining <= 7) return "warning";
  return "success";
}

export function SavedAiFilesLibrary({
  module,
  title,
  description,
  currentFile,
  onUseFile,
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
      if (!currentFile) throw new Error("No report is ready to save.");
      return saveAiFile({
        module,
        ...currentFile,
      });
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "The report was added to your 30-day library." });
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
      <section className="tool-panel saved-library-panel" aria-label={title}>
        <div className="saved-library-head">
          <div className="saved-library-title-block">
            <span className="saved-library-icon">
              <FolderOpen size={20} />
            </span>
            <div>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => saveCurrentMutation.mutate()}
            disabled={!canSaveCurrent || saveCurrentMutation.isPending}
            className="tool-primary-button saved-library-save-button"
          >
            {saveCurrentMutation.isPending ? <Loader2 className="is-spinning" size={16} /> : <Save size={16} />}
            Save current
          </Button>
        </div>

        <div className="saved-library-body">
          {isLoading ? (
            <div className="saved-library-state">
              <Loader2 className="is-spinning" size={17} />
              <span>Loading saved reports...</span>
            </div>
          ) : sortedFiles.length === 0 ? (
            <div className="tool-empty-state compact saved-library-empty">
              <FileText size={34} />
              <strong>No saved reports yet</strong>
              <span>Reports saved here stay available for 30 days.</span>
            </div>
          ) : (
            <div className="saved-library-grid">
              {sortedFiles.map((file) => (
                <article key={file.id} className="saved-library-card">
                  <div className="saved-library-card-head">
                    <div>
                      <h3>{file.fileName}</h3>
                      {file.patientName && <p>{file.patientName}</p>}
                    </div>
                    <span className="saved-library-countdown" data-tone={getCountdownTone(file.daysRemaining)}>
                      {getCountdownLabel(file.daysRemaining)}
                    </span>
                  </div>

                  <div className="saved-library-meta">
                    <CalendarClock size={15} />
                    <span>Deletes {formatDate(file.expiresAt)}</span>
                  </div>

                  <div className="saved-library-actions">
                    {onUseFile && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onUseFile(file)}
                        className="tool-secondary-button saved-library-action"
                      >
                        <RotateCcw size={15} />
                        Use
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedFile(file)}
                      className="tool-secondary-button saved-library-action"
                    >
                      <Pencil size={15} />
                      Open
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => downloadMutation.mutate(file)}
                      disabled={downloadMutation.isPending}
                      className="tool-secondary-button saved-library-action"
                    >
                      <Download size={15} />
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
                      className="tool-secondary-button saved-library-action is-danger"
                    >
                      <Trash2 size={15} />
                      Delete
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <Dialog open={Boolean(selectedFile)} onOpenChange={(open) => !open && setSelectedFile(null)}>
        <DialogContent className="saved-library-dialog">
          <DialogHeader className="saved-library-dialog-head">
            <DialogTitle>Edit Saved Report</DialogTitle>
          </DialogHeader>
          {selectedFile && (
            <div className="saved-library-edit-form">
              <div className="saved-library-field-grid">
                <label>
                  <span>File name</span>
                  <Input value={fileName} onChange={(event) => setFileName(event.target.value)} />
                </label>
                <label>
                  <span>Patient / identifier</span>
                  <Input value={patientName} onChange={(event) => setPatientName(event.target.value)} />
                </label>
              </div>

              <div className="saved-library-dialog-meta">
                <span className="saved-library-countdown" data-tone={getCountdownTone(selectedFile.daysRemaining)}>
                  {getCountdownLabel(selectedFile.daysRemaining)}
                </span>
                <span>Expires {formatDate(selectedFile.expiresAt)}</span>
              </div>

              <ScrollArea className="saved-library-scroll">
                <Textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  className="saved-library-textarea"
                />
              </ScrollArea>

              <div className="saved-library-dialog-actions">
                {onUseFile && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      onUseFile(selectedFile);
                      setSelectedFile(null);
                    }}
                    className="tool-secondary-button"
                  >
                    <RotateCcw size={16} />
                    Use this file
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => downloadMutation.mutate(selectedFile)}
                  className="tool-secondary-button"
                >
                  <Download size={16} />
                  Download PDF
                </Button>
                <Button
                  type="button"
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending || !fileName.trim() || !content.trim()}
                  className="tool-primary-button"
                >
                  {updateMutation.isPending ? <Loader2 className="is-spinning" size={16} /> : <Save size={16} />}
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
