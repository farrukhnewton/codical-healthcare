import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldAlert } from "lucide-react";
import { Link, useLocation } from "wouter";
import { AuthCard, AuthDivider, AuthField, AuthGoogleButton, AuthModeSwitch, AuthNotice, AuthShell, type AuthMode } from "@/components/auth/AuthShell";
import { useToast } from "@/hooks/use-toast";
import { getAuthCallbackUrl } from "@/lib/authRedirect";
import { supabase } from "@/lib/supabase";

export function Login() {
  const [mode, setMode] = useState<AuthMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");

  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    const storedError = window.sessionStorage.getItem("codical_auth_error");
    if (storedError) {
      window.sessionStorage.removeItem("codical_auth_error");
      setLoginError(storedError);
      return;
    }

    const query = location.split("?")[1];
    if (!query) return;

    const error = new URLSearchParams(query).get("error");
    if (error) setLoginError(error);
  }, [location]);

  // Wait for a confirmed session before routing into the app.
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

  const handlePasswordLogin = async (event: FormEvent) => {
    event.preventDefault();
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

      toast({ title: "Welcome back", description: "Loading your workspace..." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async (event: FormEvent) => {
    event.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setLoginError("");

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: getAuthCallbackUrl() },
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
      options: { redirectTo: getAuthCallbackUrl() },
    });

    if (error) {
      setLoginError(error.message);
      toast({ title: "Google sign-in failed", description: error.message, variant: "destructive" });
      setIsLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthCard
        title="Sign in to Codical Health"
        subtitle="Access your coding workspace securely."
        footer={
          <div className="auth-switch-copy">
            Need an account? <Link href="/signup">Request access</Link>
          </div>
        }
      >
        <AuthGoogleButton onClick={handleGoogleRedirect} disabled={isLoading} />
        <AuthDivider />
        <AuthModeSwitch value={mode} onChange={setMode} magicLabel="Email link" />

        {loginError ? (
          <AuthNotice icon={<ShieldAlert size={18} />} title="Sign-in failed" tone="danger">
            {loginError}
          </AuthNotice>
        ) : null}

        <form onSubmit={mode === "password" ? handlePasswordLogin : handleMagicLink} className="auth-form">
          <AuthField
            id="login-email"
            label="Email address"
            type="email"
            value={email}
            onChange={setEmail}
            required
            autoComplete="email"
            placeholder="you@organization.com"
            icon={<Mail size={18} />}
          />

          {mode === "password" ? (
            <AuthField
              id="login-password"
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={setPassword}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              icon={<Lock size={18} />}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="auth-icon-button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />
          ) : null}

          <div className="auth-form-row">
            <span>{mode === "magic" ? "We will email a secure sign-in link." : ""}</span>
            <Link href="/forgot-password">Forgot password?</Link>
          </div>

          <button type="submit" disabled={isLoading} className="auth-submit-button">
            <span>{isLoading ? "Working..." : mode === "password" ? "Sign in" : "Email me a link"}</span>
            {!isLoading ? <ArrowRight size={18} /> : null}
          </button>
        </form>
      </AuthCard>
    </AuthShell>
  );
}
