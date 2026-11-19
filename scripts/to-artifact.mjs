// Turns dist/index.html into dist/artifact.html: the claude.ai artifact host adds its own
// <!doctype>, <html>, <head> and <body>, so the published file carries only the page content
// (title, font links, styles, scripts and the #root element).
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync("dist/index.html", "utf8");
const head = html.match(/<head>([\s\S]*?)<\/head>/i)?.[1] ?? "";
const body = html.match(/<body>([\s\S]*?)<\/body>/i)?.[1] ?? "";
const keepHead = head
  .replace(/<meta charset[^>]*>/gi, "")
  .replace(/<meta name="viewport"[^>]*>/gi, "")
  .trim();
const title = keepHead.match(/<title>[\s\S]*?<\/title>/i)?.[0] ?? "";
const out = `${title}\n${keepHead.replace(title, "").trim()}\n${body.trim()}\n`;
writeFileSync("dist/artifact.html", out);
console.log(`dist/artifact.html ${(out.length / 1024).toFixed(0)} kB`);
