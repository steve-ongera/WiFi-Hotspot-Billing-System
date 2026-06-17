import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      // Allows "@/components/..." style imports
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    port: 5173,
    strictPort: true,
    // Proxy all /api requests to Django during development
    // so CORS and cookies work without extra configuration
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },

  preview: {
    port: 4173,
  },

  build: {
    outDir: "dist",
    sourcemap: false,
    // Raise the chunk size warning threshold (Chart.js is large)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Split large dependencies into separate chunks for better caching
        manualChunks: {
          "react-vendor":  ["react", "react-dom", "react-router-dom"],
          "chart-vendor":  ["chart.js"],
        },
      },
    },
  },

  // Optimise deps that use CommonJS / dynamic imports
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "axios"],
  },
});