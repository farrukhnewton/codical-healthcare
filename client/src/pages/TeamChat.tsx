import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Send, Paperclip, Smile, MoreVertical, Search, Users } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getConversations, sendMessage, uploadChatAttachment, type Conversation } from '@/lib/chat';
import { cn } from "@/lib/utils";
import { useAuth } from '@/hooks/useAuth';
import { queryClient } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';
import { UserPlus, ChevronLeft, MessageSquare } from 'lucide-react';
import { FriendsManager } from '@/components/chat/FriendsManager';
import { Badge } from '@/components/ui/badge';
import { NewConversationModal } from "./NewConversation";

export function TeamChat() {
  const { user, loading: authLoading } = useAuth();
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
  useEffect(() => {
    if (!user?.id) return;

    fetch(`${window.location.origin}/api/chat/ai/conversation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
    }).catch((err) => {
      console.error('Failed to ensure AI conversation:', err);
    });
  }, [user?.id]);
  const filteredConversations = conversations.filter(c =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
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
  if (!user) return <div className="p-4">Please log in to access chat.</div>;
  if (isLoading) return <ChatLoadingSkeleton />;
  if (error) return <div className="p-4 text-red-500">Error: {(error as Error).message}</div>;

  return (
    <div className="flex h-[calc(100vh-140px)] md:h-[calc(100vh-120px)] bg-white dark:bg-gray-900 md:rounded-xl md:shadow-sm md:border overflow-hidden md:m-4">
      {/* Sidebar - HIDDEN on mobile if chat is active */}
      <div className={cn(
        "w-full md:w-80 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-gray-50 dark:bg-gray-900 transition-all duration-300",
        !showMobileSidebar && "hidden md:flex"
      )}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              Messages
            </h2>
            <div className="flex gap-1">
              <Button onClick={() => setIsFriendsModalOpen(true)} size="icon" variant="ghost" className="rounded-full text-blue-600 hover:bg-blue-50">
                <UserPlus className="w-5 h-5" />
              </Button>
              <Button onClick={() => setIsModalOpen(true)} size="icon" variant="ghost" className="rounded-full">
                <Plus className="w-5 h-5" />
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white dark:bg-gray-800"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p>No conversations yet</p>
              <Button onClick={() => setIsModalOpen(true)} variant="link" className="mt-2">
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

      {/* Chat Area - HIDDEN on mobile if list is visible */}
      <div className={cn(
        "flex-1 flex flex-col bg-white dark:bg-gray-950 transition-all duration-300",
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
  const displayName = conversation.name || otherParticipants.map(p => p?.fullName || p?.username).join(', ') || 'Conversation';
  const initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div
      className={cn(
        "p-3 cursor-pointer border-l-4 transition-all hover:bg-gray-100 dark:hover:bg-gray-800",
        isSelected ? "bg-blue-50 dark:bg-blue-900/30 border-blue-500" : "border-transparent"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={otherParticipants[0]?.avatarUrl} />
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center">
            <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{displayName}</p>
            {conversation.lastMessage && (
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(conversation.lastMessage.createdAt || Date.now()), { addSuffix: false })}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {conversation.lastMessage?.content || 'No messages yet'}
          </p>
        </div>
        {(conversation.unread || 0) > 0 && (
          <span className="bg-blue-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {conversation.unread}
          </span>
        )}
      </div>
    </div>
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
    queryFn: async () => {
      const res = await fetch(`/api/chat/messages/${conversation.id}`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    },
    enabled: !!conversation.id,
    refetchInterval: 3000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (err) => console.error("Failed to send message:", err),
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: uploadChatAttachment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
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
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const otherParticipants = conversation.participants?.filter((p: any) => p?.id !== currentUser.id) || [];
  const displayName = conversation.name || otherParticipants.map((p: any) => p?.fullName || p?.username).join(', ') || 'Conversation';

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
        toast({ title: "Error", description: "You must be logged in to use Ask AI.", variant: "destructive" });
        return;
      }

      toast({ title: "Ask AI", description: "Analyzing conversation..." });

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
        throw new Error(data?.message || "Failed to get AI response");
      }

      const suggestedReply = data?.result?.suggestedReply || "";
      const summary = data?.result?.summary || "";
      const nextActions = Array.isArray(data?.result?.nextActions) ? data.result.nextActions : [];

      if (suggestedReply) {
        setMessage(suggestedReply);
      }

      toast({
        title: "AI suggestion ready",
        description: summary || nextActions[0] || "Suggested reply added to message box.",
      });
    } catch (error: any) {
      toast({
        title: "Ask AI failed",
        description: error.message || "Could not process AI request.",
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
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden -ml-2 rounded-full"
              onClick={onBack}
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
          )}
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate max-w-[150px] md:max-w-none">
                {displayName}
              </h3>
              {displayName.toLowerCase().includes('ai') && (
                <Badge variant="secondary" className="bg-blue-50 text-blue-600 text-[10px] h-4">AI</Badge>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {conversation.participants?.length || 0} participants
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-[100] w-56 bg-white dark:bg-gray-900 border shadow-xl rounded-xl">
            <DropdownMenuItem onClick={markUnread}>Mark as unread</DropdownMenuItem>
            <DropdownMenuItem onClick={openPopup}>Open in a pop-up</DropdownMenuItem>
            <DropdownMenuItem onClick={muteConversation}>Mute</DropdownMenuItem>
            <DropdownMenuItem onClick={notificationSettings}>Notifications</DropdownMenuItem>
            <DropdownMenuItem onClick={copyConversationId}>Copy conversation ID</DropdownMenuItem>
            <DropdownMenuItem onClick={askAI}>Ask AI</DropdownMenuItem>
            <DropdownMenuItem onClick={hideConversation}>Hide conversation</DropdownMenuItem>
            <DropdownMenuItem onClick={deleteConversation} className="text-red-600 dark:text-red-400">Delete conversation</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1 p-4 bg-gray-50 dark:bg-gray-950">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-4">
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

      <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 relative">
        {showEmojiPicker && (
          <div className="absolute bottom-20 right-20 z-50">
            <EmojiPicker onEmojiClick={addEmoji} />
          </div>
        )}

        {selectedFile && (
          <div className="mb-2 flex items-center justify-between rounded-lg border px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800">
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

        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleAttachmentSelect}
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadAttachmentMutation.isPending}
          >
            <Paperclip className="w-5 h-5 text-gray-500" />
          </Button>

          <Input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
          >
            <Smile className="w-5 h-5 text-gray-500" />
          </Button>

          <Button
            type="submit"
            disabled={
              sendMessageMutation.isPending ||
              uploadAttachmentMutation.isPending ||
              (!message.trim() && !selectedFile)
            }
            className="shrink-0 bg-blue-600 hover:bg-blue-700"
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
    <div className={cn("flex", isOwnMessage ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-4 py-2 shadow-sm",
          isOwnMessage
            ? "bg-blue-600 text-white rounded-br-md"
            : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md border"
        )}
      >
        {!isOwnMessage && (
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
            {message.sender?.fullName || message.sender?.username || 'Unknown'}
          </p>
        )}

        <p className="text-sm whitespace-pre-wrap">{message.content}</p>

        {Array.isArray(message.attachments) && message.attachments.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.attachments.map((att: any) => (
              <a
                key={att.id}
                href={att.fileUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "block text-xs underline break-all",
                  isOwnMessage ? "text-blue-100" : "text-blue-600 dark:text-blue-400"
                )}
              >
                {att.fileName}
              </a>
            ))}
          </div>
        )}

        <p className={cn("text-xs mt-1", isOwnMessage ? "text-blue-200" : "text-gray-400")}>
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {message.isEdited && <span className="ml-1">(edited)</span>}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ onNewConversation }: { onNewConversation: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-gray-50 dark:bg-gray-950">
      <div className="w-24 h-24 mb-4 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
        <Users className="w-12 h-12 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Welcome to Team Chat</h3>
      <p className="text-sm mb-4">Select a conversation or start a new one</p>
      <Button onClick={onNewConversation}>
        <Plus className="w-4 h-4 mr-2" />
        New Conversation
      </Button>
    </div>
  );
}

function ChatLoadingSkeleton() {
  return (
    <div className="flex h-[calc(100vh-120px)] m-4 rounded-xl border overflow-hidden">
      <div className="w-80 border-r bg-gray-50 dark:bg-gray-900 p-4 space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
        <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 p-3">
            <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-2/3 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex-1 bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    </div>
  );
}