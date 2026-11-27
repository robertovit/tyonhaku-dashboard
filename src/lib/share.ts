// Android share target: the installed app is opened as /?title=…&text=…&url=… when an ad is shared to it.
export interface SharedAd {
  url: string;
  title: string;
}

const URL_RE = /https?:\/\/[^\s<>"']+/i;

/** What was shared, or null when the page was opened normally. Apps often put the link in `text`. */
export function parseShare(search: string): SharedAd | null {
  const p = new URLSearchParams(search);
  if (!p.has("url") && !p.has("text") && !p.has("title")) return null;
  const rawUrl = (p.get("url") ?? "").trim();
  const text = (p.get("text") ?? "").trim();
  const url = (URL_RE.test(rawUrl) ? rawUrl.match(URL_RE)![0] : text.match(URL_RE)?.[0]) ?? "";
  const fromText = text.replace(URL_RE, "").replace(/\s+/g, " ").trim();
  let title = (p.get("title") ?? "").trim() || fromText;
  if (title === url) title = "";
  title = title.replace(/\s+/g, " ").slice(0, 200);
  return url || title ? { url, title } : null;
}

export const SHARE_KEYS = ["title", "text", "url"];

const SITE_SUFFIX =
  /\s*[|\-–—]\s*(?:Työpaikat\s*-\s*)?(?:Duunitori|Oikotie[^|]*|Jobly|Indeed[^|]*|Työmarkkinatori)\s*$/i;
const LINKEDIN_SUFFIX = /\s*\|\s*LinkedIn[^|]*$/i;

/**
 * Splits a job ad's page title into role and employer for the add dialog. Known forms:
 * "Rooli - Yritys - Työpaikat - Duunitori", "Rooli at Yritys — Paikka | LinkedIn Jobs",
 * "Rooli klo Yritys — Paikka | LinkedIn-Työpaikat", "Yritys hiring Rooli in Paikka | LinkedIn",
 * and a plain "Rooli - Yritys". Anything else is returned whole as the role.
 */
export function splitAdTitle(raw: string): { role: string; org: string } {
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
  const parts = t.split(" - ");
  return parts.length === 2 && parts[0] && parts[1] ? done(parts[0], parts[1]) : done(t, "");
}
