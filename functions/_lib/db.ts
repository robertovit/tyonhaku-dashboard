// D1 storage. Each application is stored as its ApplicationDoc JSON, so the app's own
// normalize()/toDoc() define the shape; tables are created on first use (no migration step needed).
import { normalize, toDoc, type ApplicationDoc } from "../../src/lib/model";
import { validId } from "../../src/lib/backup";

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS applications (id TEXT PRIMARY KEY, doc TEXT NOT NULL, updated_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
];
const ready = new WeakMap<D1Database, Promise<unknown>>();
export function ensureSchema(db: D1Database) {
  let p = ready.get(db);
  if (!p) {
    p = db.batch(SCHEMA.map((s) => db.prepare(s)));
    p.catch(() => ready.delete(db));
    ready.set(db, p);
  }
  return p;
}

export { validId };
export const today = () => new Date().toISOString().slice(0, 10);

/** A cleaned document, or null when the body is not an object. Unknown fields are dropped. */
export function cleanDoc(raw: unknown): ApplicationDoc | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return toDoc(normalize("x", raw as Record<string, unknown>, today()));
}

export const upsert = (db: D1Database, id: string, doc: ApplicationDoc) =>
  db
    .prepare(
      "INSERT INTO applications (id, doc, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET doc = ?2, updated_at = ?3",
    )
    .bind(id, JSON.stringify(doc), new Date().toISOString());

export async function getDoc(db: D1Database, id: string): Promise<ApplicationDoc | null> {
  const row = await db.prepare("SELECT doc FROM applications WHERE id = ?1").bind(id).first<{ doc: string }>();
  return row ? (JSON.parse(row.doc) as ApplicationDoc) : null;
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

export const setGoal = (db: D1Database, weekly: number) =>
  db
    .prepare("INSERT INTO settings (key, value) VALUES ('goal', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1")
    .bind(JSON.stringify({ weekly }));
