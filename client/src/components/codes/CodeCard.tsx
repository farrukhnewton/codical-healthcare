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

const TYPE_STYLES: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  "ICD-10-CM": { bg: "bg-sky-50/60", border: "border-sky-300", text: "text-sky-700", badge: "bg-sky-100/80 text-sky-700" },
  "CPT": { bg: "bg-emerald-50/60", border: "border-emerald-300", text: "text-emerald-700", badge: "bg-emerald-100/80 text-emerald-700" },
  "HCPCS": { bg: "bg-amber-50/60", border: "border-amber-300", text: "text-amber-700", badge: "bg-amber-100/80 text-amber-700" },
};

export function CodeCard({ code, isSelected = false, onClick, isFavorite = false, onToggleFavorite }: CodeCardProps) {
  const styles = TYPE_STYLES[code.type] || TYPE_STYLES["ICD-10-CM"];
  const handleFavorite = (e: React.MouseEvent) => { e.stopPropagation(); onToggleFavorite?.(e); };

  return (
    <motion.div
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        "p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300",
        isSelected
          ? cn(styles.bg, styles.border, "shadow-lg")
          : "border-white/60 hover:border-emerald-200/60 hover:shadow-md"
      )}
      style={isSelected ? undefined : {
        background: "rgba(255,255,255,0.5)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "px-3 py-2 rounded-xl font-bold font-mono text-sm flex-shrink-0",
          styles.badge
        )}>
          {code.code}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm line-clamp-2 leading-relaxed">
            {code.description?.replace(/^"|"$/g, "")}
          </p>
          {code.category && (
            <p className="text-xs text-gray-500 mt-1.5 font-medium">{code.category}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleFavorite}
            className={cn(
              "p-2 rounded-xl transition-colors",
              isFavorite
                ? "text-amber-500 hover:bg-amber-50"
                : "text-gray-300 hover:text-emerald-500 hover:bg-emerald-50/50"
            )}
          >
            {isFavorite ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          </button>
          <ChevronRight className={cn(
            "w-5 h-5 flex-shrink-0 transition-colors",
            isSelected ? styles.text : "text-gray-300"
          )} />
        </div>
      </div>
    </motion.div>
  );
}
