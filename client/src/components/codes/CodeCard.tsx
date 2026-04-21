import { motion } from "framer-motion";
import { Bookmark, BookmarkCheck, ChevronRight } from "lucide-react";
import { MedicalCode } from "shared/schema";
import { cn } from "@/lib/utils";

interface CodeCardProps {
  code: MedicalCode;
  isSelected?: boolean;
  onClick?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: (e: React.MouseEvent) => void;
}

const TYPE_STYLES: Record<string, { pill: string; chevron: string; ring: string }> = {
  "ICD-10-CM": {
    pill: "bg-sky-500/15 text-sky-700 dark:text-sky-200",
    chevron: "text-sky-600/80 dark:text-sky-300/80",
    ring: "ring-sky-500/25",
  },
  CPT: {
    pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200",
    chevron: "text-emerald-600/80 dark:text-emerald-300/80",
    ring: "ring-emerald-500/25",
  },
  HCPCS: {
    pill: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
    chevron: "text-amber-600/80 dark:text-amber-300/80",
    ring: "ring-amber-500/25",
  },
};

export function CodeCard({
  code,
  isSelected = false,
  onClick,
  isFavorite = false,
  onToggleFavorite,
}: CodeCardProps) {
  const styles = TYPE_STYLES[code.type] || TYPE_STYLES["ICD-10-CM"];
  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.(e);
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01, y: -1 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        "p-4 rounded-2xl cursor-pointer transition-colors duration-200 appCard",
        isSelected ? "appGlassStrong ring-2" : "appGlass ring-1 hover:bg-background/40",
        isSelected ? styles.ring : "ring-white/10 dark:ring-white/10"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "px-3 py-2 rounded-xl font-black font-mono text-sm flex-shrink-0",
            styles.pill
          )}
        >
          {code.code}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground text-sm line-clamp-2 leading-relaxed">
            {code.description?.replace(/^\"|\"$/g, "")}
          </p>

          {code.category && (
            <p className="text-xs text-muted-foreground mt-1.5 font-medium">
              {code.category}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleFavorite}
            className={cn(
              "p-2 rounded-xl transition-colors appFocusRing",
              isFavorite
                ? "text-amber-400 hover:bg-amber-500/10"
                : "text-muted-foreground/60 hover:text-emerald-400 hover:bg-emerald-500/10"
            )}
            aria-label={isFavorite ? "Remove favorite" : "Add favorite"}
          >
            {isFavorite ? (
              <BookmarkCheck className="w-4 h-4" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
          </button>

          <ChevronRight
            className={cn(
              "w-5 h-5 flex-shrink-0 transition-colors",
              isSelected ? styles.chevron : "text-muted-foreground/40"
            )}
          />
        </div>
      </div>
    </motion.div>
  );
}

