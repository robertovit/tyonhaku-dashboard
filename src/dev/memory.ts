// Development-only backend for `npm run dev`: the invented example applications in memory, so the UI can be
// worked on without the server. Loaded with a dynamic import behind import.meta.env.DEV, so never in the build.
import type { Backup } from "../lib/backup";
import { todayIso } from "../lib/dates";
import { normalize, type ApplicationDoc } from "../lib/model";
import type { ApplicationStore, Backend, StoreListener } from "../lib/store";
import { toAdFields } from "../lib/adPrompt";
import { FIXTURE } from "./fixtures";

export async function connect(): Promise<Backend> {
  const docs = new Map<string, Record<string, unknown>>(FIXTURE.map(([id, d]) => [id, { ...d }]));
  let goal: number | null = null;
  const listeners = new Set<StoreListener>();
  const emit = () => {
    setTimeout(() => {
      const today = todayIso();
      const apps = [...docs].map(([id, d]) => normalize(id, d, today));
      listeners.forEach((l) => (l.onApps(apps, false), l.onGoal(goal)));
    }, 30);
  };
  const write = async (f: () => void): Promise<void> => {
    f();
    emit();
  };

  const store: ApplicationStore = {
    canWrite: true,
    subscribe(l) {
      listeners.add(l);
      emit();
      return () => listeners.delete(l);
    },
    save: (id, doc: ApplicationDoc) => write(() => docs.set(id, { ...doc })),
    update: (id, patch) => write(() => docs.set(id, { ...docs.get(id), ...patch })),
    remove: (id) => write(() => docs.delete(id)),
    setGoal: (weekly) => write(() => (goal = weekly)),
  };
  return {
    store,
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
    restore: (b: Backup) =>
      write(() => {
        b.items.forEach((it) => docs.set(it.id, { ...it.doc }));
        if (b.goal) goal = b.goal;
      }),
  };
}
