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

export interface AdTitle {
  title: string;
  /** Why there is no title (shown to the owner, in Finnish); "" when there is one. */
  reason: string;
}

const LOGIN_WALL = /^\/(authwall|login|signup|uas\/login|checkpoint)/i;

/** The ad's title, or a reason why the page could not be read. Follows up to 3 redirects, each to a known site. */
export async function fetchAdTitle(start: URL, fetcher: typeof fetch = fetch): Promise<AdTitle> {
  const no = (reason: string): AdTitle => ({ title: "", reason });
  let url = start;
  const signal = AbortSignal.timeout(5000);
  for (let hop = 0, tries = 0; hop < 4;) {
    if (LOGIN_WALL.test(url.pathname)) return no(`${url.hostname} vaatii kirjautumisen`);
    const r = await fetcher(url.toString(), {
      redirect: "manual",
      signal,
      headers: { "user-agent": UA, accept: "text/html", "accept-language": "fi,en;q=0.8" },
    });
    if (r.status >= 300 && r.status < 400) {
      const to = new URL(r.headers.get("location") ?? "", url);
      const next = allowedAdUrl(to.toString());
      if (!next) return no(`ohjaus osoitteeseen ${to.hostname}`);
      url = next;
      hop++;
      continue;
    }
    if (r.status === 429 && tries++ === 0) {
      await new Promise((ok) => setTimeout(ok, 700));
      continue;
    }
    if (!r.ok) return no(`${url.hostname} vastasi ${r.status}`);
    if (!(r.headers.get("content-type") ?? "").includes("html")) return no("ei HTML-sivu");
    const title = extractTitle(await readStart(r));
    return title ? { title, reason: "" } : no("sivulla ei ollut otsikkoa");
  }
  return no("liikaa uudelleenohjauksia");
}
