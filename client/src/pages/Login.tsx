import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Shield, Zap, Lock, Mail, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Link, useLocation } from "wouter";
import { AuthCard, AuthShell } from "@/components/auth/AuthShell";

type Mode = "password" | "magic";

export function Login() {
  const [mode, setMode] = useState<Mode>("password");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const [gsiReady, setGsiReady] = useState(false);
  const gsiInitOnce = useRef(false);

  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Don’t navigate to /dashboard until a session exists (prevents "second attempt" weirdness)
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

  // Google One Tap + native button (free). Requires VITE_GOOGLE_CLIENT_ID and gsi/client in index.html.
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    if (!clientId) return;
    if (gsiInitOnce.current) return;

    let cancelled = false;
    let tries = 0;
    let timer: number | undefined;

    const start = () => {
      if (cancelled) return;

      const google = (window as any).google;
      if (!google?.accounts?.id) {
        tries += 1;
        if (tries > 30) return; // ~6s max
        timer = window.setTimeout(start, 200);
        return;
      }

      gsiInitOnce.current = true;

      google.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp: any) => {
          const token = resp?.credential as string | undefined;
          if (!token) return;

          setIsLoading(true);
          setLoginError("");

          try {
            const { error } = await supabase.auth.signInWithIdToken({
              provider: "google",
              token,
            });

            if (error) {
              setLoginError(error.message);
              toast({ title: "Google sign-in failed", description: error.message, variant: "destructive" });
              return;
            }

            toast({ title: "Signed in with Google", description: "Loading your workspace..." });
            // Redirect handled by auth listener above.
          } finally {
            setIsLoading(false);
          }
        },
        cancel_on_tap_outside: false,
        auto_select: true,
      });

      const btn = document.getElementById("gsiBtn");
      if (btn) {
        btn.innerHTML = "";
        google.accounts.id.renderButton(btn, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: 360,
        });
        setGsiReady(true);
      }

      google.accounts.id.prompt();
    };

    start();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      try {
        (window as any).google?.accounts?.id?.cancel();
      } catch {
        // ignore
      }
    };
  }, [toast]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setLoginError("");

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLoginError(error.message);
        toast({ title: "Login failed", description: error.message, variant: "destructive" });
        return;
      }

      toast({ title: "Welcome back!", description: "Loading your workspace..." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setLoginError("");

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/login` },
      });

      if (error) {
        setLoginError(error.message);
        toast({ title: "Could not send link", description: error.message, variant: "destructive" });
        return;
      }

      toast({ title: "Check your email", description: "We sent you a secure sign-in link." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleRedirect = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setLoginError("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/login` },
    });

    if (error) {
      setLoginError(error.message);
      toast({ title: "Google sign-in failed", description: error.message, variant: "destructive" });
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
          title="Welcome back"
          subtitle="Sign in with Google, a secure email link, or your password."
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
                {"Don't have an account? "}
                <Link href="/signup" className="underline underline-offset-4 text-[hsl(var(--foreground))]">
                  Request access
                </Link>
              </div>
            </div>
          }
        >
          {/* Google */}
          <div className="grid gap-3">
            <div id="gsiBtn" className="flex justify-center" />

            {!gsiReady && (
              <button type="button" onClick={handleGoogleRedirect} disabled={isLoading} className="ln-btn ln-btnSecondary ln-magnetic w-full">
                Continue with Google
              </button>
            )}

            <div className="flex items-center gap-3">
              <div className="h-px bg-[rgba(255,255,255,0.26)] flex-1" />
              <div className="text-[11px] font-black tracking-[0.16em] uppercase text-[hsl(var(--muted-foreground))]">
                or
              </div>
              <div className="h-px bg-[rgba(255,255,255,0.26)] flex-1" />
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {loginError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 p-3 rounded-xl border border-[rgba(244,63,94,0.30)] bg-[rgba(244,63,94,0.08)]"
              >
                <p className="text-[13px] font-black text-[hsl(var(--foreground))]">Sign-in failed</p>
                <p className="mt-1 text-[13px] leading-[1.6] text-[hsl(var(--muted-foreground))]">{loginError}</p>
              </motion.div>
            )}
          </AnimatePresence>

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
                {m === "password" ? "Password" : "Magic link"}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={mode === "password" ? handlePasswordLogin : handleMagicLink} className="mt-4 grid gap-4">
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
                  autoComplete="email"
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
                    autoComplete="current-password"
                    placeholder="Your password"
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

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-[13px] font-black text-[hsl(var(--foreground))] underline underline-offset-4">
                Forgot password?
              </Link>
            </div>

            <button type="submit" disabled={isLoading} className="ln-btn ln-btnPrimary ln-magnetic w-full">
              {isLoading ? (
                <>
                  <span>Working…</span>
                </>
              ) : (
                <>
                  <span>{mode === "password" ? "Sign in" : "Email me a link"}</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </AuthCard>
      </motion.div>
    </AuthShell>
  );
}
