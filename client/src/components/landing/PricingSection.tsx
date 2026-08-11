import { useLocation } from "wouter";
import { Check, Star } from "lucide-react";
import { OrganicCard } from "@/components/ui/OrganicCard";

const PLANS = [
  {
    name: "Starter",
    price: "Free",
    desc: "For essential research and reference work",
    features: ["Code Search", "CMS Guidelines", "RVU Calculator", "NPI Lookup"],
    cta: "Get started",
    popular: false,
  },
  {
    name: "Premium",
    price: "$249",
    desc: "For connected coding and validation teams",
    features: ["Everything in Starter", "ICD/CPT Crosswalk", "Team Chats", "All Validation Tools"],
    cta: "Get started",
    popular: false,
  },
  {
    name: "Enterprise",
    price: "$399",
    desc: "For AI-enabled specialty operations",
    features: ["Everything in Premium", "AI Coding", "AI Transcription", "Specialty Coding"],
    cta: "Request a demo",
    popular: true,
  },
];

export function PricingSection() {
  const [, setLocation] = useLocation();

  return (
    <section id="pricing" className="py-20 sm:py-32 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200/60 mb-6">
            <span className="text-sm font-semibold text-amber-700">Pricing</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-gray-900 mb-6">
            Simple,{" "}
            <span className="text-emerald-600">Transparent</span> Pricing
          </h2>
          <p className="text-lg text-gray-600">
            Start free. Scale as you grow. No hidden fees.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 items-start">
          {PLANS.map((plan, i) => (
            <OrganicCard
              key={i}
              className={
                "p-8 relative " +
                (plan.popular ? "ring-2 ring-emerald-400 scale-[1.02]" : "")
              }
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
                  <Star className="w-3 h-3" /> Most Popular
                </div>
              )}
              <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
              <div className="mt-4 mb-2">
                <span className="text-4xl font-black text-gray-900">{plan.price}</span>
              </div>
              <p className="text-sm text-gray-600 mb-6">{plan.desc}</p>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-start gap-3 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => setLocation(plan.name === "Enterprise" ? "/signup?intent=demo" : "/signup")}
                className={
                  "w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300 hover:scale-[1.02] " +
                  (plan.popular
                    ? "text-white shadow-lg hover:shadow-xl"
                    : "text-gray-700 border-2 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50")
                }
                style={
                  plan.popular
                    ? {
                        background: "linear-gradient(135deg, #15803D 0%, #0369A1 100%)",
                        boxShadow: "0 4px 24px rgba(21,128,61,0.25)",
                      }
                    : undefined
                }
              >
                {plan.cta}
              </button>
            </OrganicCard>
          ))}
        </div>
      </div>
    </section>
  );
}
