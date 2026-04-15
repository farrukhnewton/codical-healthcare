import { OrganicCard } from "@/components/ui/OrganicCard";
import { OrganicIcon } from "@/components/ui/OrganicIcon";

const TOOL_CATEGORIES = [
  {
    title: "Medical Coding",
    emoji: "🏥",
    variant: "forest" as const,
    tools: [
      "ICD-10 Code Search",
      "CPT Code Lookup",
      "HCPCS Browser",
      "AI Code Suggestions",
      "Code Crosswalks",
    ],
  },
  {
    title: "Compliance & Audit",
    emoji: "🛡️",
    variant: "ocean" as const,
    tools: [
      "NCCI Edit Checker",
      "LCD/NCD Lookup",
      "Modifier Validation",
      "Audit Risk Scanner",
      "Denial Prevention",
    ],
  },
  {
    title: "Clinical Reference",
    emoji: "📚",
    variant: "aurora" as const,
    tools: [
      "Drug Lookup (NDC)",
      "NPI Registry",
      "RVU Calculator",
      "Fee Schedule Lookup",
      "Anesthesia Calculator",
    ],
  },
];

export function ToolsSection() {
  return (
    <section id="tools" className="py-20 sm:py-32 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200/60 mb-6">
            <span className="text-sm font-semibold text-emerald-700">50+ Tools</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-gray-900 mb-6">
            One Platform,{" "}
            <span className="text-emerald-600">Every Tool</span>
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed">
            Stop switching between apps. Codical Health brings every medical coding and billing tool into one intelligent workspace.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {TOOL_CATEGORIES.map((category, i) => (
            <OrganicCard key={i} className="p-8 group">
              <OrganicIcon variant={category.variant} className="mb-5 group-hover:scale-110 transition-transform duration-300">
                {category.emoji}
              </OrganicIcon>
              <h3 className="text-xl font-bold text-gray-900 mb-4">{category.title}</h3>
              <ul className="space-y-3">
                {category.tools.map((tool, j) => (
                  <li key={j} className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    {tool}
                  </li>
                ))}
              </ul>
            </OrganicCard>
          ))}
        </div>
      </div>
    </section>
  );
}
