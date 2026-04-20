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
            if (id.includes("@supabase")) return "vendor-supabase";
            if (id.includes("@tanstack")) return "vendor-tanstack";
            if (id.includes("framer-motion")) return "vendor-motion";
            if (id.includes("lucide-react")) return "vendor-icons";
            if (id.includes("chart.js") || id.includes("recharts") || id.includes("d3")) return "vendor-charts";
            return "vendor";
          }
        },
      },
    },
  },
});
