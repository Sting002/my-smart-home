import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      // Everything under /api hits the Node backend on 4000
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },

      // (Optional) keep these if you still use them in code
      "/devices": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },
      "/settings": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },
      "/health": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
