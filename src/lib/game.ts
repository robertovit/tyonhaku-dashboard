// Game layer: XP, levels, streaks and badges are all derived from the applications; nothing extra is stored.
// Outcome XP counts each stage an application has reached (lib/history.ts), so a rejection after an interview
// keeps the interview, and a stage recorded twice still counts once.
import { isoWeek } from "./dates";
import { asOf, hadInterview, hadOffer, hadRejection, recordStatus } from "./history";
import { weeklySeries } from "./stats";
import type { Application, StageEvent, Status } from "./model";
import { newlyUnlockedShield, type Shield } from "./shields";

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
/** Application count milestones: the first four badges, shown in Varusteet with their own pixel items. */
export const APP_MILESTONES = [
  { id: "first", required: 1, name: "Ensimmäinen hakemus", how: "Lähetä ensimmäinen hakemus" },
  { id: "ten", required: 10, name: "Kymmenen hakemusta", how: "Lähetä 10 hakemusta" },
  { id: "quarter", required: 25, name: "25 hakemusta", how: "Lähetä 25 hakemusta" },
  { id: "fifty", required: 50, name: "Puolisataa", how: "Lähetä 50 hakemusta" },
] as const;
export type Milestone = (typeof APP_MILESTONES)[number];

export const BADGES: Badge[] = [
  ...APP_MILESTONES.map((m) => ({
    id: m.id,
    icon: String(m.required),
    name: m.name,
    how: m.how,
    earned: (g: Omit<GameState, "badges" | "xp" | "level">) => g.total >= m.required,
  })),
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

/**
 * What Varusteet collects: effort badges. The shields (lib/shields.ts) take the place of "persist", and
 * outcome badges (interview, top, offer) are only shown under "Aiemmin ansaitut" once earned; a new interview or
 * offer shows as XP and in the application's history instead. All of them stay in GameState.badges.
 */
const ARCHIVED = ["interview", "top", "offer"];
export const COLLECTION_BADGES = BADGES.filter((b) => b.id !== "persist" && !ARCHIVED.includes(b.id));
export const ARCHIVED_BADGES = BADGES.filter((b) => ARCHIVED.includes(b.id));
/** The collection without the application count milestones (shown as their own row). */
export const EFFORT_BADGES = COLLECTION_BADGES.filter((b) => !APP_MILESTONES.some((m) => m.id === b.id));

/**
 * The application milestone to show: the next one with how far along it is, or the last one once all are reached.
 */
export function milestoneProgress(total: number): { milestone: Milestone; total: number; done: boolean } {
  const next = APP_MILESTONES.find((m) => total < m.required);
  return next
    ? { milestone: next, total, done: false }
    : { milestone: APP_MILESTONES[APP_MILESTONES.length - 1], total, done: true };
}

export function gameState(apps: Application[], goal: number, today: string): GameState {
  const perDay = new Map<string, number>();
  apps.forEach((a) => perDay.set(a.d, (perDay.get(a.d) ?? 0) + 1));
  const base = {
    total: apps.length,
    tailored: apps.filter((a) => a.cv.trim()).length,
    letters: apps.filter((a) => /saatekirje/i.test(a.att)).length,
    no: apps.filter(hadRejection).length,
    interviews: apps.filter(hadInterview).length,
    offers: apps.filter(hadOffer).length,
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
type XpInput = Pick<Application, "cv" | "att" | "status"> & { events?: StageEvent[] };
export function xpParts(a: XpInput): XpPart[] {
  const r = XP_RULES;
  if (a.status === "todo") return [];
  const parts: XpPart[] = [{ label: "Hakemus", xp: r.application }];
  if (a.cv.trim()) parts.push({ label: "Räätälöity CV", xp: r.tailoredCv });
  if (/saatekirje/i.test(a.att)) parts.push({ label: "Saatekirje", xp: r.coverLetter });
  if (hadRejection(a)) parts.push({ label: "Ei-valinta käsitelty", xp: r.rejectionHandled });
  if (hadInterview(a)) parts.push({ label: "Haastattelu", xp: r.interview });
  if (hadOffer(a)) parts.push({ label: "Tarjous", xp: r.offer });
  return parts;
}
export const xpForApp = (a: XpInput) => xpParts(a).reduce((s, p) => s + p.xp, 0);
/** What setting `status` adds to the stages an application has already reached (0 for one reached before). */
export const statusGain = (a: Pick<Application, "cv" | "att" | "events">, status: Status) =>
  xpForApp({ ...a, status, events: recordStatus(a.events, status, "") }) - xpForApp({ ...a, status: "wait" });
export const avgXpPerApp = (apps: Application[]) =>
  apps.length ? apps.reduce((s, a) => s + xpForApp(a), 0) / apps.length : XP_RULES.application;

/**
 * ISO week in which each earned badge was first reached, found by replaying the applications day by day.
 * A dated stage counts from its own day; an undated one (older data) from the application's date.
 */
export function badgeWeeks(apps: Application[], goal: number, today: string): Record<string, number> {
  const out: Record<string, number> = {};
  const days = [...new Set(apps.flatMap((a) => [a.d, ...a.events.map((e) => e.d).filter((d) => d && d <= today)]))];
  for (const d of days.sort()) {
    const g = gameState(
      apps.filter((a) => a.d <= d).map((a) => asOf(a, d)),
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
  /** New badges of the active collection. */
  newBadges: string[];
  /** A shield this save unlocked. */
  shield?: Shield;
}
/** What to celebrate after a save changed the game state; null when nothing was gained. */
export function celebrationFor(before: GameState, after: GameState): Celebration | null {
  const gained = after.xp - before.xp;
  const shield = newlyUnlockedShield(before.no, after.no);
  if (gained <= 0 && !shield) return null;
  const newBadges = COLLECTION_BADGES.filter((b) => after.badges.includes(b.id) && !before.badges.includes(b.id));
  const lines: string[] = [];
  let big = false;
  if (after.level.n > before.level.n) {
    lines.push(`Taso ${after.level.n}: ${after.level.name}! Uusi varuste: ${avatarItem(after.level.n)}`);
    big = true;
  }
  newBadges.forEach((b) => {
    lines.push(`Uusi saavutus: ${b.name}`);
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
  // A rejection is met calmly: no confetti, whatever else the same save brought.
  const rejection = after.no > before.no;
  if (rejection && !big && !shield) lines.push("Ei-valinta käsitelty. Jokainen haku vie eteenpäin.");
  const xp = gained > 0 ? `+${gained} XP` : "";
  return {
    title: shield ? `${shield.name} avattu` : xp,
    text: (shield ? [xp, ...lines] : lines).filter(Boolean).join(" · "),
    confetti: rejection || !big ? 0 : interview || after.level.n > before.level.n ? 160 : 90,
    newBadges: newBadges.map((b) => b.id),
    shield,
  };
}

export const ARM_WINDOW_MS = 8000;
/**
 * Celebrates only changes the viewer caused: arm() right before a save; the next confirmed game state (no write
 * pending) within a few seconds is compared with the last confirmed one. A failed save is rolled back before it
 * is confirmed, so it celebrates nothing; earlier data seen on the first load is never celebrated.
 */
export function celebrationWatch(now: () => number = Date.now) {
  let prev: GameState | null = null;
  let armedAt = 0;
  return {
    arm() {
      armedAt = now();
    },
    see(game: GameState, pending: boolean): Celebration | null {
      if (pending) return null;
      const before = prev;
      prev = game;
      if (!before || !armedAt || now() - armedAt > ARM_WINDOW_MS) return null;
      armedAt = 0;
      return celebrationFor(before, game);
    },
  };
}
