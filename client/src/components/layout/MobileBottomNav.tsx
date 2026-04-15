import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Search, 
  ClipboardList, 
  Bookmark, 
  MoreHorizontal,
  ShieldCheck,
  MessageSquare
} from "lucide-react";
import { motion } from "framer-motion";

const MOBILE_NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/workbench", label: "Workbench", icon: ClipboardList },
  { href: "/workspace", label: "AI Copy", icon: Bookmark },
  { href: "/search", label: "Search", icon: Search },
  { href: "/compliance", label: "Audit", icon: ShieldCheck }, // Admin focused
];

export function MobileBottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-t border-emerald-100/60 dark:border-emerald-900/30 px-6 flex items-center justify-between pb-safe z-50 lg:hidden">
      {MOBILE_NAV_ITEMS.map((item) => {
        const isActive = location === item.href;
        return (
          <Link key={item.href} href={item.href}>
            <div className="flex flex-col items-center gap-1 cursor-pointer">
              <div className="relative">
                <item.icon 
                  className={`w-6 h-6 transition-all ${
                    isActive 
                      ? "text-emerald-600 dark:text-emerald-400" 
                      : "text-gray-400 dark:text-gray-500"
                  }`} 
                />
                {isActive && (
                  <motion.div 
                    layoutId="activeNav"
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-500 rounded-full"
                  />
                )}
              </div>
              <span className={`text-[10px] font-bold ${
                isActive 
                  ? "text-emerald-600 dark:text-emerald-400" 
                  : "text-gray-400 dark:text-gray-500"
              }`}>
                {item.label}
              </span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
