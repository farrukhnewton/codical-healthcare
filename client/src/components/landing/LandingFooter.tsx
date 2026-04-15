import { Shield, Lock, Zap } from "lucide-react";

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
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-end gap-[3px] h-7">
                {[
                  { c: "#E8541A", h: 14 },
                  { c: "#C43B0E", h: 18 },
                  { c: "#1B2F6E", h: 24 },
                  { c: "#F0A500", h: 18 },
                  { c: "#E8541A", h: 14 },
                ].map((bar, i) => (
                  <div
                    key={i}
                    className="w-[4px] rounded-sm"
                    style={{ backgroundColor: bar.c, height: bar.h + "px" }}
                  />
                ))}
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-sm font-black tracking-tight text-gray-900">CODICAL</span>
                <span className="text-[9px] font-bold tracking-widest text-emerald-600 uppercase">Health</span>
              </div>
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
