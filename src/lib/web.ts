// Own backend: Cloudflare Pages Functions under /api with a D1 database, behind Cloudflare Access.
// Writes are optimistic: the list updates at once and rolls back if the server refuses.
import type { Backup } from "./backup";
import { todayIso } from "./dates";
import { normalize, type ApplicationDoc } from "./model";
import { UserFacingError, type ApplicationStore, type Backend, type Downloads, type StoreListener } from "./store";

type Fetch = typeof fetch;
/** Where to send the browser to log in again: an /api URL the service worker never answers from its cache. */
export const LOGIN_URL = "/api/session";

export const AUTH_MSG = "Kirjautuminen on vanhentunut. Kirjaudu uudelleen.";

async function call<T>(f: Fetch, path: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await f(`/api${path}`, {
      ...init,
      headers: init?.body ? { "content-type": "application/json" } : undefined,
      credentials: "same-origin",
      redirect: "manual",
    });
  } catch {
    throw new UserFacingError("Ei yhteyttä palvelimeen. Tarkista verkkoyhteys ja yritä uudelleen.", "network");
  }
  // Cloudflare Access answers an expired session with a redirect to its login page.
  if (r.type === "opaqueredirect" || r.status === 401 || r.status === 403 || (r.status >= 300 && r.status < 400))
    throw new UserFacingError(AUTH_MSG, "auth", true);
  if (!r.ok) {
    let msg = "";
    try {
      msg = ((await r.json()) as { error?: string }).error ?? "";
    } catch {
      /* not JSON */
    }
    throw new UserFacingError(msg || "Palvelin ei vastannut oikein. Yritä uudelleen.", `http_${r.status}`);
  }
  return (r.status === 204 ? undefined : await r.json()) as T;
}

export function webStore(f: Fetch = (...a) => fetch(...a)): ApplicationStore & { restore(b: Backup): Promise<void> } {
  const docs = new Map<string, ApplicationDoc>();
  const listeners = new Set<StoreListener>();
  let pending = 0;
  let goal: number | null = null;
  let loaded = false;

  const emit = () => {
    if (!loaded) return;
    const today = todayIso();
    const list = [...docs].map(([id, d]) => normalize(id, { ...d }, today));
    listeners.forEach((l) => l.onApps(list, pending > 0));
  };
  const fail = (e: unknown) => {
    const msg = e instanceof UserFacingError ? e.message : "Hakemuksia ei voitu ladata.";
    listeners.forEach((l) => l.onError(msg));
  };
  const load = async () => {
    if (pending) return; // a write is on its way; its own result updates the list
    try {
      const [{ items }, g] = await Promise.all([
        call<{ items: { id: string; doc: ApplicationDoc }[] }>(f, "/applications"),
        call<{ weekly: number | null }>(f, "/settings/goal"),
      ]);
      if (pending) return;
      docs.clear();
      items.forEach((it) => docs.set(it.id, it.doc));
      goal = g.weekly;
      loaded = true;
      emit();
      listeners.forEach((l) => l.onGoal(goal));
    } catch (e) {
      fail(e);
    }
  };
  /** Applies `local` at once, sends `remote`, and puts the old state back if it fails. */
  const write = async (id: string, local: ApplicationDoc | null, remote: () => Promise<unknown>) => {
    const before = docs.get(id);
    if (local) docs.set(id, local);
    else docs.delete(id);
    pending++;
    emit();
    try {
      await remote();
    } catch (e) {
      if (before) docs.set(id, before);
      else docs.delete(id);
      throw e;
    } finally {
      pending--;
      emit();
    }
  };
  const onVisible = () => document.visibilityState === "visible" && void load();

  return {
    canWrite: true,
    subscribe(l) {
      listeners.add(l);
      if (listeners.size === 1) {
        void load();
        if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible);
      } else if (loaded) {
        emit();
        l.onGoal(goal);
      }
      return () => {
        listeners.delete(l);
        if (!listeners.size && typeof document !== "undefined")
          document.removeEventListener("visibilitychange", onVisible);
      };
    },
    save: (id, doc) =>
      write(id, doc, () =>
        call(f, `/applications/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(doc) }),
      ),
    update: (id, patch) => {
      const cur = docs.get(id);
      return write(id, cur ? { ...cur, ...patch } : null, () =>
        call(f, `/applications/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) }),
      );
    },
    remove: (id) => write(id, null, () => call(f, `/applications/${encodeURIComponent(id)}`, { method: "DELETE" })),
    async setGoal(weekly) {
      await call(f, "/settings/goal", { method: "PUT", body: JSON.stringify({ weekly }) });
      goal = weekly;
      listeners.forEach((l) => l.onGoal(goal));
    },
    async restore(b) {
      await call(f, "/applications", { method: "POST", body: JSON.stringify(b) });
      await load();
    },
  };
}

export const blobDownloads: Downloads = {
  async save(filename, data) {
    const type = filename.endsWith(".json") ? "application/json" : "text/csv;charset=utf-8";
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },
};

export async function connect(): Promise<Backend> {
  const store = webStore();
  // Claude fill needs an API key on the server; until then the add dialog is filled by hand.
  return { store, assistant: null, downloads: blobDownloads, restore: (b) => store.restore(b) };
}
