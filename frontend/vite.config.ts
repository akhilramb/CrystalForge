import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/three/examples/jsm/")) return "three-extras";
          if (id.includes("/node_modules/three/")) return "three-vendor";
          if (id.includes("/node_modules/recharts/")) return "charts-vendor";
        },
      },
    },
  },
  server: { proxy: { "/api": "http://127.0.0.1:8000" } },
});
