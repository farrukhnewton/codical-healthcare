import { useLocation } from "wouter";
import { ArrowLeft, Search } from "lucide-react";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="w-24 h-24 rounded-3xl bg-emerald-50 flex items-center justify-center mb-6">
        <Search className="w-12 h-12 text-emerald-300" />
      </div>
      <h1 className="text-6xl font-black text-gray-900 mb-2">404</h1>
      <h2 className="text-xl font-bold text-gray-700 mb-3">Page Not Found</h2>
      <p className="text-gray-500 mb-8 max-w-md">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <button
        onClick={() => setLocation("/dashboard")}
        className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all hover:scale-105"
        style={{ background: "linear-gradient(135deg, #15803D, #0369A1)", boxShadow: "0 4px 24px rgba(21,128,61,0.25)" }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>
    </div>
  );
}
