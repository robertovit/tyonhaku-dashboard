const DAY = 864e5;
const noon = (iso: string) => Date.parse(`${iso}T12:00:00Z`);

export const todayIso = () => new Date().toISOString().slice(0, 10);

export function isoWeek(iso: string): number {
  const t = new Date(noon(iso));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3);
  const jan4 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  jan4.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + 3);
  return 1 + Math.round((t.getTime() - jan4.getTime()) / (7 * DAY));
}
/** Sortable week key, e.g. "2026-09". */
export const weekKey = (iso: string) => `${iso.slice(0, 4)}-${String(isoWeek(iso)).padStart(2, "0")}`;
export const dayDiff = (from: string, to: string) => Math.round((noon(to) - noon(from)) / DAY);
export const addDays = (iso: string, n: number) => new Date(noon(iso) + n * DAY).toISOString().slice(0, 10);
export const fmtDate = (iso: string) => `${+iso.slice(8, 10)}.${+iso.slice(5, 7)}.`;
/** Monday = 0 … Sunday = 6 */
export const weekday = (iso: string) => (new Date(noon(iso)).getUTCDay() + 6) % 7;

/**
 * When the wait for a reply started: the later of the application date and the deadline.
 * A deadline like "23.8." takes its year from the application date.
 */
export function waitingSince(a: { d: string; end: string }): string {
  const m = a.end.match(/^(\d{1,2})\.(\d{1,2})\.?(\d{4})?/);
  if (!m) return a.d;
  const y = m[3] ? +m[3] : +a.d.slice(0, 4);
  let iso = `${y}-${String(+m[2]).padStart(2, "0")}-${String(+m[1]).padStart(2, "0")}`;
  if (!m[3] && iso < a.d && dayDiff(iso, a.d) > 180) iso = `${y + 1}${iso.slice(4)}`;
  return Number.isNaN(noon(iso)) || iso < a.d ? a.d : iso;
}
