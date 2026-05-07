import { useEffect, useRef, useState } from "react";
import { Bell, Camera, Save, Trash2, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import { removeChatUserAvatar, updateChatUserProfile, uploadChatUserAvatar } from "@/lib/chat";

export function UserProfileMenu() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName || "");
    setUsername(user.username || "");
    setAvatarUrl(user.avatarUrl || "");
  }, [user]);

  const initials = (fullName || username || user?.email || "CH").slice(0, 2).toUpperCase();

  const saveProfile = async () => {
    if (!user?.id) return;

    try {
      setIsSaving(true);
      const updatedUser = await updateChatUserProfile({
        userId: user.id,
        fullName,
        username,
        avatarUrl,
      });

      setFullName(updatedUser.fullName || "");
      setUsername(updatedUser.username || "");
      setAvatarUrl(updatedUser.avatarUrl || "");
      queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
      queryClient.invalidateQueries({ queryKey: ["friends", user.id] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Profile updated", description: "Your chat profile was saved." });
      setOpen(false);
    } catch (error) {
      toast({
        title: "Profile update failed",
        description: error instanceof Error ? error.message : "Could not save profile.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!user?.id) return;

    try {
      setIsUploading(true);
      const updatedUser = await uploadChatUserAvatar({ userId: user.id, file });
      setAvatarUrl(updatedUser.avatarUrl || "");
      queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
      queryClient.invalidateQueries({ queryKey: ["friends", user.id] });
      toast({ title: "Display picture updated", description: "Your new avatar is ready." });
    } catch (error) {
      toast({
        title: "Avatar upload failed",
        description: error instanceof Error ? error.message : "Could not upload avatar.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const removeAvatar = async () => {
    if (!user?.id) return;

    try {
      setIsRemoving(true);
      const updatedUser = await removeChatUserAvatar(user.id);
      setAvatarUrl(updatedUser.avatarUrl || "");
      queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
      queryClient.invalidateQueries({ queryKey: ["friends", user.id] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Display picture removed", description: "Your avatar was cleared." });
    } catch (error) {
      toast({
        title: "Remove picture failed",
        description: error instanceof Error ? error.message : "Could not remove avatar.",
        variant: "destructive",
      });
    } finally {
      setIsRemoving(false);
    }
  };

  const enableNotifications = async () => {
    if (!("Notification" in window)) {
      toast({ title: "Notifications unavailable", description: "This browser does not support desktop notifications." });
      return;
    }

    const permission = await Notification.requestPermission();
    toast({
      title: permission === "granted" ? "Notifications enabled" : "Notifications not enabled",
      description: permission === "granted"
        ? "You will see message previews while Codical Health is open or in the background."
        : "Browser permission was not granted.",
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="co-glow-capsule flex items-center gap-2 px-1.5 sm:px-2 py-1.5 rounded-full border border-[var(--co-line)] bg-white/5 hover:bg-white/10 transition-colors appFocusRing">
            <span className="relative">
              <Avatar className="w-8 h-8">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="text-white text-xs font-black bg-gradient-to-br from-[var(--co-cyan)] to-[var(--co-blue)]">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-gray-950" />
            </span>
            <div className="hidden sm:block min-w-0 pr-2 text-left">
              <p className="text-xs font-bold text-[var(--co-ink)] leading-none truncate max-w-[140px]">
                {fullName || username || "Account"}
              </p>
              <p className="text-[10px] text-[var(--co-muted)] leading-none mt-1">
                Profile and online
              </p>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-[100] w-56 bg-white dark:bg-gray-900 border shadow-xl rounded-xl">
          <DropdownMenuItem onClick={() => setOpen(true)}>
            <UserRound className="w-4 h-4 mr-2" />
            Edit profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={enableNotifications}>
            <Bell className="w-4 h-4 mr-2" />
            Enable notifications
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserRound className="w-5 h-5" />
              Chat Profile
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-black">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadAvatar(file);
                    event.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Camera className="w-4 h-4" />
                  {isUploading ? "Uploading..." : "Change picture"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 text-red-600 hover:text-red-700"
                  onClick={removeAvatar}
                  disabled={isRemoving || isUploading || !avatarUrl}
                >
                  <Trash2 className="w-4 h-4" />
                  {isRemoving ? "Removing..." : "Remove"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Display name</label>
              <Input value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Username</label>
              <Input value={username} onChange={(event) => setUsername(event.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Picture URL</label>
              <Input value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} />
            </div>

            <Button onClick={saveProfile} disabled={isSaving || !fullName.trim()} className="w-full gap-2">
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save profile"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
