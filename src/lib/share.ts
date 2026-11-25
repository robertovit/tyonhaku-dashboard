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
