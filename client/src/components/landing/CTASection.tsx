import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  const [, setLocation] = useLocation();

  return (
    <section className="py-20 sm:py-32 px-4">
      <div className="max-w-4xl mx-auto">
        <div
          className="rounded-3xl p-10 sm:p-16 text-center relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #14532D 0%, #0369A1 50%, #7C3AED 100%)",
          }}
        >
          {/* Decorative blobs */}
          <div
            className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-20"
            style={{
              background: "radial-gradient(circle, rgba(74,222,128,0.4), transparent)",
              filter: "blur(40px)",
            }}
          />
          <div
            className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full opacity-20"
            style={{
              background: "radial-gradient(circle, rgba(56,189,248,0.4), transparent)",
              filter: "blur(40px)",
            }}
          />

          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-6 tracking-tight">
              Ready to Transform Your
              <br />
              Revenue Cycle?
            </h2>
            <p className="text-lg text-white/80 mb-10 max-w-2xl mx-auto">
              Join thousands of healthcare professionals using Codical Health to code faster,
              bill smarter, and recover more revenue.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={() => setLocation("/signup")}
                className="group px-8 py-4 bg-white text-emerald-800 font-bold rounded-2xl text-base hover:scale-105 transition-all duration-300 shadow-xl"
              >
                Start Free Trial
                <ArrowRight className="inline w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => setLocation("/login")}
                className="px-8 py-4 text-white/90 font-semibold rounded-2xl text-base border-2 border-white/30 hover:bg-white/10 transition-all duration-300"
              >
                Schedule Demo
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
