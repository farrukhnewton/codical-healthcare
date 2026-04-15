import { motion } from "framer-motion";

interface LoadingStateProps {
  message?: string;
  variant?: "spinner" | "skeleton" | "dots";
}

export function LoadingState({ message = "Loading...", variant = "spinner" }: LoadingStateProps) {
  if (variant === "skeleton") {
    return (
      <div className="space-y-4 p-4 w-full animate-fade-in">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100/40 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-emerald-100/40 rounded-lg w-3/4 animate-pulse" style={{ animationDelay: i * 100 + "ms" }} />
              <div className="h-3 bg-emerald-50/60 rounded-lg w-1/2 animate-pulse" style={{ animationDelay: i * 100 + 50 + "ms" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "dots") {
    return (
      <div className="flex flex-col items-center justify-center p-12 w-full min-h-[200px]">
        <div className="flex gap-2 mb-4">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-3 h-3 rounded-full"
              style={{ background: ["#4ADE80", "#38BDF8", "#A78BFA"][i] }}
              animate={{ y: [0, -10, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.7, delay: i * 0.15, repeat: Infinity }}
            />
          ))}
        </div>
        <p className="text-sm font-medium text-gray-500">{message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-12 w-full min-h-[200px]">
      <div className="w-10 h-10 rounded-full animate-spin mb-4"
        style={{ border: "3px solid rgba(74,222,128,0.2)", borderTopColor: "#15803D" }}
      />
      <p className="text-sm font-medium text-gray-500">{message}</p>
    </div>
  );
}
