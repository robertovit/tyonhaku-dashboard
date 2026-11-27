// A backend that keeps the applications in memory, used by `npm run dev` and the public demo. With `storageKey`
// the data also survives reloads in this browser (localStorage); without it every reload starts from the seed.
import type { Backup } from "./backup";
import { dayDiff, todayIso } from "./dates";
import { normalize } from "./model";
import type { ApplicationStore, Assistant, Backend, Downloads, StoreListener } from "./store";

type Docs = [string, Record<string, unknown>][];

export interface MemoryOptions {
  /** Fresh example data for `today`. */
  seed(today: string): Docs;
  goal?: number | null;
  /** localStorage key; stored data older than `maxAgeDays` is replaced by a fresh seed. */
  storageKey?: string;
  maxAgeDays?: number;
  assistant?: Assistant | null;
  downloads?: Downloads | null;
  /** Public demo: the UI shows a demo banner with a reset button, and there is no backup import. */
  demo?: boolean;
}

interface Saved {
  seeded: string;
  docs: Docs;
  goal: number | null;
}

function load(key: string, today: string, maxAge: number): Saved | null {
  try {
    const s = JSON.parse(localStorage.getItem(key) ?? "null") as Saved | null;
    if (s && Array.isArray(s.docs) && typeof s.seeded === "string" && dayDiff(s.seeded, today) <= maxAge) return s;
  } catch {
    /* blocked or broken storage: start from the seed */
  }
  return null;
}

export function memoryBackend(o: MemoryOptions): Backend {
  const fresh = (): Saved => {
    const today = todayIso();
    return { seeded: today, docs: o.seed(today), goal: o.goal ?? null };
  };
  const initial = (o.storageKey && load(o.storageKey, todayIso(), o.maxAgeDays ?? 28)) || fresh();
  let seeded = initial.seeded;
  let goal = initial.goal;
  const docs = new Map(initial.docs);
  const listeners = new Set<StoreListener>();

  const emit = () => {
    if (o.storageKey) {
      try {
        localStorage.setItem(o.storageKey, JSON.stringify({ seeded, docs: [...docs], goal } satisfies Saved));
      } catch {
        /* storage full or blocked: the demo still works for this visit */
      }
    }
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
    save: (id, doc) => write(() => docs.set(id, { ...doc })),
    update: (id, patch) => write(() => docs.set(id, { ...docs.get(id), ...patch })),
    remove: (id) => write(() => docs.delete(id)),
    setGoal: (weekly) => write(() => (goal = weekly)),
  };
  return {
    store,
    assistant: o.assistant ?? null,
    downloads: o.downloads ?? null,
    restore: o.demo
      ? null
      : (b: Backup) =>
          write(() => {
            b.items.forEach((it) => docs.set(it.id, { ...it.doc }));
            if (b.goal) goal = b.goal;
          }),
    demo: o.demo
      ? {
          reset: () =>
            write(() => {
              const f = fresh();
              seeded = f.seeded;
              goal = f.goal;
              docs.clear();
              f.docs.forEach(([id, d]) => docs.set(id, d));
            }),
        }
      : undefined,
  };
}
