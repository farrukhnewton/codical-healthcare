import "@/styles/landing-aurora-scene.css";

import { Switch, Route, Redirect } from "wouter";
import { useState, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import NotFound from "@/pages/not-found";

import { IconRail } from "@/components/layout/IconRail";
import { TopBar } from "@/components/layout/TopBar";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { Settings } from "@/pages/Settings";
import { Compliance } from "@/pages/Compliance";
import { IntelligenceHub } from "@/pages/IntelligenceHub";

import { Login } from "@/pages/Login";
import { Signup } from "@/pages/Signup";
import { ForgotPassword } from "@/pages/ForgotPassword";
import { ResetPassword } from "@/pages/ResetPassword";

import { Home } from "@/pages/Home";
import { Workspace } from "@/pages/Workspace";

import { Landing } from "@/pages/Landing";
import { CodeIntel } from "@/pages/CodeIntel";
import { Search } from "@/pages/Search";
import { Favorites } from "@/pages/Favorites";

import { Analytics } from "@/pages/Analytics";
import { Reports } from "@/pages/Reports";

import { RvuCalculator } from "@/pages/RvuCalculator";
import { AnesthesiaCalculator } from "@/pages/AnesthesiaCalculator";
import { NpiChecker } from "@/pages/NpiChecker";
import { CodeLookup } from "@/pages/CodeLookup";
import { DrugLookup } from "@/pages/DrugLookup";
import { NcciChecker } from "@/pages/NcciChecker";
import { TeamChat } from "@/pages/TeamChat";
import { Workbench } from "@/pages/Workbench";
import { supabase } from "./lib/supabase";
import { Session } from "@supabase/supabase-js";
import { AuroraScene } from "@/components/landing-next/AuroraScene";

// Auth loading screen (matches landing/auth aurora system)
function AuthLoadingScreen() {
  return (
    <div className="landingAurora min-h-screen relative">
      <AuroraScene />
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm"
        >
          <div className="ln-preview p-8 text-center">
            <div className="flex items-center justify-center gap-3">
              <div className="ln-bars" aria-hidden="true">
                <span className="ln-bar" />
                <span className="ln-bar" />
                <span className="ln-bar" />
                <span className="ln-bar" />
                <span className="ln-bar" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-[14px] font-black tracking-[-0.03em] text-[hsl(var(--foreground))]">
                  CODICAL
                </span>
                <span className="mt-1 text-[10px] font-black tracking-[0.28em] uppercase text-[rgba(16,185,129,0.95)]">
                  Health
                </span>
              </div>
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
              Loading your session…
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// Page transition wrapper
function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="h-full"
    >
      {children}
    </motion.div>
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
      <Route path="/" component={Landing} />

      {/* Public auth routes */}
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />

      {!session ? (
        <Redirect to="/login" />
      ) : (
        <div
          className="flex h-screen overflow-hidden font-sans selection:bg-primary/20"
          style={{
            background:
              "linear-gradient(160deg, #F0FDF4 0%, #F0F9FF 30%, #F0FDF4 50%, #FEF3C7 80%, #FCE7F3 100%)",
            backgroundSize: "400% 400%",
          }}
        >
          {/* Sidebar */}
          <IconRail />

          {/* Main content area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <TopBar />

            <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
              <AnimatePresence mode="wait">
                <Switch>
                  <Route path="/dashboard">
                    {() => (
                      <PageTransition>
                        <Home />
                      </PageTransition>
                    )}
                  </Route>
                  <Route path="/workspace">
                    {() => (
                      <PageTransition>
                        <Workspace />
                      </PageTransition>
                    )}
                  </Route>
                  <Route path="/chat">
                    {() => (
                      <PageTransition>
                        <TeamChat />
                      </PageTransition>
                    )}
                  </Route>
                  <Route path="/workbench">
                    {() => (
                      <PageTransition>
                        <Workbench />
                      </PageTransition>
                    )}
                  </Route>
                  <Route path="/intel/:code">
                    {() => (
                      <PageTransition>
                        <CodeIntel />
                      </PageTransition>
                    )}
                  </Route>
                  <Route path="/compliance">
                    {() => (
                      <PageTransition>
                        <Compliance />
                      </PageTransition>
                    )}
                  </Route>
                  <Route path="/search">
                    {() => (
                      <PageTransition>
                        <Search />
                      </PageTransition>
                    )}
                  </Route>
                  <Route path="/intelligence">
                    {() => (
                      <PageTransition>
                        <IntelligenceHub />
                      </PageTransition>
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
                      <PageTransition>
                        <Favorites />
                      </PageTransition>
                    )}
                  </Route>
                  <Route path="/reports">
                    {() => (
                      <PageTransition>
                        <Reports />
                      </PageTransition>
                    )}
                  </Route>
                  <Route path="/ncci">
                    {() => (
                      <PageTransition>
                        <NcciChecker />
                      </PageTransition>
                    )}
                  </Route>
                  <Route path="/coverage">
                    {() => <PageTransition><KnowledgeCenter /></PageTransition>}
                  </Route>
                  <Route path="/rvu">
                    {() => (
                      <PageTransition>
                        <RvuCalculator />
                      </PageTransition>
                    )}
                  </Route>
                  <Route path="/anesthesia">
                    {() => (
                      <PageTransition>
                        <AnesthesiaCalculator />
                      </PageTransition>
                    )}
                  </Route>
                  <Route path="/npi">
                    {() => (
                      <PageTransition>
                        <NpiChecker />
                      </PageTransition>
                    )}
                  </Route>
                  <Route path="/codelookup">
                    {() => (
                      <PageTransition>
                        <CodeLookup />
                      </PageTransition>
                    )}
                  </Route>
                  <Route path="/settings">
                    {() => (
                      <PageTransition>
                        <Settings />
                      </PageTransition>
                    )}
                  </Route>
                  <Route path="/druglookup">
                    {() => (
                      <PageTransition>
                        <DrugLookup />
                      </PageTransition>
                    )}
                  </Route>
                  <Route>
                    {() => (
                      <PageTransition>
                        <NotFound />
                      </PageTransition>
                    )}
                  </Route>
                </Switch>
              </AnimatePresence>
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
