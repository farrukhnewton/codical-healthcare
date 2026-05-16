import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Send, Paperclip, Smile, MoreVertical, Search, Users } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getConversations, getMessages, markConversationRead, sendMessage, uploadChatAttachment, type Conversation, type Message } from '@/lib/chat';
import { mergeRealtimeMessage } from '@/lib/chat-realtime';
import { cn } from "@/lib/utils";
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { UserPlus, ChevronLeft, MessageSquare, Info, ShieldCheck } from 'lucide-react';
import { FriendsManager } from '@/components/chat/FriendsManager';
import { Badge } from '@/components/ui/badge';
import { NewConversationModal } from "./NewConversation";

function formatPresence(user?: { isOnline?: boolean; lastSeen?: string }) {
  if (user?.isOnline) return "Online";
  if (!user?.lastSeen) return "Offline";

  return `Away ${formatDistanceToNow(new Date(user.lastSeen), { addSuffix: true })}`;
}

function getConversationDisplayName(conversation: Conversation, currentUserId: number) {
  const otherParticipants = conversation.participants?.filter((participant) => participant?.id !== currentUserId) || [];
  const rawName = conversation.name || otherParticipants.map((participant) => participant?.fullName || participant?.username).join(', ') || 'Conversation';
  return rawName === 'Codical AI' ? 'Coding Assistant' : rawName;
}

export function TeamChat() {
  const { user, loading: authLoading, error: authError } = useAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileSidebar, setShowMobileSidebar] = useState(true);

  const { data: conversations = [], isLoading, error } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: () => getConversations(user!.id),
    enabled: !!user?.id,
    refetchInterval: 10000,
  });

  const hasCodicalAiConversation = conversations.some((conversation) =>
    conversation.name === 'Codical AI' ||
    conversation.participants?.some((participant) => participant?.username === 'codical.ai')
  );

  const conversationRoomIds = conversations.map((conversation) => conversation.id);
  const conversationRoomKey = [...conversationRoomIds].sort((a, b) => a - b).join(',');

  useEffect(() => {
    if (!user?.id) return;

    const refreshConversations = () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
    };

    const channel = supabase
      .channel(`chat-list:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'participants',
          filter: `user_id=eq.${user.id}`,
        },
        refreshConversations,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        refreshConversations,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || conversationRoomIds.length === 0) return;

    const refreshFromRealtime = (payload: any) => {
      if (payload.new) {
        mergeRealtimeMessage(payload.new as Message);
      }

      queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
    };

    const channel = supabase.channel(`chat-list-messages:${user.id}:${conversationRoomKey}`);

    conversationRoomIds.forEach((conversationId) => {
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        refreshFromRealtime,
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, conversationRoomKey]);

  useEffect(() => {
    if (!user?.id || isLoading || hasCodicalAiConversation) return;

    fetch(`${window.location.origin}/api/chat/ai/conversation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
    }).catch((err) => {
      console.error('Failed to ensure assistant conversation:', err);
    });
  }, [user?.id, isLoading, hasCodicalAiConversation]);
  const filteredConversations = conversations.filter((conversation) =>
    getConversationDisplayName(conversation, user?.id || 0).toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (!selectedConversationId && filteredConversations.length > 0 && window.innerWidth > 768) {
      setSelectedConversationId(filteredConversations[0].id);
    }
  }, [filteredConversations, selectedConversationId]);

  const handleSelectConversation = (id: number) => {
    setSelectedConversationId(id);
    if (window.innerWidth <= 768) {
      setShowMobileSidebar(false);
    }
  };

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  if (authLoading) return <ChatLoadingSkeleton />;
  if (authError) return <div className="tool-page collaboration-page"><div className="tool-callout" data-tone="danger">Error: {authError}</div></div>;
  if (!user) return <div className="tool-page collaboration-page"><div className="tool-callout" data-tone="warning">Please log in to access chat.</div></div>;
  if (isLoading) return <ChatLoadingSkeleton />;
  if (error) return <div className="tool-page collaboration-page"><div className="tool-callout" data-tone="danger">Error: {(error as Error).message}</div></div>;

  return (
    <div className="tool-page collaboration-page team-chat-page">
      <section className="tool-panel tool-page-header">
        <div>
          <h1>Team Chat</h1>
          <p>Coordinate coding work with team conversations, attachments, and assistant-ready context.</p>
        </div>
        <div className="search-header-meta">
          <span>{conversations.length} conversations</span>
          <span>{filteredConversations.length} visible</span>
        </div>
      </section>

      <section className="tool-panel team-chat-shell">
        <div className={cn(
        "team-chat-list-pane",
        !showMobileSidebar && "hidden md:flex"
      )}>
          <div className="team-chat-list-head">
            <div>
              <h2>
                <MessageSquare size={18} />
                Conversations
            </h2>
              <p>Recent coding discussions and direct messages.</p>
            </div>
            <div className="team-chat-head-actions">
              <Button onClick={() => setIsFriendsModalOpen(true)} size="icon" variant="ghost" className="tool-icon-action" aria-label="Manage contacts">
                <UserPlus className="w-5 h-5" />
              </Button>
              <Button onClick={() => setIsModalOpen(true)} size="icon" variant="ghost" className="tool-icon-action" aria-label="New conversation">
                <Plus className="w-5 h-5" />
              </Button>
            </div>
          </div>
          <div className="team-chat-search">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search conversations"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="tool-input"
            />
          </div>
        <ScrollArea className="team-chat-list-scroll">
          {filteredConversations.length === 0 ? (
            <div className="tool-empty-state compact">
              <MessageSquare size={28} />
              <strong>No conversations yet</strong>
              <span>Start a direct message or invite a teammate to a group thread.</span>
              <Button onClick={() => setIsModalOpen(true)} variant="link" className="tool-secondary-button">
                Start a new conversation
              </Button>
            </div>
          ) : (
            filteredConversations.map(convo => (
              <ConversationItem
                key={convo.id}
                conversation={convo}
                isSelected={selectedConversationId === convo.id}
                currentUserId={user.id}
                onClick={() => handleSelectConversation(convo.id)}
              />
            ))
          )}
        </ScrollArea>
        </div>

        <div className={cn(
        "team-chat-thread-pane",
        showMobileSidebar && "hidden md:flex"
      )}>
        {selectedConversation ? (
          <ChatWindow 
            conversation={selectedConversation} 
            currentUser={user} 
            onBack={() => setShowMobileSidebar(true)} 
          />
        ) : (
          <EmptyState onNewConversation={() => setIsModalOpen(true)} />
        )}
        </div>

        <aside className="team-chat-context-pane">
          <div className="tool-section-head">
            <div>
              <h2>Conversation Context</h2>
              <p>{selectedConversation ? "People, status, and collaboration notes." : "Select a thread to view details."}</p>
            </div>
            <Info size={17} />
          </div>

          {selectedConversation ? (
            <div className="team-chat-context-stack">
              <div className="team-chat-context-card">
                <span>Thread</span>
                <strong>{getConversationDisplayName(selectedConversation, user.id)}</strong>
                <small>{selectedConversation.isGroup ? `${selectedConversation.participants?.length || 0} participants` : "Direct message"}</small>
              </div>
              <div className="team-chat-context-card">
                <span>Read Status</span>
                <strong>{(selectedConversation.unread || 0) > 0 ? `${selectedConversation.unread} unread` : "Current"}</strong>
                <small>Updates sync while this page is open.</small>
              </div>
              <div className="tool-callout compact" data-tone="info">
                <ShieldCheck size={15} />
                Keep PHI inside approved workflows and avoid pasting credentials or access tokens.
              </div>
              <button type="button" className="tool-secondary-button full-width" onClick={() => setIsFriendsModalOpen(true)}>
                <UserPlus size={15} />
                Manage contacts
              </button>
            </div>
          ) : (
            <div className="tool-empty-state compact">
              <Users size={28} />
              <strong>No thread selected</strong>
              <span>Choose a conversation to see participants and thread actions.</span>
            </div>
          )}
        </aside>
      </section>

      <NewConversationModal open={isModalOpen} onOpenChange={setIsModalOpen} />
      <FriendsManager 
        open={isFriendsModalOpen} 
        onOpenChange={setIsFriendsModalOpen} 
        currentUserId={user.id} 
      />
    </div>
  );
}

function ConversationItem({
  conversation,
  isSelected,
  currentUserId,
  onClick
}: {
  conversation: Conversation;
  isSelected: boolean;
  currentUserId: number;
  onClick: () => void;
}) {
  const otherParticipants = conversation.participants?.filter(p => p?.id !== currentUserId) || [];
  const displayName = getConversationDisplayName(conversation, currentUserId);
  const initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const primaryParticipant = otherParticipants[0];

  return (
    <button
      type="button"
      className={cn(
        "team-chat-conversation-card",
        isSelected && "is-selected"
      )}
      onClick={onClick}
    >
      <div className="team-chat-avatar-wrap">
          <Avatar className="team-chat-avatar">
            <AvatarImage src={primaryParticipant?.avatarUrl} />
            <AvatarFallback className="team-chat-avatar-fallback">
              {initials}
            </AvatarFallback>
          </Avatar>
          {primaryParticipant?.isOnline && (
            <span className="team-chat-presence-dot" />
          )}
        </div>
        <div className="team-chat-conversation-copy">
          <div>
            <strong>{displayName}</strong>
            {conversation.lastMessage && (
              <time>
                {formatDistanceToNow(new Date(conversation.lastMessage.createdAt || Date.now()), { addSuffix: false })}
              </time>
            )}
          </div>
          <p>
            {conversation.lastMessage?.content || 'No messages yet'}
          </p>
          {primaryParticipant && (
            <small>
              {formatPresence(primaryParticipant)}
            </small>
          )}
        </div>
        {(conversation.unread || 0) > 0 && (
          <span className="team-chat-unread-count">
            {conversation.unread}
          </span>
        )}
    </button>
  );
}

function ChatWindow({ 
  conversation, 
  currentUser,
  onBack 
}: { 
  conversation: Conversation; 
  currentUser: any;
  onBack?: () => void;
}) {
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const addEmoji = (emoji: any) => {
    setMessage((prev) => prev + (emoji?.emoji || emoji));
    setShowEmojiPicker(false);
  };

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', conversation.id],
    queryFn: () => getMessages(conversation.id),
    enabled: !!conversation.id,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!conversation.id) return;

    const refreshConversation = () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations', currentUser.id] });
    };

    const channel = supabase
      .channel(`chat:${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        refreshConversation,
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attachments',
        },
        refreshConversation,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id, currentUser.id]);

  const sendMessageMutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations', currentUser.id] });
    },
    onError: (err: Error) => {
      console.error("Failed to send message:", err);
      toast({ title: "Message failed", description: err.message, variant: "destructive" });
    },
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: uploadChatAttachment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations', currentUser.id] });
      toast({ title: "Attachment uploaded", description: "File sent successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const handleAttachmentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    e.target.value = "";
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const hasMessage = !!message.trim();
    const hasFile = !!selectedFile;

    if (!hasMessage && !hasFile) return;

    try {
      if (hasMessage) {
        await sendMessageMutation.mutateAsync({
          conversationId: conversation.id,
          senderId: currentUser.id,
          content: message
        });
      }

      if (hasFile && selectedFile) {
        await uploadAttachmentMutation.mutateAsync({
          conversationId: conversation.id,
          senderId: currentUser.id,
          file: selectedFile,
        });
        setSelectedFile(null);
      }

      setMessage('');
    } catch (error) {
      console.error("Failed to send message or attachment:", error);
      toast({
        title: "Send failed",
        description: error instanceof Error ? error.message : "Could not send the message.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const viewport = messagesEndRef.current?.parentElement;
    viewport?.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!conversation.id || !currentUser?.id || messages.length === 0) return;

    markConversationRead({
      conversationId: conversation.id,
      userId: currentUser.id,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['conversations', currentUser.id] });
    }).catch((error) => {
      console.error("Failed to mark conversation read:", error);
    });
  }, [conversation.id, currentUser?.id, messages.length]);

  const otherParticipants = conversation.participants?.filter((p: any) => p?.id !== currentUser.id) || [];
  const displayName = getConversationDisplayName(conversation, currentUser.id);
  const primaryParticipant = otherParticipants[0];

  const openPopup = () => window.open(window.location.href, "_blank", "width=520,height=760");

  const copyConversationId = async () => {
    try {
      await navigator.clipboard.writeText(String(conversation.id));
      toast({ title: "Copied", description: "Conversation ID copied." });
    } catch {
      toast({ title: "Error", description: "Could not copy conversation ID.", variant: "destructive" });
    }
  };

  const askAI = async () => {
    try {
      if (!currentUser?.id) {
        toast({ title: "Error", description: "You must be logged in to use Ask Assistant.", variant: "destructive" });
        return;
      }

      toast({ title: "Ask Assistant", description: "Analyzing conversation..." });

      const res = await fetch(`/api/chat/conversations/${conversation.id}/ask-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          action: "suggest_reply",
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || "Failed to get assistant response");
      }

      const suggestedReply = data?.result?.suggestedReply || "";
      const summary = data?.result?.summary || "";
      const nextActions = Array.isArray(data?.result?.nextActions) ? data.result.nextActions : [];

      if (suggestedReply) {
        setMessage(suggestedReply);
      }

      toast({
        title: "Assistant suggestion ready",
        description: summary || nextActions[0] || "Suggested reply added to message box.",
      });
    } catch (error: any) {
      toast({
        title: "Ask Assistant failed",
        description: error.message || "Could not process assistant request.",
        variant: "destructive",
      });
    }
  };

  const markUnread = () => alert("Mark as unread will be added with backend unread tracking.");
  const muteConversation = () => {
    localStorage.setItem("chat-muted-" + conversation.id, "true");
    toast({ title: "Muted", description: "Conversation muted on this device." });
  };
  const notificationSettings = () => alert("Per-chat notification settings coming soon.");
  const hideConversation = () => alert("Hide conversation feature coming soon.");
  const deleteConversation = () => alert("Delete conversation feature requires backend support.");

  return (
    <>
      <div className="team-chat-thread-head">
        <div className="team-chat-thread-title">
          {onBack && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="team-chat-back-button md:hidden"
              onClick={onBack}
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
          )}
          <div className="team-chat-avatar-wrap">
            <Avatar className="team-chat-avatar small">
              <AvatarImage src={primaryParticipant?.avatarUrl} />
              <AvatarFallback className="team-chat-avatar-fallback">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {primaryParticipant?.isOnline && (
              <span className="team-chat-presence-dot" />
            )}
          </div>
          <div>
            <div className="team-chat-thread-name">
              <h3>
                {displayName}
              </h3>
              {displayName.toLowerCase().includes('assistant') && (
                <Badge variant="secondary" className="team-chat-assistant-badge">Assistant</Badge>
              )}
            </div>
            <p>
              {conversation.isGroup ? `${conversation.participants?.length || 0} participants` : formatPresence(primaryParticipant)}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="tool-icon-action">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="team-chat-menu">
            <DropdownMenuItem onClick={markUnread}>Mark as unread</DropdownMenuItem>
            <DropdownMenuItem onClick={openPopup}>Open in a pop-up</DropdownMenuItem>
            <DropdownMenuItem onClick={muteConversation}>Mute</DropdownMenuItem>
            <DropdownMenuItem onClick={notificationSettings}>Notifications</DropdownMenuItem>
            <DropdownMenuItem onClick={copyConversationId}>Copy conversation ID</DropdownMenuItem>
            <DropdownMenuItem onClick={askAI}>Ask Assistant</DropdownMenuItem>
            <DropdownMenuItem onClick={hideConversation}>Hide conversation</DropdownMenuItem>
            <DropdownMenuItem onClick={deleteConversation} className="text-red-600 dark:text-red-400">Delete conversation</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="team-chat-message-scroll">
        {isLoading ? (
          <div className="team-chat-loading">
            <span className="tool-spinner dark" />
          </div>
        ) : messages.length === 0 ? (
          <div className="tool-empty-state compact">
            <MessageSquare size={28} />
            <strong>No messages yet</strong>
            <span>Start the conversation when the team is ready.</span>
          </div>
        ) : (
          <div className="team-chat-message-list">
            {messages.map((msg: any) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwnMessage={msg.senderId === currentUser.id}
              />
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </ScrollArea>

      <div className="team-chat-composer">
        {showEmojiPicker && (
          <div className="team-chat-emoji-popover">
            <EmojiPicker onEmojiClick={addEmoji} />
          </div>
        )}

        {selectedFile && (
          <div className="team-chat-attachment-preview">
            <span className="truncate">{selectedFile.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFile(null)}
            >
              Remove
            </Button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="team-chat-compose-form">
          <div className="team-chat-attach-control">
            <input
              ref={fileInputRef}
              type="file"
              className="team-chat-file-input"
              onChange={handleAttachmentSelect}
              disabled={uploadAttachmentMutation.isPending}
              aria-label="Attach file"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="tool-icon-action pointer-events-none"
              disabled={uploadAttachmentMutation.isPending}
              aria-hidden="true"
              tabIndex={-1}
            >
              <Paperclip className="w-5 h-5" />
            </Button>
          </div>

          <Input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message"
            className="tool-input team-chat-message-input"
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="tool-icon-action"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
          >
            <Smile className="w-5 h-5" />
          </Button>

          <Button
            type="submit"
            disabled={
              sendMessageMutation.isPending ||
              uploadAttachmentMutation.isPending ||
              (!message.trim() && !selectedFile)
            }
            className="tool-primary-button team-chat-send-button"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </>
  );
}

function MessageBubble({ message, isOwnMessage }: { message: any; isOwnMessage: boolean }) {
  return (
    <div className={cn("team-chat-message-row", isOwnMessage ? "is-own" : "is-other")}>
      <div
        className={cn(
          "team-chat-message-bubble",
          isOwnMessage ? "is-own" : "is-other"
        )}
      >
        {!isOwnMessage && (
          <p className="team-chat-message-sender">
            {message.sender?.fullName || message.sender?.username || 'Unknown'}
          </p>
        )}

        <p className="team-chat-message-text">{message.content}</p>

        {Array.isArray(message.attachments) && message.attachments.length > 0 && (
          <div className="team-chat-attachment-list">
            {message.attachments.map((att: any) => (
              <a
                key={att.id}
                href={att.fileUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "team-chat-attachment-link",
                  isOwnMessage ? "text-blue-100" : "text-blue-600 dark:text-blue-400"
                )}
              >
                {att.fileName}
              </a>
            ))}
          </div>
        )}

        <p className="team-chat-message-time">
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {message.isEdited && <span className="ml-1">(edited)</span>}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ onNewConversation }: { onNewConversation: () => void }) {
  return (
    <div className="team-chat-empty-state">
      <div>
        <Users size={34} />
      </div>
      <h3>Welcome to Team Chat</h3>
      <p>Select a conversation or start a new one.</p>
      <Button onClick={onNewConversation} className="tool-primary-button">
        <Plus className="w-4 h-4 mr-2" />
        New Conversation
      </Button>
    </div>
  );
}

function ChatLoadingSkeleton() {
  return (
    <div className="tool-page collaboration-page team-chat-page">
      <section className="tool-panel team-chat-loading-shell">
      <div className="team-chat-loading-list">
        <div className="team-chat-skeleton large" />
        <div className="team-chat-skeleton" />
        {[1, 2, 3].map(i => (
          <div key={i} className="team-chat-loading-row">
            <div className="team-chat-skeleton avatar" />
            <div>
              <div className="team-chat-skeleton" />
              <div className="team-chat-skeleton short" />
            </div>
          </div>
        ))}
      </div>
      <div className="team-chat-loading-main">
        <span className="tool-spinner dark" />
      </div>
      </section>
    </div>
  );
}
