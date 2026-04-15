import { Link, useLocation } from "wouter";
import { Stethoscope, Search, Bookmark, FileText } from "lucide-react";
import logoUrl from "@assets/55555Screenshot_2025-12-01_181512_1772553010861.png";

export function Navbar() {
  const [location] = useLocation();

  const navLinks = [
    { href: "/", label: "Code Search", icon: Search },
    { href: "/favorites", label: "Favorites", icon: Bookmark },
    { href: "/guidelines", label: "CMS Guidelines", icon: FileText },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-border/50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity group">
              <div className="bg-primary rounded-xl p-2 shadow-lg h-12 w-12 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Stethoscope className="w-7 h-7 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tighter text-primary leading-none uppercase">
                  Codical
                </span>
                <span className="text-sm font-bold text-secondary leading-none">
                  Health
                </span>
              </div>
            </Link>
          </div>
          
          <nav className="flex items-center gap-2 bg-muted/30 p-1 rounded-2xl border border-border/50">
            {navLinks.map((link) => {
              const isActive = location === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`
                    flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300
                    ${isActive 
                      ? "bg-primary text-white shadow-md scale-105" 
                      : "text-muted-foreground hover:bg-white hover:text-primary hover:shadow-sm"
                    }
                  `}
                >
                  <link.icon className={`w-4 h-4 ${isActive ? "animate-pulse" : ""}`} />
                  <span className="hidden md:inline">{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
