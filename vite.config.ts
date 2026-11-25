/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { VitePWA } from "vite-plugin-pwa";

// Two builds:
// - `npm run build` (default): the installable web app (PWA) for Cloudflare Pages → dist/
// - `npm run build:artifact` (--mode artifact): one self-contained HTML file for the claude.ai artifact,
//   whose CSP blocks external scripts → dist-artifact/
export default defineConfig(({ mode }) => {
  const artifact = mode === "artifact";
  return {
    plugins: [
      react(),
      artifact
        ? viteSingleFile()
        : VitePWA({
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
          }),
    ],
    build: artifact ? { target: "es2022", assetsInlineLimit: Infinity, outDir: "dist-artifact" } : { target: "es2022" },
    test: { environment: "node", include: ["src/**/*.test.ts", "functions/**/*.test.ts"] },
  };
});
