import { cleanDoc, readJson, setGoal, upsert, validId } from "../../_lib/db";
import { fail, json, type Env } from "../../_lib/env";

const MAX_IMPORT = 2000;

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare("SELECT id, doc FROM applications").all<{ id: string; doc: string }>();
  return json({ items: results.map((r) => ({ id: r.id, doc: JSON.parse(r.doc) })) });
};

/** Import a backup: { goal?, items: [{ id, doc }] }, upserted by id in one transaction. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await readJson(request)) as { goal?: unknown; items?: unknown } | undefined;
  if (!body || !Array.isArray(body.items)) return fail("Varmuuskopiosta puuttuu hakemuslista.", 400);
  if (body.items.length > MAX_IMPORT) return fail(`Enintään ${MAX_IMPORT} hakemusta kerralla.`, 400);
  const stmts: D1PreparedStatement[] = [];
  for (const it of body.items as { id?: unknown; doc?: unknown }[]) {
    const doc = cleanDoc(it?.doc);
    if (!validId(it?.id) || !doc) return fail("Varmuuskopiossa on virheellinen hakemus.", 400);
    stmts.push(upsert(env.DB, it.id, doc));
  }
  const g = Number(body.goal);
  if (body.goal != null && g >= 1 && g <= 50) stmts.push(setGoal(env.DB, Math.round(g)));
  if (stmts.length) await env.DB.batch(stmts);
  return json({ imported: body.items.length });
};
