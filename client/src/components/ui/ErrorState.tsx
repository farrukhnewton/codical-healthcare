import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "./button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load the requested data.",
  onRetry
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 w-full h-full min-h-[200px] text-center rounded-2xl border-2 border-dashed border-red-200/60"
      style={{ background: "rgba(255,255,255,0.4)", backdropFilter: "blur(12px)" }}>
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-red-400" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 mb-6 max-w-md">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="gap-2 rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-50/50">
          <RefreshCcw className="w-4 h-4" />
          Retry Request
        </Button>
      )}
    </div>
  );
}
