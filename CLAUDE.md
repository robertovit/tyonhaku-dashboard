# Työnhaku-dashboard

Personal job-search tracker with gamification. UI text is Finnish. An installable PWA on Cloudflare Pages,
with Pages Functions + D1 as the backend and Cloudflare Access in front. Usable on the phone; on Android the
installed app is in the share menu. (It started as a claude.ai artifact; that version has been removed.)
A public demo with invented data runs on GitHub Pages (https://robertovit.github.io/tyonhaku-dashboard/).

Stack: React 19 + TypeScript + Vite, charts with visx (D3 scales/shapes), Vitest, ESLint, Prettier,
`vite-plugin-pwa`, Cloudflare Pages Functions (`functions/`) with D1, `jose` for the Access token check.

## Commands (run in the repo root)
- `npm run dev` – local dev server with an in-memory backend (`src/dev/memory.ts`, invented data from `fixtures.ts`)
- `npm run check` – typecheck (app + functions) + lint + tests (CI runs this and both builds)
- `npm run build` – the web app → `dist/` (PWA manifest, service worker, icons). Cloudflare Pages builds this on push to main.
- `npm run build:demo` – the public demo → `dist-demo/` (base `/tyonhaku-dashboard/`, no service worker).
  On push to main, `.github/workflows/ci.yml` publishes it to GitHub Pages after the checks pass.
  CI skips changes that touch only Markdown or `docs/`; Cloudflare Pages has the same exclusion in its
  build watch paths (set in the Pages dashboard).
- `npm run serve:web` – full stack locally after `npm run build`: `wrangler pages dev` with a local D1.
  Put `DEV_NO_AUTH=1` in `.dev.vars` (gitignored) to skip the Access check; it only works on localhost.
- `npm run icons` – regenerates `public/icons/` from the pixel character (needs Playwright installed globally)

## Backends
`src/lib/store.ts` defines what the UI uses (`ApplicationStore`, `Assistant`, `Downloads`, optional `restore`).
`src/lib/backend.ts` picks the implementation:
- `src/lib/web.ts` (the build): fetches `/api`, optimistic writes with rollback, reloads when the app
  becomes visible. An expired Access session shows "Kirjaudu uudelleen", which opens `/api/session`
  (never served by the service worker) so Access can show its login. "Kirjaudu ulos" in the footer goes to
  `/cdn-cgi/access/logout` (`Backend.logoutUrl`).
- `src/lib/memory.ts` – data in the browser, used by the two below (optionally kept in localStorage).
  - `src/dev/memory.ts` (`npm run dev`): the fixture in memory, plus a fake assistant so the dialog's fill box
    can be worked on.
  - `src/demo/demo.ts` (`--mode demo`): the fixture moved to the current week (`src/demo/seed.ts`) plus a few
    items around today, kept in the visitor's localStorage. `Backend.demo` makes the UI show the demo banner
    with "Palauta esimerkkidata"; there is no backup import or sign-out.
  Both are dynamic imports behind build-time constants, so the production build contains neither.
Components never touch `fetch` directly.

## API (`functions/`)
- `api/_middleware.ts` – Access check (`_lib/auth.ts`: JWT signature, `aud`, allowed email) and table creation
  (`_lib/db.ts`, `CREATE TABLE IF NOT EXISTS`, so no migration step).
- `api/applications` – `GET` list, `POST` import a backup `{goal?, items: [{id, doc}]}` (upsert, one batch);
  `api/applications/:id` – `PUT` set, `PATCH` merge, `DELETE`; `api/settings/goal` – `GET`, `PUT`.
- `api/ad-title?url=` – page title of a job ad shared as a bare link (the LinkedIn app shares only the URL).
  Only https links to known job sites (`_lib/adTitle.ts`, also re-checked on redirects), so it is no open proxy;
  answers `{title: ""}` on any failure. Duunitori blocks server requests, but browsers share its title anyway.
  The client splits titles into role and employer with `splitAdTitle()` (`src/lib/share.ts`).
- Every stored document goes through the app's own `normalize()` + `toDoc()`, so the server and client agree.
- D1 tables: `applications(id, doc JSON, updated_at)`, `settings(key, value JSON)`.
- Settings live in the Pages dashboard, never in the repo: binding `DB`, variables `ACCESS_TEAM_DOMAIN`,
  `ACCESS_AUD`, `ALLOWED_EMAIL`. Without them the API answers 500 (fails closed).
- Setup steps for the owner: `docs/KAYTTOONOTTO.md`.

## Structure
- `src/lib/` – pure logic, no React: `model.ts` (Application type, `normalize`, `toDoc`), `dates.ts`
  (`parseFinDate`, `deadlineIso`, `waitingSince`), `stats.ts`, `game.ts`, `csv.ts`, `backup.ts` (JSON backup),
  `share.ts` (`parseShare` for the Android share target), `adPrompt.ts` (prompt for the planned Claude fill)
- `src/components/` – UI; `src/components/charts/` – visx charts
- `src/styles/app.css` – design tokens and styles; colors always via tokens (status colors are `--st-<status>`)

## Look (Havu)
A dark JRPG menu: framed panels (`.frame`), DotGothic16 for headings and numbers (`.pix`),
M PLUS Rounded 1c for body text, lime accent. Dark is the designed theme; the light theme is derived from it.
The designs are on the owner's Design canvas (kept outside the repo).
Views are switched from the command menu (`CommandMenu` in `Tabs.tsx`), which becomes a bottom bar under 720 px.
The avatar is a 16×16 pixel character (`Avatar.tsx`) that gains an item per level; the app icons are drawn from it.

## Data model
`applications/<id>` holds `ApplicationDoc` (see `model.ts`); the goal is `{weekly}`.
Every document carries `schema` (currently 1). When adding fields: bump `SCHEMA`, give the field a default in
`normalize()` so old documents keep working, and add it to `toDoc()`.
Statuses: `todo` (haettava: a saved ad, not applied yet), `wait` (ei vastausta), `no` (ei valittu),
`int` (haastattelu), `offer` (tarjous). For `todo`, `d` is the day it was saved; "Merkitse haetuksi" sets
`status: wait` and `d` to today.
`App.tsx` splits the list: saved ads go to the Haettavat panel and everything else (game, stats, log,
follow-ups) only sees sent applications. Open applications (`type: "open"`) are excluded from follow-up reminders.

## Game rules
XP, levels, streaks and badges are derived from the applications in `game.ts` – nothing extra is stored.
`xpParts`/`xpForApp` give one application's XP (0 for `todo`); `badgeWeeks` replays the applications to date each badge.
Rewards effort, not outcomes (a handled rejection also gives XP). Tests in `src/lib/logic.test.ts` pin the
known values of the fixture (380 XP, level 3, 10/14 badges, 3 follow-ups); update them deliberately when rules change.

## Later: Claude fill in the web app
Not built yet (the owner decided to wait). Plan: `functions/api/fill.ts` calls the Anthropic API with a Pages
secret `ANTHROPIC_API_KEY`, builds the prompt with `adPrompt()` and cleans the answer with `toAdFields()`
(`src/lib/adPrompt.ts`); add an `Assistant` in `web.ts` that posts the ad text (or image) to `/api/fill`. The dialog's fill box appears as soon as `assistant` is set.

## Conventions
- This repo is public. Keep real application data, real company names, account ids, emails and the
  Design canvas and app URLs out of it (the demo URL is public on purpose); fixtures and demo data use invented
  employers.
- Pass `today` into logic functions instead of reading the clock, so tests stay deterministic.
