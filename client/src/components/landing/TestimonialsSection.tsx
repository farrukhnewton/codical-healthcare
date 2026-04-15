import { OrganicCard } from "@/components/ui/OrganicCard";
import { Star } from "lucide-react";

const TESTIMONIALS = [
  {
    name: "Dr. Sarah Chen",
    role: "Medical Director, Pacific Health Group",
    text: "Codical Health transformed our coding accuracy from 87% to 99%. The AI suggestions are incredibly precise and save our team hours every day.",
    rating: 5,
    impact: "+12% Revenue",
  },
  {
    name: "Marcus Williams",
    role: "CPC, Revenue Cycle Manager",
    text: "The NCCI checker alone paid for itself in the first month. We caught bundling errors we'd been missing for years. Absolute game-changer.",
    rating: 5,
    impact: "$340K Recovered",
  },
  {
    name: "Jennifer Martinez",
    role: "Billing Supervisor, Metro Clinic",
    text: "50+ tools in one platform means we cancelled 4 other subscriptions. The AI code suggestions are faster and more accurate than anything else we've tried.",
    rating: 5,
    impact: "3x Productivity",
  },
  {
    name: "Dr. Robert Kim",
    role: "Orthopedic Surgeon",
    text: "As a physician, I need coding to be fast and accurate. Codical gives me confidence that every claim is optimized without compliance risk.",
    rating: 5,
    impact: "40% Time Saved",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-20 sm:py-32 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-50 border border-pink-200/60 mb-6">
            <span className="text-sm font-semibold text-pink-700">Trusted by Healthcare Leaders</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-gray-900 mb-6">
            Real Results from{" "}
            <span className="text-emerald-600">Real Teams</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 sm:gap-8">
          {TESTIMONIALS.map((t, i) => (
            <OrganicCard key={i} className="p-8">
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-gray-700 leading-relaxed mb-6 italic">"{t.text}"</p>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-gray-900">{t.name}</div>
                  <div className="text-sm text-gray-500">{t.role}</div>
                </div>
                <div className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg">
                  {t.impact}
                </div>
              </div>
            </OrganicCard>
          ))}
        </div>
      </div>
    </section>
  );
}
