// Development-only stand-in for window.claude (db, user, sample, downloads). Never part of the build.
import { FIXTURE } from "./fixtures";

type Listener = (s: unknown) => void;
const apps = new Map<string, Record<string, unknown>>(FIXTURE.map(([id, d]) => [id, { ...d }]));
let goal: Record<string, unknown> | null = null;
const appSubs = new Set<Listener>();
const goalSubs = new Set<Listener>();

const snap = (id: string, d: Record<string, unknown> | null) => ({
  id,
  exists: !!d,
  data: () => d ?? undefined,
  metadata: {},
});
const emitApps = () =>
  setTimeout(() => {
    const docs = [...apps].map(([id, d]) => snap(id, d));
    appSubs.forEach((f) => f({ docs, metadata: { hasPendingWrites: false } }));
  }, 30);
const emitGoal = () => setTimeout(() => goalSubs.forEach((f) => f(snap("goal", goal))), 30);

const db = {
  doc: () => ({
    onSnapshot: (f: Listener) => (goalSubs.add(f), emitGoal(), () => goalSubs.delete(f)),
    set: async (d: Record<string, unknown>) => ((goal = d), emitGoal()),
  }),
  collection: () => ({
    onSnapshot: (f: Listener) => (appSubs.add(f), emitApps(), () => appSubs.delete(f)),
    doc: (id: string) => ({
      set: async (d: Record<string, unknown>) => (apps.set(id, d), emitApps()),
      update: async (d: Record<string, unknown>) => (apps.set(id, { ...apps.get(id), ...d }), emitApps()),
      delete: async () => (apps.delete(id), emitApps()),
    }),
  }),
};
const sample = {
  limits: async () => ({ images: { mediaTypes: ["image/png", "image/jpeg"] } }),
  json: async () => {
    await new Promise((r) => setTimeout(r, 600));
    return {
      org: "Esimerkki Oy",
      role: "Data Analyst Trainee",
      end: "31.10.",
      type: "trainee",
      how: "Nettilomake",
      att: "CV, saatekirje",
      url: "https://example.com/ilmoitus",
      n: null,
    };
  },
};

window.claude = {
  use: (async (name: string) =>
    ({
      db,
      user: { can: async () => true },
      sample,
      downloads: {
        save: async (r: { filename: string; data: string }) =>
          console.info("[mock] download", r.filename, r.data.length),
      },
    })[name] ?? null) as never,
};
