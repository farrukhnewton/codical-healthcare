import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { AuthCard, AuthShell } from "@/components/auth/AuthShell";
import { useToast } from "@/hooks/use-toast";

function getAuthError() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  return (
    searchParams.get("error_description") ||
    hashParams.get("error_description") ||
    searchParams.get("error") ||
    hashParams.get("error")
  );
}

function getSafeNextPath() {
  const next = new URLSearchParams(window.location.search).get("next") || "/dashboard";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export function AuthCallback() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [message, setMessage] = useState("Completing sign-in...");

  useEffect(() => {
    let active = true;

    async function completeAuth() {
      const authError = getAuthError();
      if (authError) {
        throw new Error(authError);
      }

      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (!data.session) {
        throw new Error("No auth session was returned. Please try signing in again.");
      }

      if (!active) return;
      setMessage("Opening your workspace...");
      setLocation(getSafeNextPath());
    }

    completeAuth().catch((error) => {
      if (!active) return;

      const description = error instanceof Error ? error.message : "Sign-in failed.";
      window.sessionStorage.setItem("codical_auth_error", description);
      toast({ title: "Sign-in failed", description, variant: "destructive" });
      setLocation("/login");
    });

    return () => {
      active = false;
    };
  }, [setLocation, toast]);

  return (
    <AuthShell>
      <AuthCard title="Signing you in" subtitle={message}>
        <div className="flex items-center justify-center py-8">
          <div className="h-9 w-9 rounded-full border-2 border-[rgba(74,222,128,0.30)] border-t-[rgba(74,222,128,0.95)] animate-spin" />
        </div>
      </AuthCard>
    </AuthShell>
  );
}
