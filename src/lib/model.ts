/** `todo` = saved ad, not applied yet: it earns no XP and stays out of the statistics until applied. */
export type Status = "offer" | "int" | "wait" | "no" | "todo";
export type JobType = "trainee" | "expert" | "open";
/** Outcomes reached after sending; each one is recorded once in `events` (see lib/history.ts). */
export type Stage = "int" | "offer" | "no";
export const STAGES: Stage[] = ["int", "offer", "no"];
export const isStage = (s: string): s is Stage => (STAGES as string[]).includes(s);

/** A stage reached on day `d` (YYYY-MM-DD; "" = not known, e.g. data from before the history existed). */
export interface StageEvent {
  status: Stage;
  d: string;
}

/** Current shape of a stored application document. Bump SCHEMA and extend normalize() when fields change. */
export const SCHEMA = 2;

export interface ApplicationDoc {
  schema: number;
  d: string; // applied, YYYY-MM-DD
  end: string; // deadline as typed, e.g. "31.10." or "jatkuva haku"
  org: string;
  role: string;
  how: string;
  att: string;
  cv: string;
  note: string;
  url: string;
  status: Status;
  type: JobType;
  n: number | null; // number of applicants, when announced
  nPlus: boolean; // "500+"
  createdAt: string;
  updatedAt: string;
  snoozeUntil: string; // YYYY-MM-DD, hides the follow-up reminder until then
  events: StageEvent[]; // stages reached after sending (interview, offer, rejection); `d` above stays the send date
}

export interface Application extends ApplicationDoc {
  id: string;
  top: boolean; // note says the applicant ranked first ("nro 1")
}

export const STATUS: Record<Status, { label: string; color: string }> = {
  offer: { label: "Tarjous", color: "var(--st-offer)" },
  int: { label: "Haastattelu", color: "var(--st-int)" },
  wait: { label: "Ei vastausta", color: "var(--st-wait)" },
  no: { label: "Ei valittu", color: "var(--st-no)" },
  todo: { label: "Haettava", color: "var(--st-todo)" },
};
/** Outcomes of sent applications, in display order (`todo` is not an outcome). */
export const STATUS_ORDER: Status[] = ["offer", "int", "wait", "no"];

export const TYPES: Record<JobType, string> = {
  trainee: "Trainee / harjoittelu",
  expert: "Asiantuntija / muu",
  open: "Avoin hakemus",
};

export function classifyType(org: string, role: string): JobType {
  const s = `${org} ${role}`.toLowerCase();
  if (/avoin hak/.test(s)) return "open";
  if (/trainee|harjoittel|kesätyö|summer/.test(s)) return "trainee";
  return "expert";
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * The stored history, cleaned: one event per stage, none for a saved ad. A document from before the history
 * (schema 1) gets one event for its current status with an unknown date; nothing earlier is guessed, so an old
 * rejection does not say whether there was an interview. The current status is always in the history.
 */
function cleanEvents(raw: unknown, status: Status): StageEvent[] {
  if (status === "todo") return [];
  const out: StageEvent[] = [];
  for (const e of Array.isArray(raw) ? (raw as unknown[]) : []) {
    const s = str((e as { status?: unknown } | null)?.status);
    if (!isStage(s) || out.some((x) => x.status === s)) continue;
    const d = str((e as { d?: unknown }).d);
    out.push({ status: s, d: ISO_DATE.test(d) ? d : "" });
  }
  if (isStage(status) && !out.some((x) => x.status === status)) out.push({ status, d: "" });
  return out;
}

/** Turns any stored document (old or partial) into a complete Application. */
export function normalize(id: string, raw: Record<string, unknown> | undefined, today: string): Application {
  const x = raw ?? {};
  const status = str(x.status) as Status;
  const type = str(x.type) as JobType;
  const n = typeof x.n === "number" && Number.isFinite(x.n) ? x.n : null;
  const note = str(x.note);
  const url = str(x.url);
  const st: Status = status in STATUS ? status : "wait";
  return {
    id,
    schema: typeof x.schema === "number" ? x.schema : SCHEMA,
    d: ISO_DATE.test(str(x.d)) ? str(x.d) : today,
    end: str(x.end),
    org: str(x.org) || "(nimetön)",
    role: str(x.role),
    how: str(x.how),
    att: str(x.att),
    cv: str(x.cv),
    note,
    url: /^https?:\/\//.test(url) ? url : "",
    status: st,
    type: type in TYPES ? type : classifyType(str(x.org), str(x.role)),
    n,
    nPlus: !!x.nPlus,
    createdAt: str(x.createdAt),
    updatedAt: str(x.updatedAt),
    snoozeUntil: ISO_DATE.test(str(x.snoozeUntil)) ? str(x.snoozeUntil) : "",
    events: cleanEvents(x.events, st),
    top: /n(r|ro)\.? ?1\b/i.test(note),
  };
}

/** The stored part of an application (drops derived fields). */
export function toDoc(a: Application | ApplicationDoc): ApplicationDoc {
  return {
    schema: SCHEMA,
    d: a.d,
    end: a.end,
    org: a.org,
    role: a.role,
    how: a.how,
    att: a.att,
    cv: a.cv,
    note: a.note,
    url: a.url,
    status: a.status,
    type: a.type,
    n: a.n,
    nPlus: a.n != null && a.nPlus,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    snoozeUntil: a.snoozeUntil,
    events: a.events.map((e) => ({ status: e.status, d: e.d })),
  };
}

export function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[äå]/g, "a")
      .replace(/ö/g, "o")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "hakemus"
  );
}
export const newId = (d: string, org: string, role: string) =>
  `${d}-${slug(`${org} ${role}`)}-${Math.random().toString(36).slice(2, 6)}`;
