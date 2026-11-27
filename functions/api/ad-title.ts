// GET /api/ad-title?url=… → {title, reason}. Behind the same Access check as the rest of /api (see _middleware.ts).
// Never fails loudly: with no title the add dialog simply opens with the link only, and `reason` says why.
import { allowedAdUrl, fetchAdTitle } from "../_lib/adTitle";
import { json, type Env } from "../_lib/env";

export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  const url = allowedAdUrl(new URL(request.url).searchParams.get("url"));
  if (!url) return json({ title: "", reason: "linkki ei ole tunnetulta työpaikkasivustolta" });
  try {
    return json(await fetchAdTitle(url));
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return json({ title: "", reason: timeout ? `${url.hostname} ei vastannut ajoissa` : "sivun haku epäonnistui" });
  }
};
