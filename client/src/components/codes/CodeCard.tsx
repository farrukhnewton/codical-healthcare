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

export function CodeCard({
  code,
  isSelected = false,
  onClick,
  isFavorite = false,
  onToggleFavorite,
}: CodeCardProps) {
  const handleFavorite = (event: React.MouseEvent) => {
    event.stopPropagation();
    onToggleFavorite?.(event);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onClick?.();
  };

  return (
    <motion.div
      role="button"
      tabIndex={0}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn("code-result-card", isSelected && "is-selected")}
    >
      <span className="tool-code-chip" data-type={code.type}>
        {code.code}
      </span>

      <span className="code-result-copy">
        <strong>{code.description?.replace(/^\"|\"$/g, "")}</strong>
        <small>{code.category || code.type}</small>
      </span>

      <span className="code-result-actions">
        <button
          type="button"
          onClick={handleFavorite}
          className="tool-icon-action"
          aria-label={isFavorite ? "Remove favorite" : "Add favorite"}
        >
          {isFavorite ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
        </button>

        <ChevronRight size={17} aria-hidden="true" />
      </span>
    </motion.div>
  );
}
