import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath, URL } from "node:url";

const HMR_HOST = process.env.VITE_HMR_HOST || "localhost";
const HMR_PORT = Number(process.env.VITE_HMR_PORT || 8080);
const HMR_CLIENT_PORT = Number(process.env.VITE_HMR_CLIENT_PORT || HMR_PORT);
const HMR_PROTOCOL = process.env.VITE_HMR_PROTOCOL || "ws";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - split large libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'charts': ['recharts'],
          'mqtt': ['mqtt'],
          'ui': ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-toast'],
          'utils': ['clsx', 'tailwind-merge', 'date-fns'],
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Increase warning limit to 1000 kB
  },
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
    hmr: {
      host: HMR_HOST,
      port: HMR_PORT,
      clientPort: HMR_CLIENT_PORT,
      protocol: HMR_PROTOCOL,
    },
    proxy: {
      // Only proxy API to backend
      "/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});