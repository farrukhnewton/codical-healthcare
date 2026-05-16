import { useEffect, useState } from "react";
import { Bell, Lock, LogOut, Mail, Moon, Palette, Shield, Sun, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";

export function Settings() {
  const [email, setEmail] = useState("");
  const { theme, toggle } = useTheme();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email);
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Signed out", description: "Session closed securely." });
  };

  const toggleAdminMode = async () => {
    if (!user) return;
    const newRole = isAdmin ? "coder" : "admin";
    try {
      const res = await fetch("/api/user/role", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, role: newRole }),
      });

      if (!res.ok) throw new Error("Failed to update role");

      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: isAdmin ? "Admin mode disabled" : "Admin mode enabled",
        description: isAdmin ? "Compliance features hidden." : "Compliance and audit access enabled.",
      });
      window.setTimeout(() => window.location.reload(), 1000);
    } catch {
      toast({ title: "Error", description: "Could not update access mode.", variant: "destructive" });
    }
  };

  const displayName = email ? email.split("@")[0] : "Codical user";
  const initials = email ? email.slice(0, 2).toUpperCase() : "CH";

  return (
    <div className="tool-page secondary-page settings-page">
      <section className="tool-panel tool-page-header">
        <div>
          <h1>Settings</h1>
          <p>Manage account access, preferences, and workspace security.</p>
        </div>
        <div className="search-header-meta">
          <span>{isAdmin ? "Admin access" : "Coder access"}</span>
          <span>{theme === "dark" ? "Dark theme" : "Light theme"}</span>
        </div>
      </section>

      <section className="settings-layout">
        <div className="tool-panel settings-profile-panel">
          <div className="settings-avatar">{initials}</div>
          <div>
            <h2>Profile</h2>
            <strong>{displayName}</strong>
            <span>
              <Mail size={14} />
              {email || "Email loading"}
            </span>
          </div>
        </div>

        <div className="tool-panel settings-card">
          <div className="settings-card-head">
            <span><Palette size={17} /> Appearance</span>
            <button type="button" onClick={toggle} className="tool-secondary-button">
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>
          </div>
          <p>Switch the authenticated workspace between light and dark theme.</p>
        </div>

        <div className="tool-panel settings-card">
          <div className="settings-card-head">
            <span><Shield size={17} /> Administrative Access</span>
            <button type="button" onClick={toggleAdminMode} className={isAdmin ? "settings-mode-button is-active" : "settings-mode-button"}>
              {isAdmin ? "Admin Enabled" : "Enable Admin"}
            </button>
          </div>
          <p>Control access to compliance and audit workflows for this account.</p>
        </div>

        <div className="tool-panel settings-card">
          <div className="settings-card-head">
            <span><Bell size={17} /> Notifications</span>
            <span className="secondary-status-pill" data-tone="info">Configured</span>
          </div>
          <p>Account, collaboration, and report notifications use the workspace defaults.</p>
        </div>

        <div className="tool-panel settings-card">
          <div className="settings-card-head">
            <span><Lock size={17} /> Security</span>
            <span className="secondary-status-pill" data-tone="success">HIPAA Ready</span>
          </div>
          <p>Session controls, audit logging, and encrypted transport remain active.</p>
        </div>

        <div className="tool-panel settings-card settings-danger-card">
          <div className="settings-card-head">
            <span><User size={17} /> Session</span>
            <button type="button" onClick={handleLogout} className="settings-signout-button">
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
          <p>Sign out when you are finished using this workstation.</p>
        </div>
      </section>

      <div className="tool-callout compact" data-tone="info">
        <Shield size={15} />
        Codical Health v2.0 | CY 2026 data | FY 2026 ICD-10-CM | HIPAA compliant workspace.
      </div>
    </div>
  );
}
