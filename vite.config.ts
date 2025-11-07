// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 8080,
    proxy: {
      // Only proxy API to backend
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
