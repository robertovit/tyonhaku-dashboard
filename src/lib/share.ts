// Android share target: the installed app is opened as /?title=…&text=…&url=… when an ad is shared to it.
export interface SharedAd {
  url: string;
  title: string;
}

const URL_RE = /https?:\/\/[^\s<>"']+/i;
const TRACKING = /^(utm_\w+|fbclid|gclid|mc_[ce]id)$/i;

/** The link without tracking parameters (utm_*, fbclid, …); anything unparsable is returned as is. */
export function cleanUrl(raw: string): string {
  try {
    const u = new URL(raw);
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return raw;
  }
}

/** What was shared, or null when the page was opened normally. Apps often put the link in `text`. */
export function parseShare(search: string): SharedAd | null {
  const p = new URLSearchParams(search);
  if (!p.has("url") && !p.has("text") && !p.has("title")) return null;
  const rawUrl = (p.get("url") ?? "").trim();
  const text = (p.get("text") ?? "").trim();
  const found = (URL_RE.test(rawUrl) ? rawUrl.match(URL_RE)![0] : text.match(URL_RE)?.[0]) ?? "";
  const url = found && cleanUrl(found);
  const fromText = text.replace(URL_RE, "").replace(/\s+/g, " ").trim();
  let title = (p.get("title") ?? "").trim() || fromText;
  if (title === url || title === found) title = "";
  title = title.replace(/\s+/g, " ").slice(0, 200);
  return url || title ? { url, title } : null;
}

export const SHARE_KEYS = ["title", "text", "url"];

const SITE_SUFFIX =
  /\s*[|\-–—]\s*(?:Työpaikat\s*-\s*)?(?:Duunitori|Oikotie[^|]*|Jobly|Indeed[^|]*|Työmarkkinatori)\s*$/i;
const LINKEDIN_SUFFIX = /\s*\|\s*LinkedIn[^|]*$/i;

// Recruiting platforms that put the employer in the address: in the first part of the host name, or in the
// first path segment.
const ORG_IN_HOST = /^([^.]+)\.(?:wd\d+\.myworkdayjobs\.com|teamtailor\.com|recruitee\.com|breezy\.hr)$/i;
const ORG_IN_PATH =
  /^(?:jobs\.lever\.co|(?:job-)?boards\.greenhouse\.io|jobs\.smartrecruiters\.com|apply\.workable\.com|jobs\.ashbyhq\.com)$/i;

/** The employer named in a recruiting platform's address ("esimerkki-oy.teamtailor.com" → "Esimerkki Oy"),
 *  or "" for any other address. */
export function orgFromUrl(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "";
  }
  const name = u.hostname.match(ORG_IN_HOST)?.[1] ?? (ORG_IN_PATH.test(u.hostname) ? u.pathname.split("/")[1] : "");
  let words: string;
  try {
    words = decodeURIComponent(name ?? "");
  } catch {
    return "";
  }
  return words
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ")
    .slice(0, 200);
}

/** Letters and digits only, lowercase, without accents: "Bending Spoons Oy" → "bendingspoons". */
const squash = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(oyj?|ab|ltd|inc|gmbh|plc|llc|group)\b\.?/g, "")
    .replace(/[^a-z0-9]/g, "");

/** Which of the title's parts names the site's owner: the one found in the host name, else in the path.
 *  -1 when none or more than one does. */
function partInUrl(parts: string[], url: string): number {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return -1;
  }
  for (const where of [u.hostname, u.pathname]) {
    const w = squash(where);
    const hits = parts.flatMap((p, i) => {
      const s = squash(p);
      return s.length >= 3 && w.includes(s) ? [i] : [];
    });
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return -1;
  }
  return -1;
}

/**
 * Splits a job ad's page title into role and employer for the add dialog. Known forms:
 * "Rooli - Yritys - Työpaikat - Duunitori", "Rooli at Yritys — Paikka | LinkedIn Jobs",
 * "Rooli klo Yritys — Paikka | LinkedIn-Työpaikat", "Yritys hiring Rooli in Paikka | LinkedIn",
 * "Job Application for Rooli at Yritys", and on employers' own sites "Rooli | Yritys" or "Yritys - Rooli":
 * with the ad's `url`, the part found in the address is the employer. Anything else is returned whole as the role.
 * When the title names no employer, a recruiting platform's address may (`orgFromUrl`).
 */
export function splitAdTitle(raw: string, url = ""): { role: string; org: string } {
  const r = splitTitle(raw, url);
  return r.org ? r : { role: r.role, org: orgFromUrl(url) };
}

function splitTitle(raw: string, url: string): { role: string; org: string } {
  let t = raw.replace(/\s+/g, " ").trim();
  const linkedin = LINKEDIN_SUFFIX.test(t);
  t = t.replace(LINKEDIN_SUFFIX, "");
  while (SITE_SUFFIX.test(t)) t = t.replace(SITE_SUFFIX, "");
  const done = (role: string, org: string) => ({ role: role.trim().slice(0, 200), org: org.trim().slice(0, 200) });

  if (linkedin) {
    const hiring = t.match(/^(.+?) hiring (.+?)(?: in .+)?$/);
    if (hiring) return done(hiring[2], hiring[1]);
    t = t.replace(/\s+—\s+[^—]*$/, ""); // location
    const at = t.match(/^(.+) (?:at|klo) (.+)$/); // the last " at " / " klo ": the role may contain one
    if (at) return done(at[1], at[2]);
    return done(t, "");
  }
  const application = t.match(/^Job Application for (.+) at (.+)$/i);
  if (application) return done(application[1], application[2]);

  const parts = t.split(/ [|\-–—] /).filter(Boolean);
  if (parts.length < 2) return done(t, "");
  const org = partInUrl(parts, url);
  if (org >= 0)
    return done(
      parts.find((_, i) => i !== org)!,
      parts[org],
    );
  return parts.length === 2 ? done(parts[0], parts[1]) : done(t, "");
}
