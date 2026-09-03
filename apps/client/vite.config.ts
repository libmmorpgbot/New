import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    // Telegram loads the Mini App over HTTPS through a tunnel (ngrok/cloudflared).
    allowedHosts: true,
  },
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        // Phaser is by far the biggest dependency; keep it in its own long-lived chunk.
        manualChunks: (id: string) => (id.includes("node_modules/phaser") ? "phaser" : undefined),
      },
    },
  },
});
