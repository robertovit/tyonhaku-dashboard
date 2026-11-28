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
export const dayDiff = (from: string, to: string) => Math.round((noon(to) - noon(from)) / DAY);
export const addDays = (iso: string, n: number) => new Date(noon(iso) + n * DAY).toISOString().slice(0, 10);
export const fmtDate = (iso: string) => `${+iso.slice(8, 10)}.${+iso.slice(5, 7)}.`;
/** Monday = 0 … Sunday = 6 */
export const weekday = (iso: string) => (new Date(noon(iso)).getUTCDay() + 6) % 7;
/** The Monday of the ISO week (Monday–Sunday) that `iso` falls in. */
export const weekStart = (iso: string) => addDays(iso, -weekday(iso));
/**
 * Sortable, unambiguous week key: the week's Monday, e.g. "2026-12-28". 31.12.2026 and 2.1.2027 share it (both are
 * in ISO week 53 of 2026), which a calendar year plus a week number would split.
 */
export const weekKey = weekStart;
/** The year an ISO week belongs to (the year of its Thursday): 2.1.2027 is in week 53 of 2026. */
export const isoWeekYear = (iso: string) => +addDays(weekStart(iso), 3).slice(0, 4);
/** "vko 37"; with the year when the week is not in today's ISO year ("vko 53/2026"). */
export const weekLabel = (iso: string, today: string) =>
  `vko ${isoWeek(iso)}${isoWeekYear(iso) === isoWeekYear(today) ? "" : `/${isoWeekYear(iso)}`}`;

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
