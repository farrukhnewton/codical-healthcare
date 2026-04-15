import { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Command, CommandInput, CommandList, CommandItem, CommandGroup, CommandEmpty } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createConversation } from '@/lib/chat';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { queryClient } from '@/lib/queryClient';

interface NewConversationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewConversationModal({ open, onOpenChange }: NewConversationProps) {
  const { user: currentUser } = useAuth();
  const [title, setTitle] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Fetch all users
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await fetch('/api/chat/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });

  const createConversationMutation = useMutation({
    mutationFn: createConversation,
    onSuccess: (data) => {
      toast({ title: 'Success', description: 'Conversation created.' });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      onOpenChange(false);
      setTitle('');
      setSelectedUsers([]);
      setSearchQuery('');
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const availableUsers = useMemo(() => {
    if (!users || !currentUser) return [];
    return users.filter(
      (user: any) =>
        user.id !== currentUser.id &&
        !selectedUsers.some((selected) => selected.id === user.id) &&
        (user.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         user.email?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [users, selectedUsers, searchQuery, currentUser]);

  const handleSelectUser = (user: any) => {
    setSelectedUsers([...selectedUsers, user]);
    setSearchQuery('');
  };

  const handleRemoveUser = (userId: number) => {
    setSelectedUsers(selectedUsers.filter((user) => user.id !== userId));
  };

  const handleCreate = () => {
    if (selectedUsers.length === 0) {
      toast({ description: 'Please select at least one user.', variant: 'destructive' });
      return;
    }
    if (!currentUser) {
      toast({ description: 'You must be logged in.', variant: 'destructive' });
      return;
    }
    
    // Include current user in the conversation
    const userIds = [currentUser.id, ...selectedUsers.map(u => u.id)];
    createConversationMutation.mutate({ 
      userIds, 
      name: title || undefined,
      isGroup: selectedUsers.length > 1
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            New Conversation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Input
            placeholder="Conversation name (optional for groups)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Add participants
            </label>
            <Command className="rounded-lg border bg-white dark:bg-gray-900">
              <CommandInput
                placeholder="Search by name or email..."
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList>
                <CommandEmpty>
                  {isLoadingUsers ? 'Loading users...' : 'No users found.'}
                </CommandEmpty>
                <CommandGroup heading="Users">
                  {availableUsers.slice(0, 5).map((user: any) => (
                    <CommandItem
                      key={user.id}
                      onSelect={() => handleSelectUser(user)}
                      className="cursor-pointer"
                    >
                      <Avatar className="h-8 w-8 mr-2">
                        <AvatarImage src={user.avatarUrl} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs">
                          {(user.fullName || user.username || 'U').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium">{user.fullName || user.username}</span>
                        {user.email && (
                          <span className="text-xs text-gray-500">{user.email}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>

          {selectedUsers.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Selected ({selectedUsers.length})
              </h4>
              <ScrollArea className="max-h-32">
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-full pl-2 pr-1 py-1 text-sm"
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={user.avatarUrl} />
                        <AvatarFallback className="text-xs bg-blue-500 text-white">
                          {(user.fullName || user.username || 'U')[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span>{user.fullName || user.username}</span>
                      <button
                        onClick={() => handleRemoveUser(user.id)}
                        className="p-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full transition"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={handleCreate}
            disabled={createConversationMutation.isPending || selectedUsers.length === 0}
          >
            {createConversationMutation.isPending ? 'Creating...' : 'Start Conversation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
