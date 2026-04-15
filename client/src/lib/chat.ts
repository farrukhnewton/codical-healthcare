import { queryClient } from "./queryClient";

const API_BASE_URL = "/api/chat";

export type Conversation = {
  id: number;
  name: string | null;
  isGroup: boolean;
  createdAt: string;
  updatedAt: string;
  participants: Array<{
    id: number;
    fullName?: string;
    username?: string;
    avatarUrl?: string;
    isOnline?: boolean;
  }>;
  lastMessage: {
    id: number;
    content: string;
    senderId: number;
    createdAt: string;
  } | null;
  unread?: number;
};

export type Message = {
  id: number;
  conversationId: number;
  senderId: number;
  content: string;
  messageType: string;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  sender?: {
    id: number;
    fullName?: string;
    username?: string;
    avatarUrl?: string;
  };
  attachments?: Array<{
    id: number;
    fileName: string;
    fileType: string;
    fileUrl: string;
  }>;
};

/**
 * Fetches all conversations for the given user.
 */
export async function getConversations(userId: number): Promise<Conversation[]> {
  const response = await fetch(`${API_BASE_URL}/conversations/user/${userId}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Network error" }));
    throw new Error(errorData.message || "Failed to fetch conversations");
  }
  return response.json();
}

/**
 * Fetches messages for a conversation.
 */
export async function getMessages(conversationId: number): Promise<Message[]> {
  const response = await fetch(`${API_BASE_URL}/messages/${conversationId}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Network error" }));
    throw new Error(errorData.message || "Failed to fetch messages");
  }
  return response.json();
}

/**
 * Sends a new message in a conversation.
 */
export async function sendMessage(payload: {
  conversationId: number;
  senderId: number;
  content: string;
  messageType?: string;
}): Promise<Message> {
  const response = await fetch(`${API_BASE_URL}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Network error" }));
    throw new Error(errorData.message || "Failed to send message");
  }

  return response.json();
}

/**
 * Creates a new conversation with a set of users.
 */
export async function createConversation(payload: {
  userIds: number[];
  name?: string;
  isGroup?: boolean;
}): Promise<Conversation> {
  const response = await fetch(`${API_BASE_URL}/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Network error" }));
    throw new Error(errorData.message || "Failed to create conversation");
  }

  return response.json();
}

/**
 * Edits a message.
 */
export async function editMessage(messageId: number, content: string, senderId: number): Promise<Message> {
  const response = await fetch(`${API_BASE_URL}/messages/${messageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, senderId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Network error" }));
    throw new Error(errorData.message || "Failed to edit message");
  }

  return response.json();
}

/**
 * Deletes a message.
 */
export async function deleteMessage(messageId: number, senderId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/messages/${messageId}?senderId=${senderId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Network error" }));
    throw new Error(errorData.message || "Failed to delete message");
  }
}

/**
 * Adds a reaction to a message.
 */
export async function addReaction(messageId: number, userId: number, emoji: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/messages/${messageId}/reactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, emoji }),
  });

  if (!response.ok) {
    throw new Error("Failed to add reaction");
  }
}

/**
 * Removes a reaction from a message.
 */
export async function removeReaction(messageId: number, userId: number, emoji: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/messages/${messageId}/reactions?userId=${userId}&emoji=${encodeURIComponent(emoji)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to remove reaction");
  }
}

export async function uploadChatAttachment(payload: {
  conversationId: number;
  senderId: number;
  file: File;
}): Promise<Message> {
  const formData = new FormData();
  formData.append("conversationId", String(payload.conversationId));
  formData.append("senderId", String(payload.senderId));
  formData.append("file", payload.file);

  const response = await fetch(`${window.location.origin}/api/chat/messages/upload`, {
    method: "POST",
    body: formData,
  });

  const raw = await response.text();
  let data: any = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    throw new Error("Server returned an invalid response");
  }

  if (!response.ok) {
    throw new Error(data?.message || "Failed to upload attachment");
  }

  return data;
}