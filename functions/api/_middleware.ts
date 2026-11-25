import { authorize } from "../_lib/auth";
import { ensureSchema } from "../_lib/db";
import { fail, type Env } from "../_lib/env";

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const denied = await authorize(ctx.request, ctx.env);
  if (denied) return denied;
  if (!ctx.env.DB) return fail("Tietokantaa ei ole liitetty (D1-binding DB puuttuu).", 500);
  await ensureSchema(ctx.env.DB);
  return ctx.next();
};
