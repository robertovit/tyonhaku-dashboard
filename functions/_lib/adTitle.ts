// Reads the page title of a job ad, for ads shared as a bare link (the LinkedIn app shares only the URL).
// Only known job sites over https: the function must not work as an open proxy.
const SITES = ["linkedin.com", "duunitori.fi", "oikotie.fi", "jobly.fi", "tyomarkkinatori.fi", "indeed.com"];
const MAX_BYTES = 300_000;
const UA = "Mozilla/5.0 (compatible; Tyonhaku/1.0; +https://github.com/robertovit/tyonhaku-dashboard)";

/** The URL when it is an https link to a known job site, otherwise null. */
export function allowedAdUrl(raw: string | null): URL | null {
  let u: URL;
  try {
    u = new URL(raw ?? "");
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.port || u.username || u.password) return null;
  const h = u.hostname.toLowerCase();
  return SITES.some((s) => h === s || h.endsWith(`.${s}`)) ? u : null;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

/** og:title, or else <title>, from the start of an HTML page. */
export function extractTitle(html: string): string {
  const og =
    html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']*)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*property=["']og:title["']/i);
  const t = og?.[1] ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  return decode(t).replace(/\s+/g, " ").trim().slice(0, 300);
}

async function readStart(r: Response): Promise<string> {
  if (!r.body) return "";
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => {});
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) all.set(c, (at += c.length) - c.length);
  return new TextDecoder().decode(all.slice(0, MAX_BYTES));
}

/** What the server found about a shared ad. `role`/`org` are set when the site gives them separately. */
export interface AdInfo {
  title: string;
  role: string;
  org: string;
  /** Why nothing was found (shown to the owner, in Finnish); "" on success. */
  reason: string;
}

const LOGIN_WALL = /^\/(authwall|login|signup|uas\/login|checkpoint)/i;
const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
/** Pauses before each retry after "429 too many requests". One is enough: from Cloudflare LinkedIn answers 429
 *  nearly every time, and more retries only kept the add dialog waiting. */
const RETRY_WAITS = [700];

/** The start of an HTML page, or why it could not be read. Follows up to 3 redirects, each to a known site,
 *  and retries once after "429 too many requests". */
async function getPage(
  start: URL,
  fetcher: typeof fetch,
  signal: AbortSignal,
): Promise<{ html: string } | { reason: string; limited?: boolean }> {
  let url = start;
  for (let hop = 0, tries = 0; hop < 4;) {
    if (LOGIN_WALL.test(url.pathname)) return { reason: `${url.hostname} vaatii kirjautumisen` };
    const r = await fetcher(url.toString(), {
      redirect: "manual",
      signal,
      headers: { "user-agent": UA, accept: "text/html", "accept-language": "fi,en;q=0.8" },
    });
    if (r.status >= 300 && r.status < 400) {
      const to = new URL(r.headers.get("location") ?? "", url);
      const next = allowedAdUrl(to.toString());
      if (!next) return { reason: `ohjaus osoitteeseen ${to.hostname}` };
      url = next;
      hop++;
      continue;
    }
    if (r.status === 429 && tries < RETRY_WAITS.length) {
      await wait(RETRY_WAITS[tries++]);
      continue;
    }
    if (!r.ok) return { reason: `${url.hostname} vastasi ${r.status}`, limited: r.status === 429 };
    if (!(r.headers.get("content-type") ?? "").includes("html")) return { reason: "ei HTML-sivu" };
    return { html: await readStart(r) };
  }
  return { reason: "liikaa uudelleenohjauksia" };
}

/** The job id of a LinkedIn job link (/jobs/view/123…, /jobs/view/title-at-org-123…, ?currentJobId=123…). */
export function linkedinJobId(u: URL): string | null {
  if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
  const m = u.pathname.match(/\/jobs\/view\/(?:[^/]*?-)?(\d{6,})(?:\/|$)/);
  const q = u.searchParams.get("currentJobId");
  return m?.[1] ?? (q && /^\d{6,}$/.test(q) ? q : null);
}

/** Role and employer from LinkedIn's guest job posting page (the HTML the public job page is built from). */
export function parseLinkedinPosting(html: string): { role: string; org: string } {
  const text = (re: RegExp) =>
    decode((html.match(re)?.[1] ?? "").replace(/<[^>]*>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
  return {
    role: text(/<h[12][^>]*top-card-layout__title[^>]*>([\s\S]*?)<\/h[12]>/i).slice(0, 200),
    org: text(/<a[^>]*topcard__org-name-link[^>]*>([\s\S]*?)<\/a>/i).slice(0, 200),
  };
}

/** Everything the server can find about a shared ad link: for LinkedIn first its guest posting page (role and
 *  employer separately), then for any known site the page title. */
export async function fetchAd(start: URL, fetcher: typeof fetch = fetch): Promise<AdInfo> {
  const signal = AbortSignal.timeout(8000);
  let reason = "";
  const id = linkedinJobId(start);
  if (id) {
    const guest = new URL(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`);
    const page = await getPage(guest, fetcher, signal);
    if ("html" in page) {
      const { role, org } = parseLinkedinPosting(page.html);
      if (role) return { title: "", role, org, reason: "" };
      reason = "LinkedIn ei antanut ilmoituksen tietoja";
    } else if (page.limited)
      return { title: "", role: "", org: "", reason: page.reason }; // the page is limited too
    else reason = page.reason;
  }
  const page = await getPage(start, fetcher, signal);
  if ("reason" in page) return { title: "", role: "", org: "", reason: reason || page.reason };
  const title = extractTitle(page.html);
  return { title, role: "", org: "", reason: title ? "" : reason || "sivulla ei ollut otsikkoa" };
}
