import "@/styles/landing-aurora-scene.css";

import { Switch, Route, Redirect } from "wouter";
import { lazy, Suspense, useState, useEffect, type ReactNode } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { IconRail } from "@/components/layout/IconRail";
import { TopBar } from "@/components/layout/TopBar";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { BrandMark } from "@/components/BrandMark";
import { supabase } from "./lib/supabase";
import { Session } from "@supabase/supabase-js";

const Landing = lazy(() => import("@/pages/Landing").then((module) => ({ default: module.Landing })));
const Login = lazy(() => import("@/pages/Login").then((module) => ({ default: module.Login })));
const Signup = lazy(() => import("@/pages/Signup").then((module) => ({ default: module.Signup })));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword").then((module) => ({ default: module.ForgotPassword })));
const ResetPassword = lazy(() => import("@/pages/ResetPassword").then((module) => ({ default: module.ResetPassword })));
const AuthCallback = lazy(() => import("@/pages/AuthCallback").then((module) => ({ default: module.AuthCallback })));

const Home = lazy(() => import("@/pages/Home").then((module) => ({ default: module.Home })));
const Workspace = lazy(() => import("@/pages/Workspace").then((module) => ({ default: module.Workspace })));
const TeamChat = lazy(() => import("@/pages/TeamChat").then((module) => ({ default: module.TeamChat })));
const Workbench = lazy(() => import("@/pages/Workbench").then((module) => ({ default: module.Workbench })));
const VoiceTranscription = lazy(() => import("@/pages/VoiceTranscription").then((module) => ({ default: module.VoiceTranscription })));
const CodeIntel = lazy(() => import("@/pages/CodeIntel").then((module) => ({ default: module.CodeIntel })));
const Compliance = lazy(() => import("@/pages/Compliance").then((module) => ({ default: module.Compliance })));
const Search = lazy(() => import("@/pages/Search").then((module) => ({ default: module.Search })));
const IntelligenceHub = lazy(() => import("@/pages/IntelligenceHub").then((module) => ({ default: module.IntelligenceHub })));
const Favorites = lazy(() => import("@/pages/Favorites").then((module) => ({ default: module.Favorites })));
const Reports = lazy(() => import("@/pages/Reports").then((module) => ({ default: module.Reports })));
const Analytics = lazy(() => import("@/pages/Analytics").then((module) => ({ default: module.Analytics })));
const NcciChecker = lazy(() => import("@/pages/NcciChecker").then((module) => ({ default: module.NcciChecker })));
const ClaimValidator = lazy(() => import("@/pages/ClaimValidator").then((module) => ({ default: module.ClaimValidator })));
const RvuCalculator = lazy(() => import("@/pages/RvuCalculator").then((module) => ({ default: module.RvuCalculator })));
const AnesthesiaCalculator = lazy(() => import("@/pages/AnesthesiaCalculator").then((module) => ({ default: module.AnesthesiaCalculator })));
const NpiChecker = lazy(() => import("@/pages/NpiChecker").then((module) => ({ default: module.NpiChecker })));
const CodeLookup = lazy(() => import("@/pages/CodeLookup").then((module) => ({ default: module.CodeLookup })));
const Settings = lazy(() => import("@/pages/Settings").then((module) => ({ default: module.Settings })));
const DrugLookup = lazy(() => import("@/pages/DrugLookup").then((module) => ({ default: module.DrugLookup })));
const NotFound = lazy(() => import("@/pages/not-found"));
const ChatRealtimeBridge = lazy(() =>
  import("@/components/chat/ChatRealtimeBridge").then((module) => ({ default: module.ChatRealtimeBridge })),
);

// Auth loading screen
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

function AppRouteFallback() {
  return (
    <div className="p-5 sm:p-6 max-w-6xl mx-auto w-full">
      <div className="co-dashboard-card min-h-[280px] flex flex-col gap-4 justify-center">
        <div className="h-4 w-32 rounded-full bg-[var(--co-glass-2)] animate-pulse" />
        <div className="h-9 w-72 max-w-full rounded-xl bg-[var(--co-glass-2)] animate-pulse" />
        <div className="h-4 w-full max-w-xl rounded-full bg-[var(--co-glass)] animate-pulse" />
        <div className="grid sm:grid-cols-3 gap-3 mt-4">
          <div className="h-24 rounded-2xl bg-[var(--co-glass)] animate-pulse" />
          <div className="h-24 rounded-2xl bg-[var(--co-glass)] animate-pulse" />
          <div className="h-24 rounded-2xl bg-[var(--co-glass)] animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function PublicPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PublicRouteFallback />}>{children}</Suspense>;
}

function AppPage({ children }: { children: ReactNode }) {
  return (
    <PageTransition>
      <Suspense fallback={<AppRouteFallback />}>{children}</Suspense>
    </PageTransition>
  );
}

// Page transition wrapper
function PageTransition({ children }: { children: ReactNode }) {
  return <div className="app-route-transition h-full">{children}</div>;
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

  // Show loading while checking auth
  if (authLoading) {
    return <AuthLoadingScreen />;
  }

  return (
    <Switch>
      <Route path="/" component={LandingWithIntro} />

      {/* Public auth routes */}
      <Route path="/login">{() => <PublicPage><Login /></PublicPage>}</Route>
      <Route path="/signup">{() => <PublicPage><Signup /></PublicPage>}</Route>
      <Route path="/auth/callback">{() => <PublicPage><AuthCallback /></PublicPage>}</Route>
      <Route path="/forgot-password">{() => <PublicPage><ForgotPassword /></PublicPage>}</Route>
      <Route path="/reset-password">{() => <PublicPage><ResetPassword /></PublicPage>}</Route>

      {!session ? (
        <Redirect to="/login" />
      ) : (
        <div className="landingAurora appShell flex h-screen overflow-hidden font-sans selection:bg-primary/20 relative">
          <Suspense fallback={null}>
            <ChatRealtimeBridge />
          </Suspense>
          {/* Sidebar */}
          <IconRail />

          {/* Main content area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <TopBar />

            <main className="appShellMain flex-1 overflow-y-auto pb-16 lg:pb-0">
              <Switch>
                <Route path="/dashboard">
                  {() => (
                    <AppPage>
                      <Home />
                    </AppPage>
                  )}
                </Route>
                <Route path="/workspace">
                  {() => (
                    <AppPage>
                      <Workspace />
                    </AppPage>
                  )}
                </Route>
                <Route path="/chat">
                  {() => (
                    <AppPage>
                      <TeamChat />
                    </AppPage>
                  )}
                </Route>
                <Route path="/workbench">
                  {() => (
                    <AppPage>
                      <Workbench />
                    </AppPage>
                  )}
                </Route>
                <Route path="/voice-transcription">
                  {() => (
                    <AppPage>
                      <VoiceTranscription />
                    </AppPage>
                  )}
                </Route>
                <Route path="/intel/:code">
                  {() => (
                    <AppPage>
                      <CodeIntel />
                    </AppPage>
                  )}
                </Route>
                <Route path="/compliance">
                  {() => (
                    <AppPage>
                      <Compliance />
                    </AppPage>
                  )}
                </Route>
                <Route path="/search">
                  {() => (
                    <AppPage>
                      <Search />
                    </AppPage>
                  )}
                </Route>
                <Route path="/intelligence">
                  {() => (
                    <AppPage>
                      <IntelligenceHub />
                    </AppPage>
                  )}
                </Route>
                <Route path="/guidelines">
                  {() => <Redirect to="/intelligence" />}
                </Route>
                <Route path="/payers">
                  {() => <Redirect to="/intelligence" />}
                </Route>
                <Route path="/favorites">
                  {() => (
                    <AppPage>
                      <Favorites />
                    </AppPage>
                  )}
                </Route>
                <Route path="/reports">
                  {() => (
                    <AppPage>
                      <Reports />
                    </AppPage>
                  )}
                </Route>
                <Route path="/analytics">
                  {() => (
                    <AppPage>
                      <Analytics />
                    </AppPage>
                  )}
                </Route>
                <Route path="/ncci">
                  {() => (
                    <AppPage>
                      <NcciChecker />
                    </AppPage>
                  )}
                </Route>
                <Route path="/claim-validator">
                  {() => (
                    <AppPage>
                      <ClaimValidator />
                    </AppPage>
                  )}
                </Route>
                <Route path="/coverage">{() => <Redirect to="/intelligence" />}</Route>
                <Route path="/rvu">
                  {() => (
                    <AppPage>
                      <RvuCalculator />
                    </AppPage>
                  )}
                </Route>
                <Route path="/anesthesia">
                  {() => (
                    <AppPage>
                      <AnesthesiaCalculator />
                    </AppPage>
                  )}
                </Route>
                <Route path="/npi">
                  {() => (
                    <AppPage>
                      <NpiChecker />
                    </AppPage>
                  )}
                </Route>
                <Route path="/codelookup">
                  {() => (
                    <AppPage>
                      <CodeLookup />
                    </AppPage>
                  )}
                </Route>
                <Route path="/settings">
                  {() => (
                    <AppPage>
                      <Settings />
                    </AppPage>
                  )}
                </Route>
                <Route path="/druglookup">
                  {() => (
                    <AppPage>
                      <DrugLookup />
                    </AppPage>
                  )}
                </Route>
                <Route>
                  {() => (
                    <AppPage>
                      <NotFound />
                    </AppPage>
                  )}
                </Route>
              </Switch>
            </main>

            <Footer />
            <MobileBottomNav />
          </div>
        </div>
      )}
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;






