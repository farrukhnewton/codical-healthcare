import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Menu, X, ChevronRight } from "lucide-react";

export function LandingNavbar() {
  const [, setLocation] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const navLinks = [
    { label: "Features", href: "#features" },
    { label: "AI Engine", href: "#ai-engine" },
    { label: "Tools", href: "#tools" },
    { label: "Pricing", href: "#pricing" },
  ];

  const scrollTo = (href: string) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav
      className={
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500 " +
        (scrolled
          ? "bg-white/80 backdrop-blur-xl shadow-glass border-b border-white/60"
          : "bg-transparent")
      }
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => scrollTo("#hero")}>
            <div className="flex items-end gap-[3px] h-8">
              {[
                { c: "#E8541A", h: 16 },
                { c: "#C43B0E", h: 22 },
                { c: "#1B2F6E", h: 28 },
                { c: "#F0A500", h: 22 },
                { c: "#E8541A", h: 16 },
              ].map((bar, i) => (
                <div
                  key={i}
                  className="w-[5px] rounded-sm transition-all duration-300"
                  style={{ backgroundColor: bar.c, height: bar.h + "px" }}
                />
              ))}
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-base font-black tracking-tight text-gray-900">CODICAL</span>
              <span className="text-[10px] font-bold tracking-widest text-emerald-600 uppercase">Health</span>
            </div>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-emerald-700 rounded-lg hover:bg-emerald-50/50 transition-all duration-200"
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => setLocation("/login")}
              className="px-4 py-2 text-sm font-semibold text-gray-700 hover:text-emerald-700 transition-colors"
            >
              Log in
            </button>
            <button
              onClick={() => setLocation("/signup")}
              className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg"
              style={{
                background: "linear-gradient(135deg, #15803D 0%, #0369A1 100%)",
                boxShadow: "0 4px 24px rgba(21,128,61,0.25)",
              }}
            >
              Start Free Trial
              <ChevronRight className="inline w-4 h-4 ml-1" />
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-xl border-t border-gray-100 shadow-xl">
          <div className="px-4 py-4 space-y-1">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-700 hover:bg-emerald-50 rounded-lg transition-colors"
              >
                {link.label}
              </button>
            ))}
            <div className="pt-3 border-t border-gray-100 flex gap-2">
              <button
                onClick={() => setLocation("/login")}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                Log in
              </button>
              <button
                onClick={() => setLocation("/signup")}
                className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl"
                style={{ background: "linear-gradient(135deg, #15803D, #0369A1)" }}
              >
                Start Free
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
