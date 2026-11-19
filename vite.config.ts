/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// One self-contained HTML file: the claude.ai artifact CSP blocks external scripts.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { target: "es2022", assetsInlineLimit: Infinity },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
