import { useState } from "react";
import { Mail, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { AuthCard, AuthShell } from "@/components/auth/AuthShell";

export function ForgotPassword() {
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [focused, setFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast({ title: "Could not send reset email", description: error.message, variant: "destructive" });
        return;
      }

      setSent(true);
      toast({ title: "Check your email", description: "We sent a password reset link." });
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
        title="Reset your password"
        subtitle="We’ll email you a secure link to create a new password."
        footer={
          <div className="text-center text-[13px] font-black tracking-[-0.01em] text-[hsl(var(--muted-foreground))]">
            Remembered it?{" "}
            <Link href="/login" className="underline underline-offset-4 text-[hsl(var(--foreground))]">
              Back to sign in
            </Link>
          </div>
        }
      >
        {sent ? (
          <div className="rounded-2xl border border-[rgba(255,255,255,0.26)] bg-[rgba(255,255,255,0.10)] p-5 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl grid place-items-center border border-[rgba(74,222,128,0.25)] bg-[rgba(74,222,128,0.12)]">
              <Mail className="w-5 h-5 text-[rgba(16,185,129,0.95)]" />
            </div>
            <div className="mt-4 text-[16px] font-black text-[hsl(var(--foreground))]">Email sent</div>
            <p className="mt-2 text-[13px] leading-[1.7] text-[hsl(var(--muted-foreground))]">
              If an account exists for <span className="font-black text-[hsl(var(--foreground))]">{email}</span>, you’ll receive a reset link shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={sendReset} className="grid gap-4">
            <div>
              <label className="block text-[11px] font-black tracking-[0.16em] uppercase text-[hsl(var(--muted-foreground))] mb-2">
                Email address
              </label>
              <div className={fieldWrap + (focused ? " " + fieldActive : "")}>
                <Mail className={"w-4 h-4 flex-shrink-0 " + (focused ? "text-[rgba(74,222,128,0.95)]" : "text-[hsl(var(--muted-foreground))]")} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  className="flex-1 border-none outline-none text-[14px] font-black tracking-[-0.01em] text-[hsl(var(--foreground))] bg-transparent placeholder:text-[hsl(var(--muted-foreground))]"
                />
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="ln-btn ln-btnPrimary ln-magnetic w-full">
              {isLoading ? (
                <span>Sending…</span>
              ) : (
                <>
                  <span>Send reset link</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            <div className="text-center">
              <Link href="/login" className="text-[13px] font-black text-[hsl(var(--foreground))] underline underline-offset-4">
                Cancel
              </Link>
            </div>
          </form>
        )}
      </AuthCard>
    </AuthShell>
  );
}
