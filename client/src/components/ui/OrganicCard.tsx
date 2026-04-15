import { useRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface OrganicCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
  tilt?: boolean;
}

export function OrganicCard({ children, className, glowColor = "74,222,128", tilt = true }: OrganicCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current || !tilt) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    const rotateX = y * -4;
    const rotateY = x * 4;
    ref.current.style.transform = "translateY(-8px) perspective(1000px) rotateX(" + rotateX + "deg) rotateY(" + rotateY + "deg)";
    ref.current.style.setProperty("--mx", ((e.clientX - rect.left) / rect.width * 100) + "%");
    ref.current.style.setProperty("--my", ((e.clientY - rect.top) / rect.height * 100) + "%");
  };

  const handleMouseLeave = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "glass rounded-2xl p-6 relative overflow-hidden cursor-default",
        "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "hover:shadow-glass-hover hover:bg-white/65",
        className
      )}
      style={{
        background: "rgba(255,255,255,0.45)",
        backdropFilter: "blur(20px) saturate(1.5)",
        border: "1px solid rgba(255,255,255,0.6)",
      }}
    >
      {/* Mouse-tracking inner glow */}
      <div
        className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity pointer-events-none rounded-2xl"
        style={{
          background: "radial-gradient(600px circle at var(--mx, 50%) var(--my, 50%), rgba(" + glowColor + ",0.06), rgba(56,189,248,0.03), transparent 60%)",
        }}
      />
      {/* Holographic border on hover */}
      <div
        className="absolute inset-[-1px] rounded-2xl z-[-1] opacity-0 hover:opacity-100 transition-opacity"
        style={{
          background: "linear-gradient(135deg, rgba(74,222,128,0.2), rgba(56,189,248,0.15), rgba(167,139,250,0.1), rgba(244,114,182,0.1))",
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
