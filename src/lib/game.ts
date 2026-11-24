// Game layer: XP, levels, streaks and badges are all derived from the applications; nothing extra is stored.
import { isoWeek } from "./dates";
import { weeklySeries } from "./stats";
import type { Application } from "./model";

export const XP_RULES = {
  application: 10,
  tailoredCv: 5,
  coverLetter: 3,
  rejectionHandled: 3,
  interview: 50,
  offer: 200,
  fullWeek: 20,
};

const LEVELS: [number, string][] = [
  [0, "Ilmoitusten selaaja"],
  [100, "Hakemusten kirjoittaja"],
  [250, "Hakemuskone"],
  [450, "Haastatteluun valmis"],
  [700, "Rekrytoijien tuttu"],
  [1000, "Neuvottelija"],
  [1400, "Työnhaun mestari"],
];
const LEGEND_STEP = 500;

export interface Level {
  n: number;
  name: string;
  from: number;
  to: number;
}
export function levelFor(xp: number): Level {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1][0]) i++;
  const last = LEVELS[LEVELS.length - 1][0];
  if (i === LEVELS.length - 1 && xp >= last + LEGEND_STEP) {
    const extra = Math.floor((xp - last) / LEGEND_STEP);
    return {
      n: i + 1 + extra,
      name: `Työnhaun legenda ${extra}`,
      from: last + extra * LEGEND_STEP,
      to: last + (extra + 1) * LEGEND_STEP,
    };
  }
  return {
    n: i + 1,
    name: LEVELS[i][1],
    from: LEVELS[i][0],
    to: i + 1 < LEVELS.length ? LEVELS[i + 1][0] : last + LEGEND_STEP,
  };
}

/** Avatar item unlocked at each level (8 = every level from 8 up). */
export const AVATAR_ITEMS: Record<number, string> = {
  1: "suurennuslasi",
  2: "kynä korvan takana",
  3: "läppäri",
  4: "puku ja solmio",
  5: "nimikyltti kaulanauhassa",
  6: "silmälasit",
  7: "kruunu",
  8: "kultainen hohde",
};
export const avatarItem = (level: number) => AVATAR_ITEMS[Math.min(Math.max(level, 1), 8)];

export interface WeekStats {
  met: number; // weeks where the goal was reached
  best: number; // longest run of such weeks
  current: number; // current run; the unfinished current week does not break it
  thisWeek: number;
}
export function weekStats(apps: Application[], goal: number, today: string): WeekStats {
  const weeks = weeklySeries(apps, today);
  let best = 0;
  let run = 0;
  weeks.forEach((w) => {
    run = w.count >= goal ? run + 1 : 0;
    best = Math.max(best, run);
  });
  let current = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].count >= goal) current++;
    else if (weeks[i].isNow) continue;
    else break;
  }
  return {
    met: weeks.filter((w) => w.count >= goal).length,
    best,
    current,
    thisWeek: weeks.find((w) => w.isNow)?.count ?? 0,
  };
}

export interface GameState {
  total: number;
  tailored: number;
  letters: number;
  no: number;
  interviews: number;
  offers: number;
  top: number;
  maxN: number;
  maxDay: number;
  orgs: number;
  weeks: WeekStats;
  xp: number;
  level: Level;
  badges: string[];
}

export interface Badge {
  id: string;
  icon: string;
  name: string;
  how: string;
  earned: (g: Omit<GameState, "badges" | "xp" | "level">) => boolean;
}
export const BADGES: Badge[] = [
  {
    id: "first",
    icon: "1",
    name: "Ensimmäinen hakemus",
    how: "Lähetä ensimmäinen hakemus",
    earned: (g) => g.total >= 1,
  },
  { id: "ten", icon: "10", name: "Kymmenen hakemusta", how: "Lähetä 10 hakemusta", earned: (g) => g.total >= 10 },
  { id: "quarter", icon: "25", name: "25 hakemusta", how: "Lähetä 25 hakemusta", earned: (g) => g.total >= 25 },
  { id: "fifty", icon: "50", name: "Puolisataa", how: "Lähetä 50 hakemusta", earned: (g) => g.total >= 50 },
  {
    id: "burst",
    icon: "×10",
    name: "Kymmenen yhdessä päivässä",
    how: "Lähetä 10 hakemusta samana päivänä",
    earned: (g) => g.maxDay >= 10,
  },
  { id: "week", icon: "✓", name: "Tavoite täynnä", how: "Täytä viikkotavoite kerran", earned: (g) => g.weeks.met >= 1 },
  {
    id: "streak3",
    icon: "3vk",
    name: "Kolmen viikon putki",
    how: "Täytä viikkotavoite 3 viikkoa peräkkäin",
    earned: (g) => g.weeks.best >= 3,
  },
  { id: "variety", icon: "10+", name: "Laaja verkko", how: "Hae 10 eri työnantajalle", earned: (g) => g.orgs >= 10 },
  {
    id: "tailor",
    icon: "CV",
    name: "Räätälöijä",
    how: "Räätälöi CV viiteen hakemukseen",
    earned: (g) => g.tailored >= 5,
  },
  {
    id: "bigwater",
    icon: "500",
    name: "Isoja vesiä",
    how: "Hae paikkaa, jossa on yli 500 hakijaa",
    earned: (g) => g.maxN >= 500,
  },
  {
    id: "persist",
    icon: "∞",
    name: "Sinnikäs",
    how: "Käsittele 10 ei-valintaa ja jatka hakemista",
    earned: (g) => g.no >= 10,
  },
  {
    id: "interview",
    icon: "H",
    name: "Ensimmäinen haastattelu",
    how: "Pääse haastatteluun",
    earned: (g) => g.interviews >= 1,
  },
  { id: "top", icon: "#1", name: "Paras hakija", how: "Sijoitu hakijoista ensimmäiseksi", earned: (g) => g.top >= 1 },
  { id: "offer", icon: "€", name: "Tarjous", how: "Saa työtarjous", earned: (g) => g.offers >= 1 },
];

export function gameState(apps: Application[], goal: number, today: string): GameState {
  const perDay = new Map<string, number>();
  apps.forEach((a) => perDay.set(a.d, (perDay.get(a.d) ?? 0) + 1));
  const base = {
    total: apps.length,
    tailored: apps.filter((a) => a.cv.trim()).length,
    letters: apps.filter((a) => /saatekirje/i.test(a.att)).length,
    no: apps.filter((a) => a.status === "no").length,
    interviews: apps.filter((a) => a.status === "int" || a.status === "offer").length,
    offers: apps.filter((a) => a.status === "offer").length,
    top: apps.filter((a) => a.top).length,
    maxN: Math.max(0, ...apps.map((a) => a.n ?? 0)),
    maxDay: Math.max(0, ...perDay.values()),
    orgs: new Set(apps.map((a) => a.org.trim().toLowerCase())).size,
    weeks: weekStats(apps, goal, today),
  };
  const r = XP_RULES;
  const xp =
    base.total * r.application +
    base.tailored * r.tailoredCv +
    base.letters * r.coverLetter +
    base.no * r.rejectionHandled +
    base.interviews * r.interview +
    base.offers * r.offer +
    base.weeks.met * r.fullWeek;
  return { ...base, xp, level: levelFor(xp), badges: BADGES.filter((b) => b.earned(base)).map((b) => b.id) };
}

export interface XpPart {
  label: string;
  xp: number;
}
/** What one application is worth on its own (weekly bonuses come on top). Matches the sums in gameState(). */
export function xpParts(a: Pick<Application, "cv" | "att" | "status">): XpPart[] {
  const r = XP_RULES;
  const parts: XpPart[] = [{ label: "Hakemus", xp: r.application }];
  if (a.cv.trim()) parts.push({ label: "Räätälöity CV", xp: r.tailoredCv });
  if (/saatekirje/i.test(a.att)) parts.push({ label: "Saatekirje", xp: r.coverLetter });
  if (a.status === "no") parts.push({ label: "Ei-valinta käsitelty", xp: r.rejectionHandled });
  if (a.status === "int" || a.status === "offer") parts.push({ label: "Haastattelu", xp: r.interview });
  if (a.status === "offer") parts.push({ label: "Tarjous", xp: r.offer });
  return parts;
}
export const xpForApp = (a: Pick<Application, "cv" | "att" | "status">) => xpParts(a).reduce((s, p) => s + p.xp, 0);
export const avgXpPerApp = (apps: Application[]) =>
  apps.length ? apps.reduce((s, a) => s + xpForApp(a), 0) / apps.length : XP_RULES.application;

/**
 * ISO week in which each earned badge was first reached, found by replaying the applications day by day.
 * Statuses are taken as they are now, so an outcome badge counts from the application's date.
 */
export function badgeWeeks(apps: Application[], goal: number, today: string): Record<string, number> {
  const out: Record<string, number> = {};
  const days = [...new Set(apps.map((a) => a.d))].sort();
  for (const d of days) {
    const g = gameState(
      apps.filter((a) => a.d <= d),
      goal,
      d,
    );
    g.badges.forEach((id) => (out[id] ??= isoWeek(d)));
  }
  gameState(apps, goal, today).badges.forEach((id) => (out[id] ??= isoWeek(today)));
  return out;
}

export interface Celebration {
  title: string;
  text: string;
  confetti: 0 | 90 | 160;
  newBadges: string[];
}
/** What to celebrate after a save changed the game state; null when nothing was gained. */
export function celebrationFor(before: GameState, after: GameState): Celebration | null {
  const gained = after.xp - before.xp;
  if (gained <= 0) return null;
  const newBadges = after.badges.filter((b) => !before.badges.includes(b));
  const lines: string[] = [];
  let big = false;
  if (after.level.n > before.level.n) {
    lines.push(`Taso ${after.level.n}: ${after.level.name}! Uusi varuste: ${avatarItem(after.level.n)}`);
    big = true;
  }
  newBadges.forEach((id) => {
    lines.push(`Uusi saavutus: ${BADGES.find((b) => b.id === id)!.name}`);
    big = true;
  });
  if (after.weeks.met > before.weeks.met) {
    lines.push("Viikkotavoite täynnä!");
    big = true;
  }
  const interview = after.interviews > before.interviews;
  if (interview) {
    lines.push("Haastattelu! Hienoa työtä.");
    big = true;
  }
  if (after.no > before.no && !big) lines.push("Ei-valinta käsitelty. Jokainen haku vie eteenpäin.");
  return {
    title: `+${gained} XP`,
    text: lines.join(" · "),
    confetti: !big ? 0 : interview || after.level.n > before.level.n ? 160 : 90,
    newBadges,
  };
}
