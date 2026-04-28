import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bell, UserCheck, UserX } from "lucide-react";
import { supabase } from "../lib/supabase";

type FriendRequest = {
  id: number;
  receiver_id: string | number;
  status: "pending" | "accepted" | "rejected" | string;
  sender?: { id?: number; name?: string; avatar_url?: string } | null;
};

export const NotificationBell = ({ userId }: { userId: string | number }) => {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const uid = useMemo(() => String(userId ?? ""), [userId]);

  useEffect(() => {
    if (!uid) return;

    const fetchRequests = async () => {
      const { data } = await supabase
        .from("friend_requests")
        .select("*, sender:users(id, name, avatar_url)")
        .eq("receiver_id", uid)
        .eq("status", "pending");

      setRequests((data as any) || []);
    };

    fetchRequests();

    const channel = supabase
      .channel(`friend-reqs-${uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friend_requests",
          filter: `receiver_id=eq.${uid}`,
        },
        fetchRequests
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid]);

  // Click outside to close.
  useEffect(() => {
    if (!isOpen) return;

    const onDown = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      setIsOpen(false);
    };

    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [isOpen]);

  const setStatus = async (id: number, status: "accepted" | "rejected") => {
    await supabase.from("friend_requests").update({ status }).eq("id", id);
    setRequests((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-9 h-9 rounded-xl appGlass appCard flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors appFocusRing"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {requests.length > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border border-white/40 dark:border-white/15 animate-pulse" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 appGlassStrong appCard border border-white/15 dark:border-white/10 z-50 p-4 shadow-2xl">
          <h3 className="font-black text-foreground mb-3 text-sm uppercase tracking-wider">
            Friend Requests
          </h3>

          <div className="h-px bg-border/50 mb-3" />

          {requests.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">
              No new requests
            </p>
          ) : (
            <div className="space-y-2">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 rounded-xl appGlass appCard border border-white/10 dark:border-white/10"
                >
                  <span className="text-sm font-bold text-foreground truncate pr-3">
                    {req.sender?.name || "New Member"}
                  </span>

                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => setStatus(req.id, "accepted")}
                      className="p-2 rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition-colors appFocusRing"
                      aria-label="Accept"
                      title="Accept"
                    >
                      <UserCheck size={16} />
                    </button>
                    <button
                      onClick={() => setStatus(req.id, "rejected")}
                      className="p-2 rounded-lg bg-border/50 text-muted-foreground hover:bg-background/60 hover:text-foreground transition-colors appFocusRing"
                      aria-label="Decline"
                      title="Decline"
                    >
                      <UserX size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
