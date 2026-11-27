/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Two builds:
// - `npm run build`: the installable web app (PWA) for Cloudflare Pages → dist/
// - `npm run build:demo` (--mode demo): the public demo with invented data for GitHub Pages, served under
//   /tyonhaku-dashboard/, without a service worker → dist-demo/
const pwa = VitePWA({
  registerType: "autoUpdate",
  includeAssets: ["icons/favicon.svg"],
  manifest: {
    name: "Työnhaku",
    short_name: "Työnhaku",
    description: "Oma työnhaun seuranta: hakemukset, haettavat ilmoitukset ja edistyminen.",
    lang: "fi",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#141915",
    theme_color: "#141915",
    icons: [
      { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Android: the installed app appears in the share menu; a shared ad opens the add dialog.
    share_target: { action: "/", method: "GET", params: { title: "title", text: "text", url: "url" } },
  },
  workbox: {
    globPatterns: ["**/*.{js,css,html,svg,png}"],
    navigateFallback: "/index.html",
    // /api is always fetched from the network (and /api/session must reach Access to log in again).
    navigateFallbackDenylist: [/^\/api\//, /^\/cdn-cgi\//],
  },
});

export default defineConfig(({ mode }) => {
  const demo = mode === "demo";
  return {
    base: demo ? "/tyonhaku-dashboard/" : "/",
    plugins: demo ? [react()] : [react(), pwa],
    build: demo ? { target: "es2022", outDir: "dist-demo" } : { target: "es2022" },
    test: { environment: "node", include: ["src/**/*.test.ts", "functions/**/*.test.ts"] },
  };
});
