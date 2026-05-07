import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { io, type Socket } from "socket.io-client";
import { getConversations, sendChatUserPresence, type Message } from "@/lib/chat";
import { getMessagePreview, mergeRealtimeMessage } from "@/lib/chat-realtime";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export function ChatRealtimeBridge() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();
  const socketRef = useRef<Socket | null>(null);
  const joinedConversationIdsRef = useRef<Set<number>>(new Set());
  const locationRef = useRef(location);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: () => getConversations(user!.id),
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  const conversationRoomIds = conversations.map((conversation) => conversation.id);
  const conversationRoomKey = [...conversationRoomIds].sort((a, b) => a - b).join(",");

  useEffect(() => {
    if (!user?.id) return;

    let disposed = false;

    const markOnline = () => {
      if (disposed || document.visibilityState !== "visible") return;

      void sendChatUserPresence({ userId: user.id, isOnline: true }).catch(() => undefined);
    };

    const markOffline = () => {
      void sendChatUserPresence({ userId: user.id, isOnline: false }).catch(() => undefined);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        markOnline();
        queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
        queryClient.invalidateQueries({ queryKey: ["friends", user.id] });
        return;
      }

      markOffline();
    };

    handleVisibilityChange();

    const heartbeatId = window.setInterval(markOnline, 25_000);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);
    window.addEventListener("pagehide", markOffline);
    window.addEventListener("beforeunload", markOffline);

    return () => {
      disposed = true;
      window.clearInterval(heartbeatId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
      window.removeEventListener("pagehide", markOffline);
      window.removeEventListener("beforeunload", markOffline);
      markOffline();
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const socket = io({
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    socketRef.current = socket;

    const joinUserRooms = () => {
      socket.emit("user:online", user.id);
      joinedConversationIdsRef.current.forEach((conversationId) => {
        socket.emit("conversation:join", conversationId);
      });
    };

    const notifyIncomingMessage = (incoming: Message) => {
      const senderName = incoming.sender?.fullName || incoming.sender?.username || "New message";
      const preview = getMessagePreview(incoming);
      const isChatRoute = locationRef.current.startsWith("/chat");

      if (!isChatRoute) {
        toast({
          title: senderName,
          description: preview,
        });
      }

      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        if (document.hidden || !isChatRoute) {
          new Notification(senderName, {
            body: preview,
            icon: "/favicon.png",
          });
        }
      }
    };

    const handleIncomingMessage = (incoming: Message) => {
      mergeRealtimeMessage(incoming);
      queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });

      if (incoming.senderId !== user.id) {
        notifyIncomingMessage(incoming);
      }
    };

    const refreshChatLists = () => {
      queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
      queryClient.invalidateQueries({ queryKey: ["friendRequests", user.id] });
      queryClient.invalidateQueries({ queryKey: ["friends", user.id] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    };

    const handleNewConversation = () => {
      queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
    };

    socket.on("connect", joinUserRooms);
    socket.on("new_message", handleIncomingMessage);
    socket.on("conversation:new", handleNewConversation);
    socket.on("friend_request:new", refreshChatLists);
    socket.on("friend_request:updated", refreshChatLists);
    socket.on("user:status", refreshChatLists);
    socket.on("user:profile_updated", refreshChatLists);

    return () => {
      socket.off("connect", joinUserRooms);
      socket.off("new_message", handleIncomingMessage);
      socket.off("conversation:new", handleNewConversation);
      socket.off("friend_request:new", refreshChatLists);
      socket.off("friend_request:updated", refreshChatLists);
      socket.off("user:status", refreshChatLists);
      socket.off("user:profile_updated", refreshChatLists);
      socket.disconnect();
      socketRef.current = null;
      joinedConversationIdsRef.current.clear();
    };
  }, [user?.id]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const nextConversationIds = new Set(conversationRoomIds);

    nextConversationIds.forEach((conversationId) => {
      if (!joinedConversationIdsRef.current.has(conversationId)) {
        socket.emit("conversation:join", conversationId);
        joinedConversationIdsRef.current.add(conversationId);
      }
    });

    joinedConversationIdsRef.current.forEach((conversationId) => {
      if (!nextConversationIds.has(conversationId)) {
        socket.emit("conversation:leave", conversationId);
        joinedConversationIdsRef.current.delete(conversationId);
      }
    });
  }, [conversationRoomKey]);

  return null;
}
