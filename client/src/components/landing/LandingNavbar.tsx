import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ChevronRight, Menu, X, Moon, Sun, Sparkles, Cpu, Wrench, BadgeDollarSign } from "lucide-react";
import { useTheme } from "@/lib/theme";

export function LandingNavbar() {
  const [, setLocation] = useLocation();
  const { theme, toggle } = useTheme();

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };

    const onDown = (e: MouseEvent) => {
      const pop = popoverRef.current;
      if (!pop) return;
      if (pop.contains(e.target as Node)) return;
      setMobileOpen(false);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [mobileOpen]);

  const navLinks = [
    { label: "Features", href: "#features", Icon: Sparkles },
    { label: "AI Engine", href: "#ai-engine", Icon: Cpu },
    { label: "Tools", href: "#tools", Icon: Wrench },
    { label: "Pricing", href: "#pricing", Icon: BadgeDollarSign },
  ];

  const scrollTo = (href: string) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="ln-navWrap">
      <nav className={"ln-nav " + (scrolled ? "ln-scrolled" : "")}>
        <div className="ln-logo" onClick={() => scrollTo("#hero")} aria-label="Go to top">
          <div className="ln-bars" aria-hidden="true">
            <span className="ln-bar" />
            <span className="ln-bar" />
            <span className="ln-bar" />
            <span className="ln-bar" />
            <span className="ln-bar" />
          </div>
          <div className="ln-brandText">
            <strong>CODICAL</strong>
            <span>HEALTH</span>
          </div>
        </div>

        <div className="ln-navLinks" aria-label="Primary navigation">
          {navLinks.map((l) => (
            <button key={l.href} onClick={() => scrollTo(l.href)}>
              {l.label}
            </button>
          ))}
        </div>

        <div className="ln-actionsRight">
          <button className="ln-iconBtn" onClick={toggle} aria-label="Toggle theme" title="Toggle theme">
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Desktop CTAs */}
          <div className="ln-desktopOnly">
            <button className="ln-btn ln-btnSecondary ln-magnetic" onClick={() => setLocation("/login")}>
              Log in
            </button>

            <button className="ln-btn ln-btnPrimary ln-magnetic" onClick={() => setLocation("/signup")}>
              Start Free Trial <ChevronRight size={16} />
            </button>
          </div>

          {/* Mobile menu icon */}
          <button
            className="ln-iconBtn ln-mobileOnly"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            title={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div ref={popoverRef} className="ln-mobilePopover">
          <div className="ln-mobileLinks">
            {navLinks.map((l) => (
              <button key={l.href} className="ln-mobileLink" onClick={() => scrollTo(l.href)}>
                <l.Icon size={16} />
                {l.label}
              </button>
            ))}
          </div>

          <div className="ln-mobileCtas">
            <button className="ln-btn ln-btnSecondary ln-magnetic" onClick={() => setLocation("/login")}>
              Log in
            </button>
            <button className="ln-btn ln-btnPrimary ln-magnetic" onClick={() => setLocation("/signup")}>
              Start Free Trial <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
