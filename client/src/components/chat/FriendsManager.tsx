import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { UserSearch, UserPlus, Check, X, Search, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface FriendsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: number;
}

export function FriendsManager({ open, onOpenChange, currentUserId }: FriendsManagerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ["userSearch", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const res = await fetch("/api/chat/users/search?q=" + encodeURIComponent(searchQuery));
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: searchQuery.length > 2,
  });

  const { data: pendingRequests = [] } = useQuery({
    queryKey: ["friendRequests", currentUserId],
    queryFn: async () => {
      const res = await fetch("/api/chat/friend-requests/" + currentUserId);
      if (!res.ok) throw new Error("Failed to fetch requests");
      return res.json();
    },
    enabled: open,
  });

  const sendRequestMutation = useMutation({
    mutationFn: async (receiverId: number) => {
      const res = await fetch("/api/chat/friend-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderId: currentUserId, receiverId }),
      });
      if (!res.ok) throw new Error("Failed to send request");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Request Sent", description: "Friend request sent successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleRequestMutation = useMutation({
    mutationFn: async ({
      requestId,
      status,
    }: {
      requestId: number;
      status: "accepted" | "rejected";
    }) => {
      const res = await fetch("/api/chat/friend-requests/" + requestId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update request");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["friendRequests", currentUserId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast({
        title: variables.status === "accepted" ? "Request Accepted" : "Request Rejected",
        description: variables.status === "accepted" ? "You are now friends!" : "Request dismissed.",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden appGlassStrong appCard border border-border/60 dark:border-border/60 shadow-2xl">
        <DialogHeader className="p-6 border-b border-border/60">
          <DialogTitle className="flex items-center gap-2 text-lg font-black text-foreground">
            <span className="w-9 h-9 rounded-xl appGlass flex items-center justify-center border border-border/60">
              <UserSearch className="w-5 h-5 text-emerald-400" />
            </span>
            Find Colleagues
          </DialogTitle>
          <p className="text-muted-foreground text-sm mt-1">
            Search members and manage friend requests
          </p>
        </DialogHeader>

        <div className="p-4 space-y-6">
          {/* Search Section */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-muted-foreground/70 uppercase tracking-[0.22em]">
              Search Members
            </h4>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
              <Input
                placeholder="Search by name, username or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <ScrollArea className="max-h-[200px]">
              <div className="space-y-2 pr-2">
                {isSearching && (
                  <p className="text-center py-4 text-sm text-muted-foreground">
                    Searching…
                  </p>
                )}

                {!isSearching && searchQuery.length > 2 && searchResults.length === 0 && (
                  <p className="text-center py-4 text-sm text-muted-foreground">
                    No users found.
                  </p>
                )}

                {searchResults.map(
                  (user: any) =>
                    user.id !== currentUserId && (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 rounded-xl appGlass appCard border border-border/60 hover:bg-background/40 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-10 w-10 border border-border/60">
                            <AvatarImage src={user.avatarUrl} />
                            <AvatarFallback className="bg-background/60 text-foreground font-black uppercase">
                              {(user.fullName || user.username || "U")[0]}
                            </AvatarFallback>
                          </Avatar>

                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">
                              {user.fullName || user.username}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full gap-2"
                          onClick={() => sendRequestMutation.mutate(user.id)}
                          disabled={sendRequestMutation.isPending}
                        >
                          <UserPlus className="w-4 h-4" />
                          Add
                        </Button>
                      </div>
                    )
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Pending Requests Section */}
          {pendingRequests.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-muted-foreground/70 uppercase tracking-[0.22em] flex items-center gap-2">
                Pending Requests
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-primary/15 text-primary">
                  {pendingRequests.length}
                </span>
              </h4>

              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2 pr-2">
                  {pendingRequests.map((request: any) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-3 rounded-xl appGlass appCard border border-border/60"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10 border border-border/60">
                          <AvatarImage src={request.sender?.avatarUrl} />
                          <AvatarFallback className="bg-background/60 text-foreground font-black uppercase">
                            {(request.sender?.fullName || request.sender?.username || "U")[0]}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">
                            {request.sender?.fullName || request.sender?.username}
                          </p>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80">
                            <Clock className="w-3 h-3" />
                            Sent recently
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 rounded-full text-destructive border-border/60 hover:bg-destructive/10"
                          onClick={() =>
                            handleRequestMutation.mutate({
                              requestId: request.id,
                              status: "rejected",
                            })
                          }
                        >
                          <X className="w-4 h-4" />
                        </Button>

                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 rounded-full text-emerald-300 border-border/60 hover:bg-emerald-500/10"
                          onClick={() =>
                            handleRequestMutation.mutate({
                              requestId: request.id,
                              status: "accepted",
                            })
                          }
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}



