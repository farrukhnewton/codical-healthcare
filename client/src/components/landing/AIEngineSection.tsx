import { OrganicCard } from "@/components/ui/OrganicCard";
import { HoloBadge } from "@/components/ui/HoloBadge";

const PIPELINE_STEPS = [
  { step: "01", title: "Input", desc: "Clinical notes, encounter data, or code queries", color: "#4ADE80" },
  { step: "02", title: "AI Analysis", desc: "Gemini processes against 114,000+ codes & CMS rules", color: "#38BDF8" },
  { step: "03", title: "Validation", desc: "NCCI edits, LCD/NCD checks, modifier validation", color: "#A78BFA" },
  { step: "04", title: "Output", desc: "Verified codes with confidence scores & documentation", color: "#FBBF24" },
];

export function AIEngineSection() {
  return (
    <section id="ai-engine" className="py-20 sm:py-32 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-50 border border-violet-200/60 mb-6">
            <span className="text-sm font-semibold text-violet-700">AI Engine</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-gray-900 mb-6">
            Powered by{" "}
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(135deg, #7C3AED, #0369A1)" }}>
              Gemini AI
            </span>
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed">
            Our four-stage pipeline processes clinical data through 114,000+ medical codes 
            with real-time CMS compliance checking.
          </p>
        </div>

        {/* Pipeline */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {PIPELINE_STEPS.map((step, i) => (
            <OrganicCard key={i} className="p-6 text-center group">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white font-black text-lg transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: step.color }}
              >
                {step.step}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
              <p className="text-sm text-gray-600">{step.desc}</p>
              {i < 3 && (
                <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 text-gray-300 text-2xl">
                  &rarr;
                </div>
              )}
            </OrganicCard>
          ))}
        </div>

        {/* Code badges demo */}
        <OrganicCard className="p-8 sm:p-10">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Multi-Code Intelligence</h3>
              <p className="text-gray-600 mb-6">
                Our AI understands relationships between ICD-10, CPT, and HCPCS codes.
                It validates combinations, checks bundling rules, and suggests optimal code sets.
              </p>
              <div className="flex flex-wrap gap-3">
                <HoloBadge code="E11.65" type="ICD-10-CM" />
                <HoloBadge code="99214" type="CPT" />
                <HoloBadge code="G0108" type="HCPCS" />
                <HoloBadge code="J7050" type="HCPCS" />
                <HoloBadge code="36415" type="CPT" />
              </div>
            </div>
            <div className="space-y-4">
              {[
                { label: "Code Accuracy", value: 99.2, color: "#4ADE80" },
                { label: "Processing Speed", value: 96, color: "#38BDF8" },
                { label: "Compliance Rate", value: 98.7, color: "#A78BFA" },
                { label: "Revenue Recovery", value: 94, color: "#FBBF24" },
              ].map((metric, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-gray-700">{metric.label}</span>
                    <span className="font-bold" style={{ color: metric.color }}>{metric.value}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: metric.value + "%",
                        background: "linear-gradient(90deg, " + metric.color + ", " + metric.color + "80)",
                        transition: "width 1.5s cubic-bezier(0.16,1,0.3,1)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </OrganicCard>
      </div>
    </section>
  );
}
