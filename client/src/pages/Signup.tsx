import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Lock, Mail, UserPlus } from "lucide-react";
import { Link, useLocation } from "wouter";
import { AuthCard, AuthDivider, AuthField, AuthGoogleButton, AuthModeSwitch, AuthNotice, AuthShell, type AuthMode } from "@/components/auth/AuthShell";
import { useToast } from "@/hooks/use-toast";
import { getAuthCallbackUrl } from "@/lib/authRedirect";
import { supabase } from "@/lib/supabase";

export function Signup() {
  const [mode, setMode] = useState<AuthMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  const { toast } = useToast();
  const [, setLocation] = useLocation();

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
      options: { redirectTo: getAuthCallbackUrl() },
    });

    if (error) {
      toast({ title: "Google sign-up failed", description: error.message, variant: "destructive" });
      setIsLoading(false);
    }
  };

  const handleSignupPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: getAuthCallbackUrl() },
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

  const handleSignupMagic = async (event: FormEvent) => {
    event.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: getAuthCallbackUrl(),
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

  return (
    <AuthShell>
      <AuthCard
        title="Request access"
        subtitle="Create your account with Google, email link, or password."
        footer={
          <div className="auth-switch-copy">
            Already have an account? <Link href="/login">Sign in</Link>
          </div>
        }
      >
        <AuthGoogleButton onClick={handleGoogle} disabled={isLoading} />
        <AuthDivider />

        {signupDone ? (
          <AuthNotice icon={<CheckCircle2 size={20} />} title="Check your email" tone="success">
            We sent a secure access link to <strong>{email}</strong>.
          </AuthNotice>
        ) : (
          <>
            <AuthModeSwitch value={mode} onChange={setMode} magicLabel="Email link" />
            <form onSubmit={mode === "password" ? handleSignupPassword : handleSignupMagic} className="auth-form">
              <AuthField
                id="signup-email"
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
                  id="signup-password"
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={setPassword}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
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

              <button type="submit" disabled={isLoading} className="auth-submit-button">
                {!isLoading ? <UserPlus size={18} /> : null}
                <span>{isLoading ? "Working..." : mode === "password" ? "Create account" : "Email me a link"}</span>
                {!isLoading ? <ArrowRight size={18} /> : null}
              </button>
            </form>
          </>
        )}
      </AuthCard>
    </AuthShell>
  );
}
