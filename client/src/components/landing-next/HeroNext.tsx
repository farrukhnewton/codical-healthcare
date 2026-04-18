import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, ShieldCheck, Zap, Sparkles, BarChart3 } from "lucide-react";

type TabKey = "search" | "compliance" | "analytics";

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function HeroNext() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<TabKey>("search");
  const previewRef = useRef<HTMLDivElement>(null);

  const [counted, setCounted] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [rvu, setRvu] = useState(0);

  // Count-up once when preview enters viewport
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = previewRef.current;
    if (!el) return;

    if (reduceMotion) {
      setConfidence(97);
      setRvu(2.8);
      setCounted(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e.isIntersecting || counted) return;

        const t0 = performance.now();
        const dur = 850;

        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / dur);
          const k = easeOutCubic(p);
          setConfidence(Math.round(97 * k));
          setRvu(Number((2.8 * k).toFixed(2)));
          if (p < 1) requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
        setCounted(true);
        io.disconnect();
      },
      { threshold: 0.35 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [counted]);

  // Magnetic buttons + sheen
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (reduceMotion || coarse) return;

    const btns = Array.from(document.querySelectorAll<HTMLElement>(".ln-magnetic"));
    btns.forEach((btn) => {
      const onMove = (e: PointerEvent) => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        btn.style.transform = `translate3d(${(x * 10).toFixed(2)}px, ${(y * 10).toFixed(2)}px, 0)`;
        btn.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
        btn.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
      };
      const onLeave = () => (btn.style.transform = "");

      btn.addEventListener("pointermove", onMove, { passive: true });
      btn.addEventListener("pointerleave", onLeave);

      // cleanup
      (btn as any).__lnCleanup = () => {
        btn.removeEventListener("pointermove", onMove);
        btn.removeEventListener("pointerleave", onLeave);
      };
    });

    return () => btns.forEach((b: any) => b.__lnCleanup?.());
  }, []);

  const meta = useMemo(
    () => [
      { icon: ShieldCheck, label: "Compliance signals" },
      { icon: Zap, label: "Sub‑second search" },
      { icon: Sparkles, label: "Explainable AI" },
      { icon: BarChart3, label: "Analytics cockpit" },
    ],
    []
  );

  return (
    <section className="ln-hero" id="hero">
      <div className="ln-container">
        <div className="ln-heroGrid">
          {/* Left */}
          <div>
            <div className="ln-kicker">
              <span
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: "linear-gradient(135deg, rgba(74,222,128,1), rgba(56,189,248,1))",
                  boxShadow: "0 0 0 7px rgba(74,222,128,0.08)",
                }}
              />
              Calm, cinematic healthcare intelligence
            </div>

            <h1 className="ln-h1">
              A modern UI for <span className="ln-gradText">complex coding</span>.
            </h1>

            <p className="ln-lead">
              Codical turns policy, edits, and code intelligence into a clean, explainable workflow—built for coders,
              billers, and revenue cycle teams.
            </p>

            <div className="ln-actions">
              <button
                className="ln-btn ln-btnPrimary ln-magnetic"
                onClick={() => setLocation("/signup")}
              >
                Start free trial <ArrowRight size={18} />
              </button>
              <button
                className="ln-btn ln-btnSecondary ln-magnetic"
                onClick={() => document.querySelector("#features")?.scrollIntoView({ behavior: "smooth" })}
              >
                See how it works
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14, color: "hsl(var(--muted-foreground))", fontWeight: 900, fontSize: 12 }}>
              {meta.map((m, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 999, border: "1px solid hsl(var(--border) / 0.9)", background: "rgba(255,255,255,0.14)", backdropFilter: "blur(12px) saturate(1.2)" }}>
                  <m.icon size={16} color="rgba(74,222,128,0.9)" />
                  {m.label}
                </span>
              ))}
            </div>
          </div>

          {/* Right preview */}
          <div ref={previewRef} className="ln-preview">
            <div className="ln-previewTop">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="ln-dots" aria-hidden="true">
                  <div className="ln-dot r" />
                  <div className="ln-dot y" />
                  <div className="ln-dot g" />
                </div>
                <div className="mono" style={{ fontSize: 12, fontWeight: 900, color: "hsl(var(--muted-foreground))" }}>
                  codical / live-preview
                </div>
              </div>

              <div className="ln-tabs" role="tablist" aria-label="Preview tabs">
                <button className="ln-tab" role="tab" aria-selected={tab === "search"} onClick={() => setTab("search")}>Search</button>
                <button className="ln-tab" role="tab" aria-selected={tab === "compliance"} onClick={() => setTab("compliance")}>Compliance</button>
                <button className="ln-tab" role="tab" aria-selected={tab === "analytics"} onClick={() => setTab("analytics")}>Analytics</button>
              </div>
            </div>

            <div className="ln-previewBody">
              {/* Search */}
              <div className="ln-panel" data-active={tab === "search"}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ padding: "6px 10px", borderRadius: 12, fontWeight: 900, fontSize: 12, border: "1px solid rgba(74,222,128,0.22)", background: "rgba(74,222,128,0.12)", color: "rgba(16,185,129,1)" }} className="mono">CPT</span>
                  <span className="mono" style={{ fontSize: 18, fontWeight: 900 }}>99214</span>
                  <span style={{ fontWeight: 800, color: "hsl(var(--muted-foreground))" }}>Office visit — established</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                  <div style={{ borderRadius: 18, padding: 12, border: "1px solid rgba(255,255,255,0.28)", background: "linear-gradient(135deg, rgba(74,222,128,0.10), rgba(56,189,248,0.08))" }}>
                    <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", fontWeight: 900 }}>Confidence</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 999, border: "2px solid rgba(74,222,128,0.30)", display: "grid", placeItems: "center" }}>
                        <span className="mono" style={{ fontWeight: 900, fontSize: 12 }}>{confidence}%</span>
                      </div>
                      <div style={{ fontWeight: 900, color: "rgba(16,185,129,1)" }}>High</div>
                    </div>
                  </div>

                  <div style={{ borderRadius: 18, padding: 12, border: "1px solid rgba(255,255,255,0.28)", background: "linear-gradient(135deg, rgba(56,189,248,0.10), rgba(167,139,250,0.08))" }}>
                    <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", fontWeight: 900 }}>RVU Value</div>
                    <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em" }}>{rvu.toFixed(2)}</div>
                  </div>
                </div>
              </div>

              {/* Compliance */}
              <div className="ln-panel" data-active={tab === "compliance"}>
                <div style={{ borderRadius: 18, padding: 12, border: "1px solid rgba(255,255,255,0.28)", background: "linear-gradient(135deg, rgba(56,189,248,0.10), rgba(74,222,128,0.08))" }}>
                  <div className="mono" style={{ fontWeight: 900, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                    NCCI / Modifier Guidance
                  </div>
                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    <div style={{ borderRadius: 16, padding: 12, border: "1px solid rgba(255,255,255,0.22)", background: "rgba(255,255,255,0.10)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontWeight: 900 }}>Edit Check</div>
                        <div className="mono" style={{ fontWeight: 900, color: "rgba(16,185,129,1)" }}>PASS</div>
                      </div>
                      <div style={{ marginTop: 6, color: "hsl(var(--muted-foreground))", fontWeight: 800, lineHeight: 1.55 }}>
                        Conflicts appear only when relevant. Clear next action: add modifier or split claim.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Analytics */}
              <div className="ln-panel" data-active={tab === "analytics"}>
                <div style={{ borderRadius: 18, padding: 12, border: "1px solid rgba(255,255,255,0.28)", background: "linear-gradient(135deg, rgba(167,139,250,0.10), rgba(56,189,248,0.08))" }}>
                  <div className="mono" style={{ fontWeight: 900, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                    Trends (animated with intent)
                  </div>
                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    <div style={{ borderRadius: 16, padding: 12, border: "1px solid rgba(255,255,255,0.22)", background: "rgba(255,255,255,0.10)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontWeight: 900 }}>Denial Rate</div>
                        <div className="mono" style={{ fontWeight: 900, color: "rgba(16,185,129,1)" }}>-12%</div>
                      </div>
                      <div style={{ marginTop: 6, color: "hsl(var(--muted-foreground))", fontWeight: 800, lineHeight: 1.55 }}>
                        Motion highlights what changed, not everything. Calm UI, clear deltas.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 900, padding: "10px 12px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.34)", background: "rgba(255,255,255,0.55)" }}>
                  114,000+ Codes
                </span>
                <span style={{ fontSize: 12, fontWeight: 900, padding: "10px 12px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.34)", background: "rgba(255,255,255,0.55)" }}>
                  Real-time Signals
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
