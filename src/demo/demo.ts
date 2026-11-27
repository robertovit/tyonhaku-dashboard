// Backend of the public demo (`npm run build:demo`, GitHub Pages): invented data kept in the visitor's own browser.
import { memoryBackend } from "../lib/memory";
import type { Backend } from "../lib/store";
import { blobDownloads } from "../lib/web";
import { demoSeed } from "./seed";

export async function connect(): Promise<Backend> {
  return memoryBackend({
    seed: demoSeed,
    goal: 3,
    storageKey: "tyonhaku-demo-v2",
    downloads: blobDownloads,
    demo: true,
  });
}
