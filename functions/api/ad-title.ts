// GET /api/ad-title?url=… → {title, role, org, reason}. Behind the same Access check as the rest of /api
// (see _middleware.ts). Never fails loudly: with nothing found the add dialog opens with the link only, and
// `reason` says why.
import { allowedAdUrl, fetchAd } from "../_lib/adTitle";
import { json, type Env } from "../_lib/env";

export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  const none = (reason: string) => json({ title: "", role: "", org: "", reason });
  const url = allowedAdUrl(new URL(request.url).searchParams.get("url"));
  if (!url) return none("linkki ei ole tunnetulta työpaikkasivustolta");
  try {
    return json(await fetchAd(url));
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return none(timeout ? `${url.hostname} ei vastannut ajoissa` : "sivun haku epäonnistui");
  }
};
