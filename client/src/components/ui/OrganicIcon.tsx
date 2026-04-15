import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface OrganicIconProps {
  children: ReactNode;
  variant?: "ocean" | "forest" | "aurora" | "sunrise" | "coral" | "earth";
  className?: string;
  animate?: boolean;
}

const VARIANTS: Record<string, string> = {
  ocean: "from-sky-400/20 to-blue-500/10 shadow-[0_0_20px_rgba(56,189,248,0.1)]",
  forest: "from-green-400/20 to-emerald-500/10 shadow-[0_0_20px_rgba(74,222,128,0.1)]",
  aurora: "from-violet-400/20 to-purple-500/10 shadow-[0_0_20px_rgba(167,139,250,0.1)]",
  sunrise: "from-amber-400/20 to-orange-500/10 shadow-[0_0_20px_rgba(251,191,36,0.1)]",
  coral: "from-pink-400/20 to-rose-500/10 shadow-[0_0_20px_rgba(244,114,182,0.1)]",
  earth: "from-amber-300/20 to-orange-400/10 shadow-[0_0_20px_rgba(212,165,116,0.1)]",
};

export function OrganicIcon({ children, variant = "forest", className, animate = true }: OrganicIconProps) {
  return (
    <div
      className={cn(
        "w-[52px] h-[52px] flex items-center justify-center text-[22px]",
        "bg-gradient-to-br",
        VARIANTS[variant],
        animate && "animate-[morphBlob_12s_ease-in-out_infinite]",
        "transition-all duration-300",
        className
      )}
      style={{ borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%" }}
    >
      {children}
    </div>
  );
}