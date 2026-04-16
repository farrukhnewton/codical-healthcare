import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Menu, X, Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

export function LandingNavbarNext() {
  const [, setLocation] = useLocation();
  const { theme, toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      <nav className={`ln-nav ln-glassStrong border border-[var(--border)] ${scrolled ? 'scrolled' : ''}`}>
        
        {/* Logo */}
        <div className="ln-navLogo cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
          <div className="ln-logoBars">
            <div className="ln-logoBar"></div>
            <div className="ln-logoBar"></div>
            <div className="ln-logoBar"></div>
          </div>
          Codical
        </div>

        {/* Desktop Links */}
        <div className="ln-navLinks">
          <button onClick={() => scrollTo('features')} className="ln-navLink bg-transparent border-none cursor-pointer">Features</button>
          <button onClick={() => scrollTo('workflow')} className="ln-navLink bg-transparent border-none cursor-pointer">Workflow</button>
          <button onClick={() => scrollTo('pricing')} className="ln-navLink bg-transparent border-none cursor-pointer">Pricing</button>
        </div>

        {/* Actions Desktop */}
        <div className="hidden md:flex items-center gap-4">
          <button onClick={toggle} className="p-2 rounded-full hover:bg-[var(--bg1)] transition cursor-pointer text-[var(--muted)] hover:text-[var(--fg)]">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={() => scrollTo('pricing')} className="font-medium text-sm text-[var(--muted)] hover:text-[var(--fg)] transition cursor-pointer bg-transparent border-none">
            See pricing
          </button>
          <button 
            onClick={() => setLocation('/signup')} 
            className="ln-btn ln-btnPrimary magnetic text-sm"
          >
            Start free
          </button>
        </div>

        {/* Mobile Toggle */}
        <div className="flex md:hidden items-center gap-2">
          <button onClick={toggle} className="p-2 rounded-full text-[var(--muted)] cursor-pointer bg-transparent border-none">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button 
            className="p-2 text-[var(--fg)] bg-transparent border-none cursor-pointer"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 pt-24 px-4 pb-6 ln-glassStrong flex flex-col gap-6 md:hidden">
            <button onClick={() => scrollTo('features')} className="text-2xl font-bold text-left bg-transparent border-none text-[var(--fg)]">Features</button>
            <button onClick={() => scrollTo('workflow')} className="text-2xl font-bold text-left bg-transparent border-none text-[var(--fg)]">Workflow</button>
            <button onClick={() => scrollTo('pricing')} className="text-2xl font-bold text-left bg-transparent border-none text-[var(--fg)]">Pricing</button>
            
            <div className="mt-auto flex flex-col gap-4">
              <button onClick={() => scrollTo('pricing')} className="ln-btn ln-btnSecondary w-full py-4 text-lg">
                See pricing
              </button>
              <button onClick={() => setLocation('/signup')} className="ln-btn ln-btnPrimary w-full py-4 text-lg">
                Start free
              </button>
            </div>
        </div>
      )}
    </>
  );
}
