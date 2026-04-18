import { OrganicCard } from "@/components/ui/OrganicCard";
import { OrganicIcon } from "@/components/ui/OrganicIcon";
import {
  Brain,
  FileText,
  BadgeDollarSign,
  ShieldCheck,
  BarChart3,
  Workflow,
} from "lucide-react";

const FEATURES = [
  {
    title: "AI Medical Coding",
    desc: "Gemini-powered code suggestions with 99.2% accuracy across ICD-10, CPT, HCPCS.",
    variant: "forest" as const,
    Icon: Brain,
  },
  {
    title: "Smart Documentation",
    desc: "AI reads clinical notes and extracts billable codes. Reduce manual review by 70%.",
    variant: "ocean" as const,
    Icon: FileText,
  },
  {
    title: "Revenue Optimizer",
    desc: "RVU calculator, fee schedules, and upcoding alerts for maximum reimbursement.",
    variant: "sunrise" as const,
    Icon: BadgeDollarSign,
  },
  {
    title: "Compliance Engine",
    desc: "Real-time NCCI edits, LCD/NCD checks, and modifier validation. Audit-ready 24/7.",
    variant: "aurora" as const,
    Icon: ShieldCheck,
  },
  {
    title: "Analytics Dashboard",
    desc: "Track coding patterns, denial rates, and revenue trends at a glance.",
    variant: "coral" as const,
    Icon: BarChart3,
  },
  {
    title: "Workflow Automation",
    desc: "Batch processing, auto-assignments, and smart queues. 3x more claims per day.",
    variant: "earth" as const,
    Icon: Workflow,
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 sm:py-32 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-50 border border-sky-200/60 mb-6">
            <span className="text-sm font-semibold text-sky-700">Platform Features</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-gray-900 mb-6">
            Everything You Need to <br />
            <span className="text-emerald-600">Code Smarter</span>
          </h2>

          <p className="text-lg text-gray-600 leading-relaxed">
            50+ tools for medical coders, billers, and revenue cycle teams. Powered by AI, backed by real CMS data.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {FEATURES.map((f, i) => (
            <OrganicCard key={i} className="group p-8">
              <OrganicIcon
                variant={f.variant}
                className="mb-5"
              >
                <f.Icon className="w-6 h-6 text-foreground/80" />
              </OrganicIcon>

              <h3 className="text-xl font-bold text-gray-900 mb-3">{f.title}</h3>
              <p className="text-gray-600 leading-relaxed">{f.desc}</p>
            </OrganicCard>
          ))}
        </div>
      </div>
    </section>
  );
}
