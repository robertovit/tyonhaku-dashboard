import { cleanDoc, getDoc, readJson, upsert, validId } from "../../_lib/db";
import { fail, json, type Env } from "../../_lib/env";

const idOf = (p: string | string[]) => (Array.isArray(p) ? p[0] : p);

/** Replace (set) one application. */
export const onRequestPut: PagesFunction<Env> = async ({ request, env, params }) => {
  const id = idOf(params.id);
  if (!validId(id)) return fail("Virheellinen tunniste.", 400);
  const doc = cleanDoc(await readJson(request));
  if (!doc) return fail("Virheellinen hakemus.", 400);
  await upsert(env.DB, id, doc).run();
  return json({ id, doc });
};

/** Merge fields into one application. */
export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const id = idOf(params.id);
  if (!validId(id)) return fail("Virheellinen tunniste.", 400);
  const patch = await readJson(request);
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return fail("Virheellinen muutos.", 400);
  const cur = await getDoc(env.DB, id);
  if (!cur) return fail("Hakemusta ei löytynyt.", 404);
  const doc = cleanDoc({ ...cur, ...patch })!;
  await upsert(env.DB, id, doc).run();
  return json({ id, doc });
};

export const onRequestDelete: PagesFunction<Env> = async ({ env, params }) => {
  const id = idOf(params.id);
  if (!validId(id)) return fail("Virheellinen tunniste.", 400);
  await env.DB.prepare("DELETE FROM applications WHERE id = ?1").bind(id).run();
  return new Response(null, { status: 204 });
};
