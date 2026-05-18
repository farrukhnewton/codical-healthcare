import "@/styles/landing-aurora-scene.css";

import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Redirect, Route, Switch } from "wouter";
import { BrandMark } from "@/components/BrandMark";
import { supabase } from "./lib/supabase";
import type { Session } from "@supabase/supabase-js";

const Landing = lazy(() => import("@/pages/Landing").then((module) => ({ default: module.Landing })));
const Login = lazy(() => import("@/pages/Login").then((module) => ({ default: module.Login })));
const Signup = lazy(() => import("@/pages/Signup").then((module) => ({ default: module.Signup })));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword").then((module) => ({ default: module.ForgotPassword })));
const ResetPassword = lazy(() => import("@/pages/ResetPassword").then((module) => ({ default: module.ResetPassword })));
const AuthCallback = lazy(() => import("@/pages/AuthCallback").then((module) => ({ default: module.AuthCallback })));
const AuthenticatedApp = lazy(() => import("@/components/layout/AuthenticatedApp"));
const Toaster = lazy(() => import("@/components/ui/toaster").then((module) => ({ default: module.Toaster })));

function AuthLoadingScreen() {
  return (
    <div className="landingAurora appShell min-h-screen relative">
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="auth-loading-card w-full max-w-sm">
          <div className="ln-preview p-8 text-center">
            <div className="flex items-center justify-center">
              <BrandMark />
            </div>

            <div className="mt-6 text-[12px] font-black tracking-[0.16em] uppercase text-[hsl(var(--muted-foreground))]">
              Preparing your workspace
            </div>

            <div className="mt-4 flex items-center justify-center gap-10">
              <div className="h-2 w-2 rounded-full bg-[rgba(74,222,128,0.85)] animate-pulse" />
              <div className="h-2 w-2 rounded-full bg-[rgba(56,189,248,0.85)] animate-pulse [animation-delay:150ms]" />
              <div className="h-2 w-2 rounded-full bg-[rgba(167,139,250,0.80)] animate-pulse [animation-delay:300ms]" />
            </div>

            <div className="mt-6 text-[13px] font-black tracking-[-0.01em] text-[hsl(var(--muted-foreground))]">
              Loading your session...
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PublicRouteFallback() {
  return <AuthLoadingScreen />;
}

function PublicPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PublicRouteFallback />}>{children}</Suspense>;
}

function LandingWithIntro() {
  return (
    <div className="landing-route-fade">
      <Suspense fallback={<PublicRouteFallback />}>
        <Landing />
      </Suspense>
    </div>
  );
}

function Router() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (authLoading) {
    return <AuthLoadingScreen />;
  }

  return (
    <Switch>
      <Route path="/" component={LandingWithIntro} />
      <Route path="/login">{() => <PublicPage><Login /></PublicPage>}</Route>
      <Route path="/signup">{() => <PublicPage><Signup /></PublicPage>}</Route>
      <Route path="/auth/callback">{() => <PublicPage><AuthCallback /></PublicPage>}</Route>
      <Route path="/forgot-password">{() => <PublicPage><ForgotPassword /></PublicPage>}</Route>
      <Route path="/reset-password">{() => <PublicPage><ResetPassword /></PublicPage>}</Route>

      {!session ? (
        <Redirect to="/login" />
      ) : (
        <Suspense fallback={<AuthLoadingScreen />}>
          <AuthenticatedApp />
        </Suspense>
      )}
    </Switch>
  );
}

function App() {
  return (
    <>
      <Router />
      <Suspense fallback={null}>
        <Toaster />
      </Suspense>
    </>
  );
}

export default App;
