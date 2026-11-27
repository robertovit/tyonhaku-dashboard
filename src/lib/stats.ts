import { addDays, dayDiff, isoWeek, waitingSince, weekKey } from "./dates";
import { gotAnswer, hadInterview, hadOffer } from "./history";
import { STATUS_ORDER, TYPES, type Application, type JobType, type Status } from "./model";

export const FOLLOWUP_DAYS = 21;
export const SNOOZE_DAYS = 14;

export function countBy(apps: Application[]): Record<Status, number> {
  const c: Record<Status, number> = { offer: 0, int: 0, wait: 0, no: 0, todo: 0 };
  apps.forEach((a) => c[a.status]++);
  return c;
}
/** Statuses to show: every status present, plus "Haastattelu" always. */
export const presentStatuses = (apps: Application[]) => {
  const c = countBy(apps);
  return STATUS_ORDER.filter((k) => c[k] > 0 || k === "int");
};

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function summary(apps: Application[]) {
  const c = countBy(apps);
  const known = apps.filter((a) => a.n != null).map((a) => a.n as number);
  return {
    total: apps.length,
    counts: c,
    answered: apps.filter(gotAnswer).length,
    interviews: apps.filter(hadInterview),
    knownN: known.length,
    medianN: median(known),
    orgCount: new Set(apps.map((a) => a.org.trim().toLowerCase())).size,
  };
}

export interface WeekBucket {
  key: string;
  week: number;
  count: number;
  cumulative: number;
  isNow: boolean;
  orgs: string[];
}
/** One bucket per ISO week from the first application to the current week (or the last application). */
export function weeklySeries(apps: Application[], today: string): WeekBucket[] {
  if (!apps.length) return [];
  const dates = apps.map((a) => a.d).sort();
  const end = [dates[dates.length - 1], today].sort()[1];
  const byWeek = new Map<string, Application[]>();
  apps.forEach((a) => {
    const k = weekKey(a.d);
    byWeek.set(k, [...(byWeek.get(k) ?? []), a]);
  });
  const out: WeekBucket[] = [];
  let cum = 0;
  for (let t = dates[0]; ; t = addDays(t, 7)) {
    const k = weekKey(t > end ? end : t);
    if (!out.length || out[out.length - 1].key !== k) {
      const list = byWeek.get(k) ?? [];
      cum += list.length;
      out.push({
        key: k,
        week: isoWeek(t > end ? end : t),
        count: list.length,
        cumulative: cum,
        isNow: k === weekKey(today),
        orgs: [...new Set(list.map((a) => a.org))],
      });
    }
    if (t >= end) break;
  }
  return out;
}

export interface Followup {
  app: Application;
  since: string;
  days: number;
}
/** Waiting applications with no news for FOLLOWUP_DAYS. Open applications rarely get a reply, so they are left out. */
export function followups(apps: Application[], today: string) {
  const due: Followup[] = [];
  const snoozed: Followup[] = [];
  for (const app of apps) {
    if (app.status !== "wait" || app.type === "open") continue;
    const since = waitingSince(app);
    const days = dayDiff(since, today);
    if (days < FOLLOWUP_DAYS) continue;
    (app.snoozeUntil && app.snoozeUntil > today ? snoozed : due).push({ app, since, days });
  }
  due.sort((x, y) => y.days - x.days);
  return { due, snoozed };
}

/** Employers grouped case-insensitively ("Valtiolle.fi" = "valtiolle.fi"), capitalized spelling preferred. */
export function orgRanking(apps: Application[], top = 5): [string, number][] {
  const count = new Map<string, number>();
  const label = new Map<string, string>();
  apps.forEach((a) => {
    const k = a.org.trim().toLowerCase();
    count.set(k, (count.get(k) ?? 0) + 1);
    const cur = label.get(k);
    if (!cur || (/^[a-zåäö]/.test(cur) && /^[A-ZÅÄÖ]/.test(a.org))) label.set(k, a.org.trim());
  });
  const all = [...count].map(([k, n]) => [label.get(k)!, n] as [string, number]).sort((a, b) => b[1] - a[1]);
  const shown = all.filter(([, n]) => n > 1).slice(0, top);
  const restOrgs = all.length - shown.length;
  const restApps = apps.length - shown.reduce((s, [, n]) => s + n, 0);
  return restOrgs ? [...shown, [`Muut (${restOrgs} työnantajaa)`, restApps]] : shown;
}

export function typeCounts(apps: Application[]): [JobType, number][] {
  return (Object.keys(TYPES) as JobType[])
    .map((k) => [k, apps.filter((a) => a.type === k).length] as [JobType, number])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
}

export const competition = (apps: Application[]) =>
  apps.filter((a) => a.n != null).sort((a, b) => (b.n as number) - (a.n as number));

/** Haettu → vastaus saatu → haastattelu → tarjous, by the stages reached (a rejection after an interview still
 *  counts as an interview). The outcome counts (countBy) use the current status. */
export function funnel(apps: Application[]) {
  return [
    { key: "haettu", label: "Haettu", value: apps.length },
    { key: "vastaus", label: "Vastaus saatu", value: apps.filter(gotAnswer).length },
    { key: "haastattelu", label: "Haastattelu", value: apps.filter(hadInterview).length },
    { key: "tarjous", label: "Tarjous", value: apps.filter(hadOffer).length },
  ];
}
