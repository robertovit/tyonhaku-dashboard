/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";

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

// Shown in the footer so the owner can see which build the phone runs: the commit and the build day (Finnish time).
function appVersion(): string {
  let sha = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || "";
  if (!sha) {
    try {
      sha = execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString();
    } catch {
      sha = "dev";
    }
  }
  const day = new Intl.DateTimeFormat("fi-FI", { timeZone: "Europe/Helsinki", day: "numeric", month: "numeric" });
  return `${sha.trim().slice(0, 7)} · ${day.format(new Date())}`;
}

export default defineConfig(({ mode }) => {
  const demo = mode === "demo";
  return {
    define: { "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion()) },
    base: demo ? "/tyonhaku-dashboard/" : "/",
    plugins: demo ? [react()] : [react(), pwa],
    build: demo ? { target: "es2022", outDir: "dist-demo" } : { target: "es2022" },
    test: { environment: "node", include: ["src/**/*.test.ts", "functions/**/*.test.ts"] },
  };
});
