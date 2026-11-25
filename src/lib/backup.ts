// Full backup as JSON: unlike the CSV it keeps every stored field, so it can be imported back.
import { normalize, toDoc, type Application, type ApplicationDoc } from "./model";

export interface BackupItem {
  id: string;
  doc: ApplicationDoc;
}
export interface Backup {
  goal: number | null;
  items: BackupItem[];
}

const FORMAT = "tyonhaku-backup";
export const validId = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9._~:@+-]{1,200}$/.test(id);

export function toBackup(apps: Application[], goal: number | null, now: string): string {
  return JSON.stringify(
    { format: FORMAT, version: 1, exportedAt: now, goal, items: apps.map((a) => ({ id: a.id, doc: toDoc(a) })) },
    null,
    2,
  );
}

/** Reads a backup file; throws an Error with a message for the user when it is not one. */
export function parseBackup(text: string, today: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Tiedosto ei ole JSON-muotoinen varmuuskopio.");
  }
  const o = raw as { format?: unknown; goal?: unknown; items?: unknown };
  if (!o || o.format !== FORMAT || !Array.isArray(o.items))
    throw new Error("Tiedosto ei ole tämän sovelluksen varmuuskopio.");
  const items: BackupItem[] = [];
  for (const it of o.items as { id?: unknown; doc?: unknown }[]) {
    if (!it || !validId(it.id) || !it.doc || typeof it.doc !== "object") continue;
    items.push({ id: it.id, doc: toDoc(normalize(it.id, it.doc as Record<string, unknown>, today)) });
  }
  const g = Number(o.goal);
  return { goal: o.goal != null && g >= 1 && g <= 50 ? Math.round(g) : null, items };
}
