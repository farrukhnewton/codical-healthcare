import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Building2, CheckCircle2, Eye, EyeOff, Lock, Mail, ShieldAlert, UserRound } from "lucide-react";
import { Link, useLocation } from "wouter";
import { AuthCard, AuthDivider, AuthField, AuthGoogleButton, AuthNotice, AuthPasswordStrength, AuthShell } from "@/components/auth/AuthShell";
import { useToast } from "@/hooks/use-toast";
import { getAuthCallbackUrl } from "@/lib/authRedirect";
import { supabase } from "@/lib/supabase";

export function Signup() {
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signupDone, setSignupDone] = useState(false);
  const [signupError, setSignupError] = useState("");

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
    setSignupError("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: getAuthCallbackUrl() },
    });

    if (error) {
      setSignupError(error.message);
      toast({ title: "Google sign-up failed", description: error.message, variant: "destructive" });
      setIsLoading(false);
    }
  };

  const passwordStrongEnough = password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);

  const nextFromIdentity = () => {
    setSignupError("");
    if (!fullName.trim() || !email.trim()) {
      setSignupError("Enter your name and work email to continue.");
      return;
    }
    setStep(2);
  };

  const nextFromSecurity = () => {
    setSignupError("");
    if (!organization.trim()) {
      setSignupError("Add your organization name to continue.");
      return;
    }
    if (!passwordStrongEnough) {
      setSignupError("Use a stronger password before continuing.");
      return;
    }
    setStep(3);
  };

  const handleSignup = async (event: FormEvent) => {
    event.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setSignupError("");
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getAuthCallbackUrl(),
          data: {
            full_name: fullName,
            organization,
          },
        },
      });

      if (error) {
        setSignupError(error.message);
        toast({ title: "Signup failed", description: error.message, variant: "destructive" });
        return;
      }

      setSignupDone(true);
      toast({ title: "Check your email", description: "Confirm your account to finish signing up." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell title="Codical Health — Request access">
      <AuthCard
        title="Request access"
        subtitle="Set up a secure Codical workspace in three short steps."
        footer={
          <div className="auth-switch-copy">
            Already have an account? <Link href="/login">Sign in</Link>
          </div>
        }
      >
        {signupDone ? (
          <AuthNotice icon={<CheckCircle2 size={20} />} title="Check your email" tone="success">
            We sent a secure confirmation link to <strong>{email}</strong>.
          </AuthNotice>
        ) : (
          <>
            <div className="auth-stepper" aria-label="Signup progress">
              {["Identity", "Security", "Confirm"].map((label, index) => {
                const current = index + 1;
                return (
                  <button
                    key={label}
                    type="button"
                    className={`${step === current ? "is-active" : ""}${step > current ? " is-complete" : ""}`}
                    onClick={() => (current < step ? setStep(current) : undefined)}
                  >
                    <span />
                    {label}
                  </button>
                );
              })}
            </div>

            {signupError ? (
              <AuthNotice icon={<ShieldAlert size={18} />} title="Check the details" tone="danger">
                {signupError}
              </AuthNotice>
            ) : null}

            {step === 1 ? (
              <form
                className="auth-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  nextFromIdentity();
                }}
              >
                <AuthGoogleButton onClick={handleGoogle} disabled={isLoading} />
                <AuthDivider />
                <AuthField
                  id="signup-name"
                  label="Full name"
                  type="text"
                  value={fullName}
                  onChange={setFullName}
                  required
                  autoComplete="name"
                  placeholder="Farrukh Yaqoob"
                  icon={<UserRound size={18} />}
                />
                <AuthField
                  id="signup-email"
                  label="Work email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  required
                  autoComplete="email"
                  placeholder="you@organization.com"
                  icon={<Mail size={18} />}
                />
                <button type="submit" className="auth-submit-button">
                  <span>Continue</span>
                  <ArrowRight size={18} />
                </button>
              </form>
            ) : null}

            {step === 2 ? (
              <form
                className="auth-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  nextFromSecurity();
                }}
              >
                <AuthField
                  id="signup-organization"
                  label="Organization"
                  type="text"
                  value={organization}
                  onChange={setOrganization}
                  required
                  autoComplete="organization"
                  placeholder="Teksoft Solutions"
                  icon={<Building2 size={18} />}
                />
                <AuthField
                  id="signup-password"
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={setPassword}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Create a strong password"
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
                <AuthPasswordStrength password={password} />
                <div className="auth-form-actions">
                  <button type="button" className="auth-secondary-button" onClick={() => setStep(1)}>Back</button>
                  <button type="submit" className="auth-submit-button">
                    <span>Continue</span>
                    <ArrowRight size={18} />
                  </button>
                </div>
              </form>
            ) : null}

            {step === 3 ? (
              <form onSubmit={handleSignup} className="auth-form">
                <div className="auth-summary-box" aria-label="Signup summary">
                  <div><span>Name</span><strong>{fullName}</strong></div>
                  <div><span>Email</span><strong>{email}</strong></div>
                  <div><span>Workspace</span><strong>{organization}</strong></div>
                </div>
                <div className="auth-form-actions">
                  <button type="button" className="auth-secondary-button" onClick={() => setStep(2)}>Back</button>
                  <button type="submit" disabled={isLoading} className="auth-submit-button">
                    <span>{isLoading ? "Creating..." : "Create account"}</span>
                    {!isLoading ? <ArrowRight size={18} /> : null}
                  </button>
                </div>
              </form>
            ) : null}
          </>
        )}
      </AuthCard>
    </AuthShell>
  );
}
