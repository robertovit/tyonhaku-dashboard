// Renders the level 5 pixel character into the PWA icons in public/icons/ (run once: npm run icons).
// Uses Vite to load Avatar.tsx and Playwright's Chromium to rasterize it. Playwright is not a dependency of
// the app: install it globally (npm i -g playwright && npx playwright install chromium) before running this.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const { chromium } = createRequire(import.meta.url)("playwright");

const BG = "#141915";
const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const { Avatar } = await server.ssrLoadModule("/src/components/Avatar.tsx");
  const svg = renderToStaticMarkup(createElement(Avatar, { level: 5 })).replace(' aria-hidden="true"', "");
  mkdirSync("public/icons", { recursive: true });
  // Favicon: the character on the app background, 1px margin.
  writeFileSync(
    "public/icons/favicon.svg",
    svg
      .replace('viewBox="0 -1 16 17"', 'viewBox="-1 -2 18 19" xmlns="http://www.w3.org/2000/svg"')
      .replace(">", `><rect x="-1" y="-2" width="18" height="19" fill="${BG}"/>`),
  );
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  // [file, size, share of the icon the character fills]; maskable icons keep it inside the 80 % safe zone.
  for (const [file, size, fill] of [
    ["icon-192.png", 192, 0.78],
    ["icon-512.png", 512, 0.78],
    ["icon-maskable-512.png", 512, 0.6],
  ]) {
    const s = Math.round(size * fill);
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<body style="margin:0;width:${size}px;height:${size}px;background:${BG};display:grid;place-items:center">` +
        svg.replace("<svg ", `<svg width="${s}" height="${s}" `) +
        "</body>",
    );
    await page.screenshot({ path: `public/icons/${file}` });
  }
  await browser.close();
  console.log("public/icons: favicon.svg, icon-192.png, icon-512.png, icon-maskable-512.png");
} finally {
  await server.close();
}
