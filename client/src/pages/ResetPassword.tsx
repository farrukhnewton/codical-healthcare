import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Link2, Lock } from "lucide-react";
import { Link, useLocation } from "wouter";
import { AuthCard, AuthField, AuthNotice, AuthShell } from "@/components/auth/AuthShell";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export function ResetPassword() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [ready, setReady] = useState(false);

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

  const update = async (event: FormEvent) => {
    event.preventDefault();
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

  return (
    <AuthShell>
      <AuthCard
        title="Create a new password"
        subtitle="Choose a strong password to secure your account."
        footer={
          <div className="auth-switch-copy">
            <Link href="/login">Back to sign in</Link>
          </div>
        }
      >
        {!ready ? (
          <AuthNotice icon={<Link2 size={20} />} title="Open the reset link">
            Please open the password reset link from your email. If you already did, wait a moment and try again.
          </AuthNotice>
        ) : (
          <form onSubmit={update} className="auth-form">
            <AuthField
              id="reset-password"
              label="New password"
              type={show ? "text" : "password"}
              value={password}
              onChange={setPassword}
              minLength={6}
              required
              autoComplete="new-password"
              placeholder="At least 6 characters"
              icon={<Lock size={18} />}
              trailing={
                <button
                  type="button"
                  onClick={() => setShow((current) => !current)}
                  className="auth-icon-button"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />

            <button type="submit" disabled={isLoading} className="auth-submit-button">
              <span>{isLoading ? "Updating..." : "Update password"}</span>
              {!isLoading ? <ArrowRight size={18} /> : null}
            </button>
          </form>
        )}
      </AuthCard>
    </AuthShell>
  );
}
