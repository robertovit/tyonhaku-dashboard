export interface Env {
  DB: D1Database;
  /** Cloudflare Access team domain, e.g. "myteam.cloudflareaccess.com". */
  ACCESS_TEAM_DOMAIN?: string;
  /** The Access application's AUD tag. */
  ACCESS_AUD?: string;
  /** Allowed sign-in emails, comma separated. */
  ALLOWED_EMAIL?: string;
  /** "1" skips the Access check, but only for requests to localhost (wrangler pages dev). */
  DEV_NO_AUTH?: string;
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
export const fail = (error: string, status: number) => json({ error }, status);
