import { Link, useLocation } from "wouter";
import { Brain, LayoutDashboard, MessageSquare, MoreHorizontal, Search } from "lucide-react";

const MOBILE_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/search", label: "Search", icon: Search },
  { href: "/workspace", label: "Assistant", icon: Brain },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/reports", label: "More", icon: MoreHorizontal },
];

export function MobileBottomNav() {
  const [location] = useLocation();

  return (
    <nav className="app-mobile-bottom-nav" aria-label="Mobile navigation">
      {MOBILE_NAV_ITEMS.map((item) => {
        const active = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
        return (
          <Link key={item.href} href={item.href} className={`app-mobile-bottom-item${active ? " is-active" : ""}`}>
            <item.icon size={21} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
