import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Mail, Shield, Moon, Sun, LogOut, Bell, Palette } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";

export function Settings() {
  const [email, setEmail] = useState("");
  const { theme, toggle } = useTheme();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email);
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Signed out", description: "See you next time!" });
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black text-gray-900 mb-1">Settings</h1>
        <p className="text-sm text-gray-500">Manage your account and preferences</p>
      </motion.div>

      {/* Profile */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.7)" }}>
        <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2"><User className="w-4 h-4 text-emerald-500" /> Profile</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg" style={{ background: "linear-gradient(135deg, #15803D, #0369A1)" }}>
              {email ? email.slice(0, 2).toUpperCase() : "CH"}
            </div>
            <div>
              <p className="font-bold text-gray-900">{email ? email.split("@")[0] : "User"}</p>
              <p className="text-sm text-gray-500 flex items-center gap-1"><Mail className="w-3 h-3" /> {email}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Appearance */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.7)" }}>
        <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2"><Palette className="w-4 h-4 text-emerald-500" /> Appearance</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900 text-sm">Dark Mode</p>
            <p className="text-xs text-gray-500 mt-0.5">Toggle between light and dark theme</p>
          </div>
          <button onClick={toggle} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all" style={{ background: theme === "dark" ? "rgba(74,222,128,0.15)" : "rgba(0,0,0,0.05)" }}>
            {theme === "dark" ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-gray-600" />}
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
      </motion.div>

      {/* Security */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.7)" }}>
        <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2"><Shield className="w-4 h-4 text-emerald-500" /> Security</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-semibold text-gray-900 text-sm">Two-Factor Auth</p>
              <p className="text-xs text-gray-500">Add an extra layer of security</p>
            </div>
            <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg">Coming Soon</span>
          </div>
          <div className="border-t border-gray-100 pt-3">
            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors">
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </motion.div>

      {/* App Info */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="text-center text-xs text-gray-400 pt-4 space-y-1">
        <p className="font-semibold">Codical Health v2.0</p>
        <p>Healthcare Intelligence Platform</p>
        <p>CY 2026 Data · FY 2026 ICD-10-CM · HIPAA Compliant</p>
      </motion.div>
    </div>
  );
}
