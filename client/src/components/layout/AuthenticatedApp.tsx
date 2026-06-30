import "@/styles/app-shell.css";
import "@/styles/codical-redesign.css";

import { lazy, Suspense, type ReactNode } from "react";
import { Redirect, Route, Switch } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { IconRail } from "@/components/layout/IconRail";
import { TopBar } from "@/components/layout/TopBar";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";

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

function PageTransition({ children }: { children: ReactNode }) {
  return <div className="app-route-transition h-full">{children}</div>;
}

function AppPage({ children }: { children: ReactNode }) {
  return (
    <PageTransition>
      <Suspense fallback={<AppRouteFallback />}>{children}</Suspense>
    </PageTransition>
  );
}

function AuthenticatedRoutes() {
  return (
    <Switch>
      <Route path="/dashboard">{() => <AppPage><Home /></AppPage>}</Route>
      <Route path="/workspace">{() => <AppPage><Workspace /></AppPage>}</Route>
      <Route path="/chat">{() => <AppPage><TeamChat /></AppPage>}</Route>
      <Route path="/workbench">{() => <AppPage><Workbench /></AppPage>}</Route>
      <Route path="/voice-transcription">{() => <AppPage><VoiceTranscription /></AppPage>}</Route>
      <Route path="/intel/:code">{() => <AppPage><CodeIntel /></AppPage>}</Route>
      <Route path="/compliance">{() => <AppPage><Compliance /></AppPage>}</Route>
      <Route path="/search">{() => <AppPage><Search /></AppPage>}</Route>
      <Route path="/intelligence">{() => <AppPage><IntelligenceHub /></AppPage>}</Route>
      <Route path="/guidelines">{() => <Redirect to="/intelligence" />}</Route>
      <Route path="/payers">{() => <Redirect to="/intelligence" />}</Route>
      <Route path="/favorites">{() => <AppPage><Favorites /></AppPage>}</Route>
      <Route path="/reports">{() => <AppPage><Reports /></AppPage>}</Route>
      <Route path="/analytics">{() => <AppPage><Analytics /></AppPage>}</Route>
      <Route path="/ncci">{() => <AppPage><NcciChecker /></AppPage>}</Route>
      <Route path="/claim-validator">{() => <AppPage><ClaimValidator /></AppPage>}</Route>
      <Route path="/coverage">{() => <Redirect to="/intelligence" />}</Route>
      <Route path="/rvu">{() => <AppPage><RvuCalculator /></AppPage>}</Route>
      <Route path="/anesthesia">{() => <AppPage><AnesthesiaCalculator /></AppPage>}</Route>
      <Route path="/npi">{() => <AppPage><NpiChecker /></AppPage>}</Route>
      <Route path="/codelookup">{() => <AppPage><CodeLookup /></AppPage>}</Route>
      <Route path="/settings">{() => <AppPage><Settings /></AppPage>}</Route>
      <Route path="/druglookup">{() => <AppPage><DrugLookup /></AppPage>}</Route>
      <Route>{() => <AppPage><NotFound /></AppPage>}</Route>
    </Switch>
  );
}

export function AuthenticatedApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="landingAurora appShell appShellPremium appShellCodical flex h-screen overflow-hidden font-sans selection:bg-primary/20 relative">
        <div className="app-cinematic-bg" aria-hidden="true">
          <span className="app-orbit app-orbit-one" />
          <span className="app-orbit app-orbit-two" />
          <span className="app-shell-pill pill-ncci">NCCI clear</span>
          <span className="app-shell-pill pill-claim">Claim ready</span>
          <span className="app-shell-pill pill-review">Coder review</span>
        </div>

        <Suspense fallback={null}>
          <ChatRealtimeBridge />
        </Suspense>

        <IconRail />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar />

          <main className="appShellMain flex-1 overflow-y-auto pb-16 lg:pb-0">
            <AuthenticatedRoutes />
          </main>

          <Footer />
          <MobileBottomNav />
        </div>
      </div>
    </QueryClientProvider>
  );
}

export default AuthenticatedApp;
