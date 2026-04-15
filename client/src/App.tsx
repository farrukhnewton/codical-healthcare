
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
import { PayerIntelligence } from "@/pages/PayerIntelligence";

import { Login } from "@/pages/Login";
import { Signup } from "@/pages/Signup";
import { Home } from "@/pages/Home";
import { Workspace } from "@/pages/Workspace";
import { KnowledgeCenter } from "@/pages/KnowledgeCenter";
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

// Auth loading skeleton
function AuthLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center nature-bg-living">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        {/* Brand bars */}
        <div className="flex items-end gap-2 h-12">
          {["#E8541A", "#C43B0E", "#1B2F6E", "#F0A500", "#E8541A"].map((color, i) => (
            <div
              key={i}
              className="w-3 rounded-md"
              style={{
                backgroundColor: color,
                height: `${20 + (i === 2 ? 16 : i % 2 === 0 ? 6 : 0)}px`,
                animation: `miniPiano 1.5s ease-in-out ${i * 0.15}s infinite`,
              }}
            />
          ))}
        </div>
        <p className="text-sm font-semibold text-muted-foreground tracking-wide">
          Loading your workspace...
        </p>
      </motion.div>
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

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setAuthLoading(false);
      }
    );

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
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      {!session ? (
        <Redirect to="/login" />
      ) : (
        <div
          className="flex h-screen overflow-hidden font-sans selection:bg-primary/20"
          style={{
            background: "linear-gradient(160deg, #F0FDF4 0%, #F0F9FF 30%, #F0FDF4 50%, #FEF3C7 80%, #FCE7F3 100%)", backgroundSize: "400% 400%",
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
                    {() => <PageTransition><Home /></PageTransition>}
                  </Route>
                  <Route path="/workspace">
                    {() => <PageTransition><Workspace /></PageTransition>}
                  </Route>
                  <Route path="/chat">
                    {() => <PageTransition><TeamChat /></PageTransition>}
                  </Route>
                  <Route path="/workbench">
                    {() => <PageTransition><Workbench /></PageTransition>}
                  </Route>
                  <Route path="/intel/:code">
                    {() => <PageTransition><CodeIntel /></PageTransition>}
                  </Route>
                  <Route path="/compliance">
                    {() => <PageTransition><Compliance /></PageTransition>}
                  </Route>
                  <Route path="/search">
                    {() => <PageTransition><Search /></PageTransition>}
                  </Route>
                  <Route path="/analytics">
                    {() => <PageTransition><Analytics /></PageTransition>}
                  </Route>
                  <Route path="/guidelines">
                    {() => <PageTransition><KnowledgeCenter /></PageTransition>}
                  </Route>
                  <Route path="/payers">
                    {() => <PageTransition><PayerIntelligence /></PageTransition>}
                  </Route>
                  <Route path="/favorites">
                    {() => <PageTransition><Favorites /></PageTransition>}
                  </Route>
                  <Route path="/reports">
                    {() => <PageTransition><Reports /></PageTransition>}
                  </Route>
                  <Route path="/ncci">
                    {() => <PageTransition><NcciChecker /></PageTransition>}
                  </Route>
                  <Route path="/coverage">
                    {() => <PageTransition><KnowledgeCenter /></PageTransition>}
                  </Route>
                  <Route path="/rvu">
                    {() => <PageTransition><RvuCalculator /></PageTransition>}
                  </Route>
                  <Route path="/anesthesia">
                    {() => <PageTransition><AnesthesiaCalculator /></PageTransition>}
                  </Route>
                  <Route path="/npi">
                    {() => <PageTransition><NpiChecker /></PageTransition>}
                  </Route>
                  <Route path="/codelookup">
                    {() => <PageTransition><CodeLookup /></PageTransition>}
                  </Route>
                  <Route path="/settings">
                    {() => <PageTransition><Settings /></PageTransition>}
                  </Route>
                  <Route path="/druglookup">
                    {() => <PageTransition><DrugLookup /></PageTransition>}
                  </Route>
                  <Route>
                    {() => <PageTransition><NotFound /></PageTransition>}
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
