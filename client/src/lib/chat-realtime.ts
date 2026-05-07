import { queryClient } from "./queryClient";
import type { Conversation, Message } from "./chat";

export function mergeRealtimeMessage(incoming: Message) {
  if (!incoming?.id || !incoming.conversationId) return;

  const messageQueryKey = ["messages", incoming.conversationId] as const;
  const cachedMessages = queryClient.getQueryData<Message[]>(messageQueryKey);

  if (cachedMessages) {
    queryClient.setQueryData<Message[]>(messageQueryKey, (currentMessages = []) => {
      const existingMessage = currentMessages.find((message) => message.id === incoming.id);

      if (existingMessage) {
        return currentMessages.map((message) =>
          message.id === incoming.id
            ? {
                ...message,
                ...incoming,
                sender: incoming.sender ?? message.sender,
                attachments: incoming.attachments ?? message.attachments,
              }
            : message,
        );
      }

      return [...currentMessages, incoming];
    });
  }

  queryClient.invalidateQueries({ queryKey: messageQueryKey });
}

export function mergeConversationUpdate(userId: number, conversation: Conversation) {
  queryClient.setQueryData<Conversation[]>(["conversations", userId], (currentConversations = []) => {
    const existingConversation = currentConversations.find((item) => item.id === conversation.id);

    if (existingConversation) {
      return currentConversations.map((item) =>
        item.id === conversation.id ? { ...item, ...conversation } : item,
      );
    }

    return [conversation, ...currentConversations];
  });

  queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
}

export function getMessagePreview(message: Message) {
  if (message.messageType === "file") {
    const fileName = message.attachments?.[0]?.fileName || message.content || "Attachment";
    return `Sent a file: ${fileName}`;
  }

  return (message.content || "New message").replace(/\s+/g, " ").trim();
}
