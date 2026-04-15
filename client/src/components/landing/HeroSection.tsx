import { useLocation } from "wouter";
import { ArrowRight, Sparkles, Shield, Zap, TrendingUp } from "lucide-react";
import { ConfidenceRing } from "@/components/ui/ConfidenceRing";

export function HeroSection() {
  const [, setLocation] = useLocation();

  return (
    <section id="hero" className="relative pt-28 sm:pt-36 pb-20 sm:pb-32 px-4 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="space-y-8 animate-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200/60">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">AI-Powered Healthcare Intelligence</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1]">
              <span className="text-gray-900">Medical Coding</span>
              <br />
              <span className="text-emerald-600">Reimagined</span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 leading-relaxed max-w-xl">
              The most advanced AI platform for healthcare revenue cycle management.
              <span className="font-semibold text-gray-800"> 50+ tools. 114,000+ codes. </span>
              Real-time CMS data. Built for coders, billers, and clinicians.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => setLocation("/signup")}
                className="group px-8 py-4 text-base font-bold text-white rounded-2xl transition-all duration-300 hover:scale-105"
                style={{ background: "linear-gradient(135deg, #15803D 0%, #0369A1 100%)", boxShadow: "0 8px 32px rgba(21,128,61,0.3)" }}
              >
                Start Free Trial
                <ArrowRight className="inline w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => { const el = document.querySelector("#features"); if (el) el.scrollIntoView({ behavior: "smooth" }); }}
                className="px-8 py-4 text-base font-semibold text-gray-700 rounded-2xl border-2 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all duration-300"
              >
                See How It Works
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-6 pt-4">
              {[
                { icon: Shield, text: "HIPAA Compliant" },
                { icon: Zap, text: "Sub-second AI" },
                { icon: TrendingUp, text: "99.2% Accuracy" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-500">
                  <item.icon className="w-4 h-4 text-emerald-500" />
                  <span className="font-medium">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative animate-fade-up" style={{ animationDelay: "0.2s" }}>
            <div
              className="rounded-3xl p-6 sm:p-8 relative overflow-hidden"
              style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(20px) saturate(1.5)", border: "1px solid rgba(255,255,255,0.7)", boxShadow: "0 20px 60px rgba(0,0,0,0.08)" }}
            >
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
                <span className="ml-3 text-xs font-mono text-gray-400">codical-ai-engine</span>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg font-mono">CPT</span>
                  <span className="text-lg font-bold text-gray-900 font-mono">99214</span>
                  <span className="text-sm text-gray-500">Office Visit - Established</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-emerald-50 to-sky-50 rounded-xl p-4">
                    <div className="text-xs text-gray-500 mb-1">Confidence</div>
                    <div className="flex items-center gap-2">
                      <ConfidenceRing value={97} size={40} />
                      <span className="text-sm font-bold text-emerald-700">97%</span>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-sky-50 to-violet-50 rounded-xl p-4">
                    <div className="text-xs text-gray-500 mb-1">RVU Value</div>
                    <div className="text-2xl font-black text-sky-700">2.80</div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-2">AI Recommendation</div>
                  <p className="text-sm text-amber-800 font-medium">
                    Consider 99215 if documentation supports 40+ min or high complexity MDM.
                    Potential revenue increase: <span className="font-bold">+$47.20/visit</span>
                  </p>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "Code Validation", pct: 100, color: "#4ADE80" },
                    { label: "NCCI Compliance", pct: 100, color: "#38BDF8" },
                    { label: "Documentation Review", pct: 85, color: "#A78BFA" },
                  ].map((bar, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500 font-medium">{bar.label}</span>
                        <span className="font-bold" style={{ color: bar.color }}>{bar.pct}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{ width: bar.pct + "%", background: "linear-gradient(90deg, " + bar.color + ", " + bar.color + "88)" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div
              className="absolute -top-4 -right-4 px-4 py-2 rounded-xl animate-float"
              style={{ background: "rgba(255,255,255,0.8)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.6)", boxShadow: "0 8px 24px rgba(0,0,0,0.06)" }}
            >
              <span className="text-xs font-bold text-emerald-600">114,000+ Codes</span>
            </div>
            <div
              className="absolute -bottom-3 -left-3 px-4 py-2 rounded-xl animate-float"
              style={{ background: "rgba(255,255,255,0.8)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.6)", boxShadow: "0 8px 24px rgba(0,0,0,0.06)", animationDelay: "2s" }}
            >
              <span className="text-xs font-bold text-sky-600">Real-time CMS Data</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
