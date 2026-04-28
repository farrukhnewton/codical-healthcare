import { Shield, Lock, Zap } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

const FOOTER_LINKS = [
  {
    title: "Product",
    links: ["Features", "Pricing", "AI Engine", "Code Search", "Compliance", "Analytics"],
  },
  {
    title: "Resources",
    links: ["Documentation", "API Reference", "CMS Updates", "Blog", "Webinars", "Case Studies"],
  },
  {
    title: "Company",
    links: ["About", "Careers", "Contact", "Partners", "Press"],
  },
  {
    title: "Legal",
    links: ["Privacy Policy", "Terms of Service", "BAA", "Security", "HIPAA"],
  },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-gray-200/60 bg-white/40 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="mb-4">
              <BrandMark />
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-4">
              AI-powered healthcare revenue cycle management platform.
            </p>
            <div className="flex items-center gap-3">
              {[
                { icon: Shield, label: "HIPAA" },
                { icon: Lock, label: "SOC 2" },
                { icon: Zap, label: "SSL" },
              ].map((badge, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 text-[10px] text-gray-400 font-semibold"
                >
                  <badge.icon className="w-3 h-3" />
                  {badge.label}
                </div>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_LINKS.map((section, i) => (
            <div key={i}>
              <h4 className="text-sm font-bold text-gray-900 mb-4">{section.title}</h4>
              <ul className="space-y-2.5">
                {section.links.map((link, j) => (
                  <li key={j}>
                    <a href="#" className="text-sm text-gray-500 hover:text-emerald-600 transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} Codical Health Solutions. All rights reserved.
          </p>
          <p className="text-xs text-gray-400">
            Built with AI &middot; Powered by Gemini &middot; 114,000+ Medical Codes
          </p>
        </div>
      </div>
    </footer>
  );
}
