import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Shield, Lock, Zap, Mail, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Link, useLocation } from "wouter";
import { AuthCard, AuthShell } from "@/components/auth/AuthShell";

type Mode = "password" | "magic";

export function Signup() {
  const [mode, setMode] = useState<Mode>("password");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signupDone, setSignupDone] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // If user is already signed in (Google, magic link, etc.), go to app.
  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (data.session) setLocation("/dashboard");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      if (session) setLocation("/dashboard");
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [setLocation]);

  const handleGoogle = async () => {
    if (isLoading) return;
    setIsLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/login` },
    });

    if (error) {
      toast({ title: "Google sign-up failed", description: error.message, variant: "destructive" });
      setIsLoading(false);
    }
  };

  const handleSignupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/login` },
      });

      if (error) {
        toast({ title: "Signup failed", description: error.message, variant: "destructive" });
        return;
      }

      setSignupDone(true);
      toast({ title: "Check your email", description: "Confirm your account to finish signing up." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) {
        toast({ title: "Could not send link", description: error.message, variant: "destructive" });
        return;
      }

      setSignupDone(true);
      toast({ title: "Check your email", description: "We sent a secure sign-up link." });
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
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <AuthCard
          title="Create your account"
          subtitle="Start with Google, a secure email link, or password."
          footer={
            <div className="grid gap-4">
              <div className="flex items-center justify-center gap-4 flex-wrap">
                {[
                  { icon: Shield, label: "HIPAA-ready" },
                  { icon: Lock, label: "256-bit TLS" },
                  { icon: Zap, label: "SOC 2-aligned" },
                ].map((badge, i) => (
                  <div
                    key={i}
                    className="inline-flex items-center gap-2 text-[12px] font-black tracking-[-0.01em] text-[hsl(var(--muted-foreground))]"
                  >
                    <badge.icon className="w-4 h-4 text-[rgba(56,189,248,0.85)]" />
                    {badge.label}
                  </div>
                ))}
              </div>

              <div className="text-center text-[13px] font-black tracking-[-0.01em] text-[hsl(var(--muted-foreground))]">
                Already have an account?{" "}
                <Link href="/login" className="underline underline-offset-4 text-[hsl(var(--foreground))]">
                  Sign in
                </Link>
              </div>
            </div>
          }
        >
          {/* Google */}
          <div className="grid gap-3">
            <button type="button" onClick={handleGoogle} disabled={isLoading} className="ln-btn ln-btnSecondary ln-magnetic w-full">
              Continue with Google
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px bg-[rgba(255,255,255,0.26)] flex-1" />
              <div className="text-[11px] font-black tracking-[0.16em] uppercase text-[hsl(var(--muted-foreground))]">
                or
              </div>
              <div className="h-px bg-[rgba(255,255,255,0.26)] flex-1" />
            </div>
          </div>

          {signupDone ? (
            <div className="mt-6 rounded-2xl border border-[rgba(255,255,255,0.26)] bg-[rgba(255,255,255,0.10)] p-5 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl grid place-items-center border border-[rgba(74,222,128,0.25)] bg-[rgba(74,222,128,0.12)]">
                <Mail className="w-5 h-5 text-[rgba(16,185,129,0.95)]" />
              </div>
              <div className="mt-4 text-[16px] font-black text-[hsl(var(--foreground))]">Check your email</div>
              <p className="mt-2 text-[13px] leading-[1.7] text-[hsl(var(--muted-foreground))]">
                We sent a secure link to <span className="font-black text-[hsl(var(--foreground))]">{email}</span>
              </p>
              <div className="mt-5">
                <Link href="/login" className="ln-btn ln-btnSecondary ln-magnetic w-full inline-flex">
                  Back to login
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Mode toggle */}
              <div className="mt-5 grid grid-cols-2 gap-2">
                {(["password", "magic"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={
                      "h-10 rounded-xl border font-black text-[12px] tracking-[0.12em] uppercase transition-all " +
                      (mode === m
                        ? "bg-[rgba(74,222,128,0.10)] border-[rgba(74,222,128,0.30)] text-[hsl(var(--foreground))]"
                        : "bg-[rgba(255,255,255,0.06)] border-[rgba(255,255,255,0.18)] text-[hsl(var(--muted-foreground))] hover:bg-[rgba(255,255,255,0.10)]")
                    }
                  >
                    {m === "password" ? "Password" : "Email link"}
                  </button>
                ))}
              </div>

              <form onSubmit={mode === "password" ? handleSignupPassword : handleSignupMagic} className="mt-4 grid gap-4">
                <div>
                  <label className="block text-[11px] font-black tracking-[0.16em] uppercase text-[hsl(var(--muted-foreground))] mb-2">
                    Email address
                  </label>
                  <div className={fieldWrap + (focusedField === "email" ? " " + fieldActive : "")}>
                    <Mail className={"w-4 h-4 flex-shrink-0 " + (focusedField === "email" ? "text-[rgba(74,222,128,0.95)]" : "text-[hsl(var(--muted-foreground))]")} />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@company.com"
                      onFocus={() => setFocusedField("email")}
                      onBlur={() => setFocusedField(null)}
                      className="flex-1 border-none outline-none text-[14px] font-black tracking-[-0.01em] text-[hsl(var(--foreground))] bg-transparent placeholder:text-[hsl(var(--muted-foreground))]"
                    />
                  </div>
                </div>

                {mode === "password" && (
                  <div>
                    <label className="block text-[11px] font-black tracking-[0.16em] uppercase text-[hsl(var(--muted-foreground))] mb-2">
                      Password
                    </label>
                    <div className={fieldWrap + (focusedField === "password" ? " " + fieldActive : "")}>
                      <Lock className={"w-4 h-4 flex-shrink-0 " + (focusedField === "password" ? "text-[rgba(74,222,128,0.95)]" : "text-[hsl(var(--muted-foreground))]")} />
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="Create a password (min 6 chars)"
                        onFocus={() => setFocusedField("password")}
                        onBlur={() => setFocusedField(null)}
                        className="flex-1 border-none outline-none text-[14px] font-black tracking-[-0.01em] text-[hsl(var(--foreground))] bg-transparent placeholder:text-[hsl(var(--muted-foreground))]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <button type="submit" disabled={isLoading} className="ln-btn ln-btnPrimary ln-magnetic w-full">
                  {isLoading ? (
                    <span>Working…</span>
                  ) : (
                    <>
                      <UserPlus size={18} />
                      <span>{mode === "password" ? "Create account" : "Email me a link"}</span>
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </AuthCard>
      </motion.div>
    </AuthShell>
  );
}
