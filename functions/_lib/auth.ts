// Every /api request must carry a valid Cloudflare Access token for an allowed email.
// Access already blocks strangers at the edge; this check keeps the API closed even if Access is misconfigured.
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { fail, type Env } from "./env";

const keySets = new Map<string, JWTVerifyGetKey>();
const remoteKeys = (team: string) => {
  let k = keySets.get(team);
  if (!k) keySets.set(team, (k = createRemoteJWKSet(new URL(`https://${team}/cdn-cgi/access/certs`))));
  return k;
};
const host = (team: string) =>
  team
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

/** null = allowed; otherwise the response to send. `getKey` is injectable for tests. */
export async function authorize(req: Request, env: Env, getKey?: JWTVerifyGetKey): Promise<Response | null> {
  const local = ["localhost", "127.0.0.1"].includes(new URL(req.url).hostname);
  if (env.DEV_NO_AUTH === "1" && local) return null;
  const team = env.ACCESS_TEAM_DOMAIN ? host(env.ACCESS_TEAM_DOMAIN) : "";
  const allowed = (env.ALLOWED_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!team || !env.ACCESS_AUD || !allowed.length)
    return fail("Kirjautumista ei ole määritetty (ACCESS_TEAM_DOMAIN, ACCESS_AUD, ALLOWED_EMAIL).", 500);
  const token = req.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return fail("Kirjaudu sisään.", 403);
  try {
    const { payload } = await jwtVerify(token, getKey ?? remoteKeys(team), {
      issuer: `https://${team}`,
      audience: env.ACCESS_AUD,
    });
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
    return allowed.includes(email) ? null : fail("Tällä tunnuksella ei ole pääsyä.", 403);
  } catch {
    return fail("Kirjaudu sisään uudelleen.", 403);
  }
}
