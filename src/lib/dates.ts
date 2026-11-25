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
  const iso = parseFinDate(a.end, a.d);
  return !iso || iso < a.d ? a.d : iso;
}

/** The deadline of an application or saved ad, or null when there is none ("jatkuva haku", empty). */
export const deadlineIso = (a: { d: string; end: string }) => parseFinDate(a.end, a.d);

/**
 * A Finnish date like "23.8.", "23.8" or "23.8.2026" as YYYY-MM-DD. Without a year it takes the year of `ref`,
 * or the next year when that would put it more than half a year before `ref`.
 */
export function parseFinDate(s: string, ref: string): string | null {
  const m = s.match(/^\s*(\d{1,2})\.(\d{1,2})\.?(\d{4})?/);
  if (!m) return null;
  const y = m[3] ? +m[3] : +ref.slice(0, 4);
  let iso = `${y}-${String(+m[2]).padStart(2, "0")}-${String(+m[1]).padStart(2, "0")}`;
  if (!m[3] && iso < ref && dayDiff(iso, ref) > 180) iso = `${y + 1}${iso.slice(4)}`;
  const t = new Date(noon(iso));
  return Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== iso ? null : iso;
}
