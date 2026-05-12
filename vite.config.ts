import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Set `VITE_TUNNEL=1` when exposing the dev server via ngrok (HTTPS) so HMR uses wss:443. */
const tunnel = process.env.VITE_TUNNEL === "1";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    // Listen on all interfaces so http://127.0.0.1:5173 and http://<your-LAN-IP>:5173 work (e.g. phone on Wi‑Fi).
    host: true,
    port: 5173,
    strictPort: false,
    allowedHosts: true,
    ...(tunnel && {
      hmr: {
        protocol: "wss" as const,
        clientPort: 443,
      },
    }),
    fs: {
      allow: [path.resolve(__dirname), path.resolve(__dirname, "asset")],
    },
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: false,
    allowedHosts: true,
  },
});
