import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  root: path.resolve(__dirname, "client"),
  publicDir: path.resolve(__dirname, "client/public"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Split a few heavy libs; keep UI libs in vendor to avoid circular chunk warnings.
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react-dom") || id.includes("react/") || id.includes("scheduler") || id.includes("wouter")) return "vendor-react";
            if (id.includes("@supabase")) return "vendor-supabase";
            if (id.includes("@tanstack")) return "vendor-tanstack";
            if (id.includes("framer-motion")) return "vendor-motion";
            if (id.includes("lucide-react")) return "vendor-icons";
            if (id.includes("chart.js") || id.includes("recharts") || id.includes("d3")) return "vendor-charts";
            if (id.includes("@radix-ui")) return "vendor-radix";
            if (id.includes("emoji-picker-react") || id.includes("socket.io-client")) return "vendor-chat";
            if (id.includes("react-hook-form") || id.includes("@hookform") || id.includes("zod")) return "vendor-forms";
            if (id.includes("date-fns")) return "vendor-date";
            if (id.includes("cmdk") || id.includes("vaul") || id.includes("react-day-picker") || id.includes("input-otp")) return "vendor-ui-extended";
            if (id.includes("@headlessui") || id.includes("embla-carousel")) return "vendor-ui-extended";
            return "vendor-misc";
          }
        },
      },
    },
  },
});
