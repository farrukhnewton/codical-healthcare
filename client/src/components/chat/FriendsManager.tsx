import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { UserSearch, UserPlus, Check, X, Search, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

interface FriendsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: number;
}

export function FriendsManager({ open, onOpenChange, currentUserId }: FriendsManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  // Search for users
  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ['userSearch', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const res = await fetch(`/api/chat/users/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: searchQuery.length > 2,
  });

  // Pending requests
  const { data: pendingRequests = [], isLoading: isLoadingRequests } = useQuery({
    queryKey: ['friendRequests', currentUserId],
    queryFn: async () => {
      const res = await fetch(`/api/chat/friend-requests/${currentUserId}`);
      if (!res.ok) throw new Error('Failed to fetch requests');
      return res.json();
    },
    enabled: open,
  });

  const sendRequestMutation = useMutation({
    mutationFn: async (receiverId: number) => {
      const res = await fetch('/api/chat/friend-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: currentUserId, receiverId }),
      });
      if (!res.ok) throw new Error('Failed to send request');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Request Sent', description: 'Friend request sent successfully.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const handleRequestMutation = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: number; status: 'accepted' | 'rejected' }) => {
      const res = await fetch(`/api/chat/friend-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update request');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['friendRequests', currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast({ 
        title: variables.status === 'accepted' ? 'Request Accepted' : 'Request Rejected', 
        description: variables.status === 'accepted' ? 'You are now friends!' : 'Request dismissed.' 
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
        <DialogHeader className="p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <UserSearch className="w-6 h-6" />
            Find Colleagues
          </DialogTitle>
          <p className="text-blue-100 text-sm opacity-90">Search for users and manage friend requests</p>
        </DialogHeader>

        <div className="p-4 space-y-6">
          {/* Search Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Search Members</h4>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name, username or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-11 bg-gray-50 dark:bg-gray-800 border-none shadow-inner rounded-xl"
              />
            </div>

            <ScrollArea className="max-h-[200px]">
              <div className="space-y-2">
                {isSearching && <p className="text-center py-4 text-sm text-gray-500">Searching...</p>}
                {!isSearching && searchQuery.length > 2 && searchResults.length === 0 && (
                  <p className="text-center py-4 text-sm text-gray-500">No users found.</p>
                )}
                {searchResults.map((user: any) => (
                    user.id !== currentUserId && (
                      <div key={user.id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border-2 border-white dark:border-gray-700 shadow-sm">
                            <AvatarImage src={user.avatarUrl} />
                            <AvatarFallback className="bg-blue-100 text-blue-600 font-bold uppercase">
                              {(user.fullName || user.username || 'U')[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{user.fullName || user.username}</p>
                            <p className="text-xs text-gray-500">@{user.username}</p>
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="secondary"
                          className="rounded-full gap-2 bg-blue-50 text-blue-600 hover:bg-blue-100 border-none"
                          onClick={() => sendRequestMutation.mutate(user.id)}
                          disabled={sendRequestMutation.isPending}
                        >
                          <UserPlus className="w-4 h-4" />
                          Add
                        </Button>
                      </div>
                    )
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Pending Requests Section */}
          {pendingRequests.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                Pending Requests
                <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  {pendingRequests.length}
                </span>
              </h4>
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {pendingRequests.map((request: any) => (
                    <div key={request.id} className="flex items-center justify-between p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-50 dark:border-blue-900/20">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-white">
                          <AvatarImage src={request.sender?.avatarUrl} />
                          <AvatarFallback className="bg-indigo-100 text-indigo-600 font-bold">
                            {(request.sender?.fullName || request.sender?.username || 'U')[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{request.sender?.fullName || request.sender?.username}</p>
                          <div className="flex items-center gap-1 text-[10px] text-gray-500">
                             <Clock className="w-3 h-3" />
                             Sent Recently
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 rounded-full bg-red-50 text-red-600 hover:bg-red-100"
                          onClick={() => handleRequestMutation.mutate({ requestId: request.id, status: 'rejected' })}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          className="h-8 w-8 rounded-full bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleRequestMutation.mutate({ requestId: request.id, status: 'accepted' })}
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
