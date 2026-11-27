// Development-only backend for `npm run dev`: the invented example applications in memory (reset on reload),
// plus a fake assistant so the dialog's fill box can be worked on. Loaded only behind import.meta.env.DEV.
import { toAdFields } from "../lib/adPrompt";
import { memoryBackend } from "../lib/memory";
import type { Backend } from "../lib/store";
import { FIXTURE } from "./fixtures";

export async function connect(): Promise<Backend> {
  return memoryBackend({
    seed: () => FIXTURE.map(([id, d]) => [id, { ...d }]),
    assistant: {
      imageTypes: ["image/png", "image/jpeg"],
      async fillFromAd() {
        await new Promise((r) => setTimeout(r, 600));
        return toAdFields({
          org: "Esimerkki Oy",
          role: "Data Analyst Trainee",
          end: "31.10.",
          type: "trainee",
          how: "Nettilomake",
          att: "CV, saatekirje",
          url: "https://example.com/ilmoitus",
          n: null,
        });
      },
    },
    downloads: { save: async (name, data) => console.info("[dev] download", name, data.length) },
  });
}
