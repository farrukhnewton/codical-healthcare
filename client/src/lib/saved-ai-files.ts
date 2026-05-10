import { supabase } from "@/lib/supabase";

export type SavedAiModule = "transcription" | "op_report_coding" | "claim_validation";

export type SavedAiFile = {
  id: number;
  userId: number;
  module: SavedAiModule;
  fileName: string;
  patientName: string | null;
  content: string;
  sourceText: string | null;
  structuredData: Record<string, any>;
  createdAt: string | null;
  updatedAt: string | null;
  expiresAt: string;
  expirationDate: string;
  daysRemaining: number;
};

export type SaveAiFilePayload = {
  module: SavedAiModule;
  fileName: string;
  patientName?: string | null;
  content: string;
  sourceText?: string | null;
  structuredData?: Record<string, any>;
};

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Please sign in again to use saved files.");
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Request failed");
  }

  return data as T;
}

export async function getSavedAiFiles(module: SavedAiModule) {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/saved-ai-files?module=${encodeURIComponent(module)}`, {
    headers,
  });

  return readJsonResponse<SavedAiFile[]>(response);
}

export async function saveAiFile(payload: SaveAiFilePayload) {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/saved-ai-files", {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return readJsonResponse<SavedAiFile>(response);
}

export async function updateSavedAiFile(
  id: number,
  payload: Partial<Pick<SavedAiFile, "fileName" | "patientName" | "content" | "sourceText" | "structuredData">>,
) {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/saved-ai-files/${id}`, {
    method: "PATCH",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return readJsonResponse<SavedAiFile>(response);
}

export async function deleteSavedAiFile(id: number) {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/saved-ai-files/${id}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || "Failed to delete saved file");
  }
}

export async function downloadSavedAiFilePdf(file: SavedAiFile) {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/saved-ai-files/${file.id}/pdf`, {
    headers,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || "Failed to download PDF");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const fallbackName = file.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-") || "codical-report";

  anchor.href = url;
  anchor.download = fallbackName.toLowerCase().endsWith(".pdf") ? fallbackName : `${fallbackName}.pdf`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
