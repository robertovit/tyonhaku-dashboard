// GET /api/ad-title?url=… → {title, role, org, reason}. Behind the same Access check as the rest of /api
// (see _middleware.ts). Never fails loudly: with nothing found the add dialog opens with the link only, and
// `reason` says why.
import { fetchAd, publicHttpsUrl } from "../_lib/adTitle";
import { json, type Env } from "../_lib/env";

export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  const none = (reason: string) => json({ title: "", role: "", org: "", reason });
  const self = new URL(request.url);
  const url = publicHttpsUrl(self.searchParams.get("url"), self.hostname);
  if (!url) return none("linkki ei ole julkinen https-osoite");
  try {
    return json(await fetchAd(url, fetch, self.hostname));
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return none(timeout ? `${url.hostname} ei vastannut ajoissa` : "sivun haku epäonnistui");
  }
};
