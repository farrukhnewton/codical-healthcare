import React, { useState, useEffect, useRef } from "react";
import { Search, Shield, BarChart3, Activity, Code2 } from "lucide-react";

interface HeroPreviewProps {
  enableTilt?: boolean;
}

export function HeroPreview({ enableTilt = true }: HeroPreviewProps) {
  const [activeTab, setActiveTab] = useState("Search");
  const [count97, setCount97] = useState(0);
  const [count280, setCount280] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    
    if (isReducedMotion) {
      setCount97(97);
      setCount280(2.80);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry.isIntersecting) {
        let start = 0;
        const duration = 2000;
        const startTime = performance.now();
        
        const animate = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // easeOutExpo
          const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
          
          setCount97(Math.floor(easeProgress * 97));
          setCount280(Number((easeProgress * 2.80).toFixed(2)));
          
          if (progress < 1) {
            requestAnimationFrame(animate);
          }
        };
        
        requestAnimationFrame(animate);
        observer.disconnect();
      }
    }, { threshold: 0.5 });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative w-full max-w-lg mx-auto mt-10 lg:mt-0" ref={containerRef}>
      
      {/* Floating Badges */}
      <div className="ln-floatingBadge" style={{ top: "-20px", left: "-30px", animationDelay: "0s" }}>
        <div className="ln-badgeIcon"><Code2 size={12} /></div>
        114,000+ Codes
      </div>
      <div className="ln-floatingBadge" style={{ bottom: "40px", right: "-40px", animationDelay: "3s" }}>
        <div className="ln-badgeIcon" style={{ background: "var(--cyan)" }}><Activity size={12} /></div>
        Real-time Signals
      </div>

      <div 
        className="ln-previewRoot ln-gBorder" 
        data-tilt={enableTilt ? "true" : undefined}
      >
        <div className="ln-previewInner ln-glassStrong">
          
          {/* Header */}
          <div className="ln-previewHeader">
            <div className="ln-dots">
              <div className="ln-dot" style={{ background: "#ff5f56" }} />
              <div className="ln-dot" style={{ background: "#ffbd2e" }} />
              <div className="ln-dot" style={{ background: "#27c93f" }} />
            </div>
            <div className="ln-pvLabel">codical / live-preview</div>
            <div className="w-10" />
          </div>

          {/* Tabs */}
          <div className="ln-tabs">
            {["Search", "Compliance", "Analytics"].map(tab => (
              <div 
                key={tab} 
                className={`ln-tab ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </div>
            ))}
          </div>

          {/* Panel */}
          <div className="ln-panel" key={activeTab}>
            {activeTab === "Search" && (
              <div className="flex flex-col gap-4 h-full">
                <div className="flex items-center gap-3 p-3 ln-glass rounded-lg border border-[var(--border)]">
                  <Search size={18} className="text-[var(--muted)]" />
                  <span className="text-sm text-[var(--muted)]">Find diagnosis codes (e.g. Type 2 Diabetes)</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-auto">
                  <div className="ln-statCard">
                    <span className="ln-statLabel text-[var(--mint)]">Accuracy Match</span>
                    <span className="ln-statValue">{count97}%</span>
                  </div>
                  <div className="ln-statCard">
                    <span className="ln-statLabel text-[var(--cyan)]">Query Speed</span>
                    <span className="ln-statValue">{count280}s</span>
                  </div>
                </div>
              </div>
            )}
            {activeTab === "Compliance" && (
              <div className="flex flex-col gap-4 items-center justify-center h-full text-center">
                <Shield size={48} className="text-[var(--lilac)] mb-2" />
                <h4 className="font-semibold">HIPAA & SOC2 Ready</h4>
                <p className="text-sm text-[var(--muted)]">Built to enterprise security standards with rigorous audit logging.</p>
              </div>
            )}
            {activeTab === "Analytics" && (
              <div className="flex flex-col gap-4 items-center justify-center h-full text-center">
                <BarChart3 size={48} className="text-[var(--amber)] mb-2" />
                <h4 className="font-semibold">Workflow Insights</h4>
                <p className="text-sm text-[var(--muted)]">Track billing velocity and coding exception rates in real-time.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
