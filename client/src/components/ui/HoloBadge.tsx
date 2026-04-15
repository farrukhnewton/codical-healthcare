import { cn } from "@/lib/utils";

interface HoloBadgeProps {
  code: string;
  type?: string;
  className?: string;
}

const TYPE_STYLES: Record<string, string> = {
  "ICD-10-CM": "bg-gradient-to-r from-blue-500/10 via-sky-400/5 to-blue-500/10 text-blue-600",
  "CPT": "bg-gradient-to-r from-emerald-500/10 via-green-400/5 to-emerald-500/10 text-emerald-600",
  "HCPCS": "bg-gradient-to-r from-amber-500/10 via-yellow-400/5 to-amber-500/10 text-amber-600",
};

export function HoloBadge({ code, type = "CPT", className }: HoloBadgeProps) {
  const style = TYPE_STYLES[type] || TYPE_STYLES["CPT"];

  return (
    <span
      className={cn(
        "inline-flex items-center px-4 py-1.5 rounded-lg font-mono text-sm font-bold",
        "relative overflow-hidden holo-shine",
        "bg-[length:200%_auto] animate-[holographic_4s_ease_infinite]",
        style,
        className
      )}
    >
      {code}
    </span>
  );
}