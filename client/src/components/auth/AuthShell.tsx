import { useMemo, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Link } from "wouter";
import {
  CheckCircle2,
  FileCheck2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import "@/styles/auth-phase2.css";

export type AuthMode = "password" | "magic";

type AuthShellProps = {
  children: ReactNode;
  compact?: boolean;
  title?: string;
};

type AuthCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

type AuthFieldProps = {
  id: string;
  label: string;
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  trailing?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "value" | "onChange">;

type AuthModeSwitchProps = {
  value: AuthMode;
  onChange: (value: AuthMode) => void;
  magicLabel?: string;
};

export function AuthShell({ children, compact = false, title = "Codical Health" }: AuthShellProps) {
  return (
    <div className="auth-phase2-shell">
      <div className="auth-aurora-stage" aria-hidden="true" />
      <div className="auth-grain" aria-hidden="true" />

      <main className={`auth-mac-window${compact ? " is-compact" : ""}`} aria-label={title}>
        <div className="auth-titlebar">
          <div className="auth-traffic" aria-hidden="true">
            <span>
              <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1.5 1.5l5 5M6.5 1.5l-5 5" /></svg>
            </span>
            <span>
              <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1.5 4h5" /></svg>
            </span>
            <span>
              <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M1 4.5V6a.5.5 0 0 0 .5.5H3M7 3.5V2a.5.5 0 0 0-.5-.5H5" /></svg>
            </span>
          </div>
          <p>{title}</p>
          <Link href="/" className="auth-titlebar-link">Back to product</Link>
        </div>

        <div className="auth-window-body">
          {!compact ? <AuthShowcase /> : null}
          <section className={compact ? "auth-center-side" : "auth-form-side"} aria-label="Account access">
            {children}
          </section>
        </div>
      </main>
    </div>
  );
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="auth-card">
      <div className="auth-card-head">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>

      <div className="auth-card-body">{children}</div>

      {footer ? <div className="auth-card-footer">{footer}</div> : null}
    </div>
  );
}

export function AuthField({ id, label, icon, value, onChange, trailing, ...inputProps }: AuthFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="auth-field-group">
      <label htmlFor={id}>{label}</label>
      <div className={`auth-field${focused ? " is-focused" : ""}`}>
        <span className="auth-field-icon">{icon}</span>
        <input
          {...inputProps}
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={(event) => {
            setFocused(true);
            inputProps.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            inputProps.onBlur?.(event);
          }}
        />
        {trailing ? <span className="auth-field-trailing">{trailing}</span> : null}
      </div>
    </div>
  );
}

export function AuthModeSwitch({ value, onChange, magicLabel = "Email link" }: AuthModeSwitchProps) {
  const modes: Array<{ value: AuthMode; label: string }> = [
    { value: "password", label: "Password" },
    { value: "magic", label: magicLabel },
  ];

  return (
    <div className="auth-mode-switch" role="tablist" aria-label="Authentication method">
      {modes.map((mode) => (
        <button
          key={mode.value}
          type="button"
          role="tab"
          aria-selected={value === mode.value}
          className={value === mode.value ? "is-active" : ""}
          onClick={() => onChange(mode.value)}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="auth-divider" aria-hidden="true">
      <span />
      <em>or</em>
      <span />
    </div>
  );
}

export function AuthGoogleButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="auth-google-button">
      <span aria-hidden="true">G</span>
      Continue with Google
    </button>
  );
}

export function AuthSecurityFooter() {
  return (
    <div className="auth-security-footer">
      <span><ShieldCheck size={15} /> Role controls</span>
      <span><LockKeyhole size={15} /> Secure access</span>
      <span><FileCheck2 size={15} /> Audit trail</span>
    </div>
  );
}

export function AuthNotice({
  icon,
  title,
  children,
  tone = "neutral",
}: {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
  tone?: "neutral" | "success" | "danger";
}) {
  return (
    <div className={`auth-notice auth-notice-${tone}`}>
      {icon ? <span className="auth-notice-icon">{icon}</span> : null}
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}

export function AuthPasswordStrength({ password }: { password: string }) {
  const checks = useMemo(
    () => [
      { label: "8+ characters", met: password.length >= 8 },
      { label: "Upper and lower case", met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
      { label: "Number", met: /\d/.test(password) },
      { label: "Symbol", met: /[^A-Za-z0-9]/.test(password) },
    ],
    [password],
  );
  const score = checks.filter((check) => check.met).length;
  const label = score <= 1 ? "Weak" : score === 2 ? "Fair" : score === 3 ? "Good" : "Strong";

  return (
    <div className="auth-password-meter" data-score={score}>
      <div>
        <span>Password strength</span>
        <strong>{label}</strong>
      </div>
      <div className="auth-meter-track" aria-hidden="true"><span /></div>
      <ul>
        {checks.map((check) => (
          <li className={check.met ? "is-met" : ""} key={check.label}>
            <CheckCircle2 size={14} />
            {check.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AuthShowcase() {
  return (
    <aside className="auth-showcase" aria-label="Codical Health secure access overview">
      <div className="auth-showcase-noise" aria-hidden="true" />
      <div className="auth-showcase-brand">
        <BrandMark animated inverse />
      </div>

      <div className="auth-showcase-copy">
        <span className="auth-story-chip"><span aria-hidden="true" /> Secure coding access</span>
        <h1>Cleaner claims begin with controlled access.</h1>
        <p>
          Access coding intelligence, transcription review, claim validation and team handoff
          inside one protected operating view.
        </p>
      </div>

      <div className="auth-metric-row" aria-label="Security metrics">
        <div>
          <strong>98%</strong>
          <span>code confidence</span>
        </div>
        <div>
          <strong>24/7</strong>
          <span>audit trail</span>
        </div>
        <div>
          <strong>4</strong>
          <span>review paths</span>
        </div>
      </div>

      <div className="auth-showcase-quote">
        <p>"Every recommendation stays linked to the source note, payer context, and reviewer handoff."</p>
        <div>
          <span>CO</span>
          <div>
            <strong>Coding operations</strong>
            <em>Revenue integrity team</em>
          </div>
        </div>
      </div>
    </aside>
  );
}
