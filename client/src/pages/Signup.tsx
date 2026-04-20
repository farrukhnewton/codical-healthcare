import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Shield, Lock, Zap, Mail, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Link, useLocation } from "wouter";

const BAR_COLORS = [
  { color: "#E8541A", height: 28 },
  { color: "#C43B0E", height: 36 },
  { color: "#1B2F6E", height: 44 },
  { color: "#F0A500", height: 36 },
  { color: "#E8541A", height: 28 },
];

type Mode = "password" | "magic";

export function Signup() {
  const [mode, setMode] = useState<Mode>("password");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signupDone, setSignupDone] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // If user is already signed in (Google, magic link, etc.), go to app.
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
      options: { redirectTo: `${window.location.origin}/login` },
    });

    if (error) {
      toast({ title: "Google sign-up failed", description: error.message, variant: "destructive" });
      setIsLoading(false);
    }
  };

  const handleSignupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/login` },
      });

      if (error) {
        toast({ title: "Signup Failed", description: error.message, variant: "destructive" });
        return;
      }

      setSignupDone(true);
      toast({ title: "Success!", description: "Check your email to confirm your account." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/login`,
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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden nature-bg-living">
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute rounded-full"
          style={{
            width: "500px",
            height: "500px",
            top: "-150px",
            right: "-100px",
            background: "linear-gradient(135deg, rgba(134,239,172,0.3), rgba(186,230,253,0.2))",
            filter: "blur(80px)",
            animation: "morphBlob 25s ease-in-out infinite, floatSlow 10s ease-in-out infinite",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: "400px",
            height: "400px",
            bottom: "-100px",
            left: "-80px",
            background: "linear-gradient(135deg, rgba(167,139,250,0.2), rgba(56,189,248,0.15))",
            filter: "blur(80px)",
            animation: "morphBlob 30s ease-in-out 5s infinite, floatSlow 12s ease-in-out 3s infinite",
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md relative z-10"
      >
        <div
          className="rounded-3xl p-8 sm:p-10"
          style={{
            background: "rgba(255,255,255,0.6)",
            backdropFilter: "blur(24px) saturate(1.5)",
            border: "1px solid rgba(255,255,255,0.7)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.08), 0 0 0 1px rgba(255,255,255,0.5) inset",
          }}
        >
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="flex items-end gap-2 h-12">
              {BAR_COLORS.map((bar, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: bar.height }}
                  transition={{ duration: 0.4, delay: 0.1 + i * 0.1 }}
                  className="w-3 rounded-md"
                  style={{ backgroundColor: bar.color }}
                />
              ))}
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-black text-gray-900 tracking-wider">JOIN CODICAL</h1>
              <p className="text-xs font-bold text-emerald-600 tracking-widest mt-1">CREATE YOUR ACCOUNT</p>
            </div>
          </div>

          {/* Google */}
          <div className="space-y-3 mb-5">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={isLoading}
              className="w-full h-12 rounded-xl font-bold text-sm border-2 border-gray-200/80 bg-white/60 hover:bg-white/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue with Google
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px bg-gray-200/70 flex-1" />
              <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">or</div>
              <div className="h-px bg-gray-200/70 flex-1" />
            </div>
          </div>

          {signupDone ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <Mail className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Check Your Email</h2>
              <p className="text-sm text-gray-600">
                We sent a link to <span className="font-semibold">{email}</span>
              </p>
              <Link
                href="/login"
                className="inline-block mt-4 px-6 py-2.5 text-sm font-semibold text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors"
              >
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              {/* Mode toggle */}
              <div className="mb-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("password")}
                  className={
                    "h-10 rounded-xl text-xs font-black tracking-wide border " +
                    (mode === "password"
                      ? "bg-emerald-50/60 border-emerald-200 text-emerald-800"
                      : "bg-white/40 border-gray-200/70 text-gray-600 hover:bg-white/60")
                  }
                >
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => setMode("magic")}
                  className={
                    "h-10 rounded-xl text-xs font-black tracking-wide border " +
                    (mode === "magic"
                      ? "bg-emerald-50/60 border-emerald-200 text-emerald-800"
                      : "bg-white/40 border-gray-200/70 text-gray-600 hover:bg-white/60")
                  }
                >
                  Email link
                </button>
              </div>

              <form onSubmit={mode === "password" ? handleSignupPassword : handleSignupMagic} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Email Address</label>
                  <div
                    className={
                      "flex items-center gap-3 h-12 px-4 rounded-xl border-2 transition-all duration-300 " +
                      (focusedField === "email"
                        ? "bg-emerald-50/50 border-emerald-400 shadow-[0_0_0_3px_rgba(74,222,128,0.1)]"
                        : "bg-white/60 border-gray-200/80")
                    }
                  >
                    <Mail className={"w-4 h-4 flex-shrink-0 transition-colors " + (focusedField === "email" ? "text-emerald-500" : "text-gray-400")} />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="Enter your email"
                      onFocus={() => setFocusedField("email")}
                      onBlur={() => setFocusedField(null)}
                      className="flex-1 border-none outline-none text-sm font-medium text-gray-900 bg-transparent placeholder:text-gray-400"
                    />
                  </div>
                </div>

                {mode === "password" && (
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Password</label>
                    <div
                      className={
                        "flex items-center gap-3 h-12 px-4 rounded-xl border-2 transition-all duration-300 " +
                        (focusedField === "password"
                          ? "bg-emerald-50/50 border-emerald-400 shadow-[0_0_0_3px_rgba(74,222,128,0.1)]"
                          : "bg-white/60 border-gray-200/80")
                      }
                    >
                      <Lock className={"w-4 h-4 flex-shrink-0 transition-colors " + (focusedField === "password" ? "text-emerald-500" : "text-gray-400")} />
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="Create a password (min 6 chars)"
                        onFocus={() => setFocusedField("password")}
                        onBlur={() => setFocusedField(null)}
                        className="flex-1 border-none outline-none text-sm font-medium text-gray-900 bg-transparent placeholder:text-gray-400"
                      />
                      <button type="button" onClick={() => setShowPassword((p) => !p)} className="text-gray-400 hover:text-emerald-600 transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <motion.button
                  type="submit"
                  disabled={isLoading}
                  whileHover={{ scale: isLoading ? 1 : 1.02 }}
                  whileTap={{ scale: isLoading ? 1 : 0.98 }}
                  className="w-full h-12 text-white rounded-xl font-bold text-base transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #15803D 0%, #0369A1 100%)", boxShadow: "0 4px 24px rgba(21,128,61,0.3)" }}
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{mode === "password" ? "Creating account..." : "Sending link..."}</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>{mode === "password" ? "Create Account" : "Email me a link"}</span>
                    </>
                  )}
                </motion.button>

                <p className="text-center text-sm text-gray-600">
                  Already have an account?{" "}
                  <Link href="/login" className="font-bold text-emerald-600 hover:text-emerald-700 transition-colors">
                    Sign in
                  </Link>
                </p>
              </form>
            </>
          )}

          <div className="mt-6 pt-6 border-t border-gray-200/60 flex items-center justify-center gap-4 flex-wrap">
            {[
              { icon: Shield, label: "HIPAA Compliant" },
              { icon: Lock, label: "256-bit SSL" },
              { icon: Zap, label: "SOC 2 Ready" },
            ].map((badge, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                <badge.icon className="w-3 h-3 text-emerald-500" />
                {badge.label}
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-gray-500 font-medium">
        © {new Date().getFullYear()} Codical Health · Healthcare Intelligence Reimagined
      </p>
    </div>
  );
}
