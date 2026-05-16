import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { Link } from "wouter";
import { AuthCard, AuthField, AuthNotice, AuthShell } from "@/components/auth/AuthShell";
import { getPasswordResetUrl } from "@/lib/authRedirect";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export function ForgotPassword() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const sendReset = async (event: FormEvent) => {
    event.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getPasswordResetUrl(),
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

  return (
    <AuthShell>
      <AuthCard
        title="Reset your password"
        subtitle="Enter your email and we will send you a secure reset link."
        footer={
          <div className="auth-switch-copy">
            Remembered it? <Link href="/login">Back to sign in</Link>
          </div>
        }
      >
        {sent ? (
          <AuthNotice icon={<CheckCircle2 size={20} />} title="Email sent" tone="success">
            If an account exists for <strong>{email}</strong>, you will receive a reset link shortly.
          </AuthNotice>
        ) : (
          <form onSubmit={sendReset} className="auth-form">
            <AuthField
              id="forgot-email"
              label="Email address"
              type="email"
              value={email}
              onChange={setEmail}
              required
              autoComplete="email"
              placeholder="you@organization.com"
              icon={<Mail size={18} />}
            />

            <button type="submit" disabled={isLoading} className="auth-submit-button">
              <span>{isLoading ? "Sending..." : "Send reset link"}</span>
              {!isLoading ? <ArrowRight size={18} /> : null}
            </button>

            <Link href="/login" className="auth-cancel-link">
              Cancel
            </Link>
          </form>
        )}
      </AuthCard>
    </AuthShell>
  );
}
