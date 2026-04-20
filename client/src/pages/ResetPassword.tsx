import { useEffect, useState } from "react";
import { Eye, EyeOff, Lock, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { AuthCard, AuthShell } from "@/components/auth/AuthShell";

export function ResetPassword() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [ready, setReady] = useState(false);

  // Supabase sets a recovery session when user lands here from the email.
  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setReady(Boolean(data.session));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setReady(Boolean(session));
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const update = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        toast({ title: "Could not update password", description: error.message, variant: "destructive" });
        return;
      }

      toast({ title: "Password updated", description: "You can now continue to your dashboard." });
      setLocation("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const fieldWrap =
    "flex items-center gap-3 h-12 px-4 rounded-xl border transition-all duration-300 " +
    "bg-[rgba(255,255,255,0.10)] border-[rgba(255,255,255,0.26)] backdrop-blur-[14px]";
  const fieldActive =
    "border-[rgba(74,222,128,0.42)] shadow-[0_0_0_4px_rgba(74,222,128,0.10)]";

  return (
    <AuthShell>
      <AuthCard
        title="Create a new password"
        subtitle="Choose a strong password to secure your account."
        footer={
          <div className="text-center text-[13px] font-black tracking-[-0.01em] text-[hsl(var(--muted-foreground))]">
            <Link href="/login" className="underline underline-offset-4 text-[hsl(var(--foreground))]">
              Back to sign in
            </Link>
          </div>
        }
      >
        {!ready ? (
          <div className="rounded-2xl border border-[rgba(255,255,255,0.26)] bg-[rgba(255,255,255,0.10)] p-5">
            <div className="text-[14px] font-black text-[hsl(var(--foreground))]">Open the reset link</div>
            <p className="mt-2 text-[13px] leading-[1.7] text-[hsl(var(--muted-foreground))]">
              Please open the password reset link from your email. If you already did, wait a moment and try again.
            </p>
          </div>
        ) : (
          <form onSubmit={update} className="grid gap-4">
            <div>
              <label className="block text-[11px] font-black tracking-[0.16em] uppercase text-[hsl(var(--muted-foreground))] mb-2">
                New password
              </label>
              <div className={fieldWrap + (focused ? " " + fieldActive : "")}>
                <Lock className={"w-4 h-4 flex-shrink-0 " + (focused ? "text-[rgba(74,222,128,0.95)]" : "text-[hsl(var(--muted-foreground))]")} />
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                  placeholder="At least 6 characters"
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  className="flex-1 border-none outline-none text-[14px] font-black tracking-[-0.01em] text-[hsl(var(--foreground))] bg-transparent placeholder:text-[hsl(var(--muted-foreground))]"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="ln-btn ln-btnPrimary ln-magnetic w-full">
              {isLoading ? (
                <span>Updating…</span>
              ) : (
                <>
                  <span>Update password</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}
      </AuthCard>
    </AuthShell>
  );
}
