import { readJson, setGoal } from "../../_lib/db";
import { fail, json, type Env } from "../../_lib/env";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'goal'").first<{ value: string }>();
  const w = row ? Number((JSON.parse(row.value) as { weekly?: unknown }).weekly) : NaN;
  return json({ weekly: w >= 1 && w <= 50 ? Math.round(w) : null });
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const w = Number(((await readJson(request)) as { weekly?: unknown } | undefined)?.weekly);
  if (!(w >= 1 && w <= 50)) return fail("Viikkotavoitteen pitää olla 1–50.", 400);
  await setGoal(env.DB, Math.round(w)).run();
  return json({ weekly: Math.round(w) });
};
