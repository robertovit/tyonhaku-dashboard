export type Status = "offer" | "int" | "wait" | "no";
export type JobType = "trainee" | "expert" | "open";

/** Current shape of a stored application document. Bump SCHEMA and extend normalize() when fields change. */
export const SCHEMA = 1;

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
};
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

/** Turns any stored document (old or partial) into a complete Application. */
export function normalize(id: string, raw: Record<string, unknown> | undefined, today: string): Application {
  const x = raw ?? {};
  const status = str(x.status) as Status;
  const type = str(x.type) as JobType;
  const n = typeof x.n === "number" && Number.isFinite(x.n) ? x.n : null;
  const note = str(x.note);
  const url = str(x.url);
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
    status: status in STATUS ? status : "wait",
    type: type in TYPES ? type : classifyType(str(x.org), str(x.role)),
    n,
    nPlus: !!x.nPlus,
    createdAt: str(x.createdAt),
    updatedAt: str(x.updatedAt),
    snoozeUntil: ISO_DATE.test(str(x.snoozeUntil)) ? str(x.snoozeUntil) : "",
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
