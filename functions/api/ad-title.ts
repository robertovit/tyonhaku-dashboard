// GET /api/ad-title?url=… → {title}. Behind the same Access check as the rest of /api (see _middleware.ts).
// Never fails loudly: with no title the add dialog simply opens with the link only.
import { allowedAdUrl, fetchAdTitle } from "../_lib/adTitle";
import { json, type Env } from "../_lib/env";

export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  const url = allowedAdUrl(new URL(request.url).searchParams.get("url"));
  if (!url) return json({ title: "" });
  try {
    return json({ title: await fetchAdTitle(url) });
  } catch {
    return json({ title: "" });
  }
};
