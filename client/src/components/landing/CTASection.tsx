import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  const [, setLocation] = useLocation();

  return (
    <section id="cta" className="ln-section">
      <div className="ln-container">
        <div className="ln-glassStrong ln-card p-0">
          <div className="ln-gradBorder ln-ctaSurface">
            <div className="relative p-10 sm:p-14 text-center">
              <h2 className="ln-h2">
                Ready to transform your
                <br />
                revenue cycle?
              </h2>

              <p className="mt-4 mx-auto max-w-[70ch] text-[15px] sm:text-[16px] leading-[1.8] text-[hsl(var(--muted-foreground))]">
                Codical helps teams code faster, stay compliant, and recover revenue—without a chaotic UI or constant motion.
              </p>

              <div className="mt-8 flex flex-wrap justify-center gap-10">
                <button className="ln-btn ln-btnPrimary ln-magnetic" onClick={() => setLocation("/signup")}>
                  Start free trial <ArrowRight size={18} />
                </button>
                <button className="ln-btn ln-btnSecondary ln-magnetic" onClick={() => setLocation("/login")}>
                  Schedule a demo
                </button>
              </div>

              <div className="mt-10 flex flex-wrap justify-center gap-2">
                <span className="ln-chip">
                  <span className="ln-chipSub">Security</span> HIPAA-ready
                </span>
                <span className="ln-chip">
                  <span className="ln-chipSub">Compliance</span> NCCI / LCD / NCD signals
                </span>
                <span className="ln-chip">
                  <span className="ln-chipSub">Scale</span> Teams + enterprise options
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
