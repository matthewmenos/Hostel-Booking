import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // PWA: generates the manifest + a service worker (Workbox) that caches the
    // app shell for offline use and makes the app installable.
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "offline.html"],
      manifest: {
        name: "HostelHub Ghana",
        short_name: "HostelHub",
        description:
          "Find and book verified university hostels across Ghana (KNUST, Legon, UCC).",
        theme_color: "#0f766e",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            // Cache GET hostel/search data for snappier offline-ish browsing.
            urlPattern: ({ url }) => url.pathname.startsWith("/api/hostels"),
            handler: "NetworkFirst",
            options: { cacheName: "api-hostels", networkTimeoutSeconds: 5 },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    // Proxy API calls to Django so the frontend can use same-origin "/api".
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true },
      "/media": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
});
