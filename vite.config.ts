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
    modulePreload: {
      resolveDependencies(_filename, deps, context) {
        if (context.hostType !== "html") return deps;
        return deps.filter((dep) => !/vendor-(charts|motion)-/.test(dep));
      },
    },
    rollupOptions: {
      output: {
        // Split a few heavy libs; keep UI libs in vendor to avoid circular chunk warnings.
        manualChunks(id) {
          const moduleId = id.replace(/\\/g, "/");

          if (
            moduleId.includes("node_modules/react-dom") ||
            moduleId.includes("node_modules/react/") ||
            moduleId.includes("node_modules/scheduler") ||
            moduleId.includes("node_modules/wouter") ||
            moduleId.includes("react/jsx-runtime") ||
            moduleId.includes("jsx-runtime")
          ) {
            return "vendor-react";
          }

          if (moduleId.includes("node_modules")) {
            if (moduleId.includes("@supabase")) return "vendor-supabase";
            if (moduleId.includes("lucide-react")) return "vendor-icons";
          }
        },
      },
    },
  },
});
