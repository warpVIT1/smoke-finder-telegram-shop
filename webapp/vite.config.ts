import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // dev-only tunnels (cloudflared/localtunnel) send a Host header Vite doesn't
    // otherwise recognize; without this it 403s every request from Telegram's WebView.
    allowedHosts: true,
    // Mirrors production, where the bot server serves the built webapp itself and
    // API calls are same-origin relative paths — keeps VITE_API_URL unnecessary.
    proxy: {
      "/api": "http://localhost:8787",
      "/images": "http://localhost:8787",
    },
  },
});
