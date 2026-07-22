import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function InfoHint({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("ui-info-hint", className)} tabIndex={0} aria-label={label}>
      <Info size={13} aria-hidden="true" />
      <span role="tooltip">{label}</span>
    </span>
  );
}
