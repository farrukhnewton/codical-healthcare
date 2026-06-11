import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Activity,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  FileCheck2,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export type AuthMode = "password" | "magic";

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

const PROOF_ITEMS = [
  {
    icon: Search,
    title: "Code intelligence",
    text: "ICD, CPT, HCPCS and RVU context stays tied to source documentation.",
  },
  {
    icon: ClipboardCheck,
    title: "Claim validation",
    text: "NCCI, payer and modifier checks happen before the handoff.",
  },
  {
    icon: UserRoundCheck,
    title: "Certified review",
    text: "Edge cases route to human review with a complete audit trail.",
  },
];

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="codical-auth-shell auth-shell-v2">
      <div className="auth-cinematic-bg" aria-hidden="true">
        <span className="auth-orbit auth-orbit-one" />
        <span className="auth-orbit auth-orbit-two" />
        <span className="auth-float-pill pill-report"><FileText size={16} /> Report</span>
        <span className="auth-float-pill pill-codes"><Sparkles size={16} /> Codes</span>
        <span className="auth-float-pill pill-claim"><ClipboardCheck size={16} /> Claim</span>
        <span className="auth-float-pill pill-review"><BadgeCheck size={16} /> Review</span>
      </div>

      <header className="auth-topbar">
        <Link className="auth-brand-link" href="/" aria-label="Codical Health home">
          <BrandMark />
        </Link>
        <Link className="auth-back-link" href="/">
          <ArrowLeft size={17} />
          Back to product
        </Link>
      </header>

      <main className="auth-layout">
        <section className="auth-story" aria-label="Codical Health security overview">
          <div className="auth-story-copy">
            <span className="auth-story-chip"><ShieldCheck size={16} /> Secure coding access</span>
            <h1>
              Sign in to cleaner claims and defensible coding review.
            </h1>
            <p>
              Codical Health brings code intelligence, claim validation, payer context,
              and certified review into one controlled healthcare workflow.
            </p>
          </div>

          <div className="auth-proof-list">
            {PROOF_ITEMS.map((item) => (
              <div className="auth-proof-item" key={item.title}>
                <span>
                  <item.icon size={19} />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.text}</p>
                </div>
              </div>
            ))}
          </div>

          <AuthWorkspacePreview />

          <div className="auth-metric-strip" aria-label="Codical Health workflow highlights">
            <strong>42%<span>fewer preventable denials</span></strong>
            <strong>24h<span>reviewer SLA</span></strong>
            <strong>NCCI<span>plus payer checks</span></strong>
          </div>

          <div className="auth-request-strip">
            <div>
              <strong>Request access</strong>
              <p>Bring documentation, validation checks and certified review into one secure workspace.</p>
            </div>
            <Link href="/signup">Request access</Link>
          </div>
        </section>

        <section className="auth-panel" aria-label="Account access">
          {children}
        </section>
      </main>
    </div>
  );
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="auth-card">
      <div className="auth-card-head">
        <BrandMark compact />
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

function AuthWorkspacePreview() {
  return (
    <div className="auth-workspace-preview" aria-label="Code review workspace preview">
      <div className="auth-preview-top">
        <div>
          <strong>Codical review workspace</strong>
          <span>Case packet #8912</span>
        </div>
        <em>Ready for review</em>
      </div>

      <div className="auth-preview-tabs" aria-hidden="true">
        <span className="is-active">Summary</span>
        <span>Codes</span>
        <span>Documentation</span>
        <span>History</span>
      </div>

      <div className="auth-preview-grid">
        <section>
          <h3><FileText size={14} /> Clinical notes</h3>
          {[
            ["Source", "Encounter summary"],
            ["Context", "Moderate complexity"],
            ["Payer", "Policy linked"],
            ["NPI", "Verified"],
          ].map(([label, value]) => (
            <div className="auth-preview-row" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </section>

        <section>
          <h3><Sparkles size={14} /> Suggested codes</h3>
          {[
            ["99214", "98% match"],
            ["J7613", "94% match"],
            ["J44.1", "Review"],
          ].map(([code, status]) => (
            <div className="auth-code-row" key={code}>
              <strong>{code}</strong>
              <span>{status}</span>
            </div>
          ))}
        </section>

        <section>
          <h3><Activity size={14} /> Claim checks</h3>
          {[
            ["NCCI edits", "Clear"],
            ["Modifier 25", "Review"],
            ["Audit trail", "Ready"],
          ].map(([label, status]) => (
            <div className="auth-code-row" key={label}>
              <strong>{label}</strong>
              <span>{status}</span>
            </div>
          ))}
        </section>
      </div>

      <div className="auth-preview-progress" aria-hidden="true">
        {["Upload", "Suggest", "Validate", "Review", "Export"].map((step, index) => (
          <div className={index < 3 ? "is-done" : ""} key={step}>
            <CheckCircle2 size={14} />
            <span>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
