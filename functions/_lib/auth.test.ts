import { describe, expect, it } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { authorize } from "./auth";
import type { Env } from "./env";

const TEAM = "tiimi.cloudflareaccess.com";
const env = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: "aud123", ALLOWED_EMAIL: "Minä@Esim.fi" } as Env;

async function setup() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
  const getKey = createLocalJWKSet({ keys: [jwk] });
  const token = (claims: Record<string, unknown>, aud = "aud123") =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(`https://${TEAM}`)
      .setAudience(aud)
      .setExpirationTime("1h")
      .sign(privateKey);
  const req = (t?: string, url = "https://tyonhaku.pages.dev/api/applications") =>
    new Request(url, { headers: t ? { "Cf-Access-Jwt-Assertion": t } : {} });
  return { getKey, token, req };
}

describe("Access check", () => {
  it("lets in the allowed email only", async () => {
    const { getKey, token, req } = await setup();
    expect(await authorize(req(await token({ email: "minä@esim.fi" })), env, getKey)).toBeNull();
    expect((await authorize(req(await token({ email: "muu@esim.fi" })), env, getKey))?.status).toBe(403);
    expect((await authorize(req(await token({ email: "minä@esim.fi" }, "toinen")), env, getKey))?.status).toBe(403);
    expect((await authorize(req(), env, getKey))?.status).toBe(403);
  });
  it("fails closed without settings, and skips the check only on localhost in dev", async () => {
    const { getKey, req } = await setup();
    expect((await authorize(req(), {} as Env, getKey))?.status).toBe(500);
    const dev = { DEV_NO_AUTH: "1" } as Env;
    expect(await authorize(req(undefined, "http://localhost:8788/api/applications"), dev, getKey)).toBeNull();
    expect((await authorize(req(), dev, getKey))?.status).toBe(500);
  });
});
