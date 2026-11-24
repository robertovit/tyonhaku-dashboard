# Työnhaku-dashboard

Personal job-search tracker with gamification, published as a private claude.ai artifact. UI text is Finnish.

Stack: React 19 + TypeScript + Vite, charts with visx (D3 scales/shapes), Vitest, ESLint, Prettier.
`vite-plugin-singlefile` bundles everything into one HTML file because the artifact CSP blocks external scripts.

## Commands (run in the repo root)
- `npm run dev` – local dev server with an in-memory mock of the artifact runtime (`src/dev/mock.ts`, invented data)
- `npm run check` – typecheck + lint + tests (CI runs this and `npm run build`)
- `npm run build` – writes `dist/index.html` and `dist/artifact.html` (the publishable page content without `<html>/<head>/<body>`)

## Publishing
Build, then publish `dist/artifact.html` with the Artifact tool **to the existing artifact URL** (pass `url`; the owner keeps it outside the repo).
That keeps the stored data. Capabilities must stay:
`{"db": {"rules": [{"path": "", "read": "view", "write": "owner"}]}, "user": {}, "sample": {}, "downloads": true}`.
Omit `capabilities` on a republish to keep them as they are.

## Structure
- `src/lib/` – pure logic, no React: `model.ts` (Application type, `normalize`, `toDoc`), `dates.ts`,
  `stats.ts` (weekly series, follow-ups, rankings), `game.ts` (XP rules, levels, badges, celebrations), `csv.ts`
- `src/lib/store.ts` – the interfaces the UI uses (`ApplicationStore`, `Assistant`, `Downloads`);
  `src/lib/claude.ts` implements them with `window.claude` (db / user / sample / downloads). Components never touch `window.claude`.
  To move off claude.ai, write another implementation of `store.ts` and swap `connect()`.
- `src/components/` – UI; `src/components/charts/` – visx charts (`HBarChart`, `WeeklyChart`, `OutcomeBar`, shared `Tooltip`)
- `src/styles/app.css` – design tokens and styles; colors always via tokens (status colors are `--st-<status>`)

## Look (Havu)
A dark JRPG menu: framed panels (`.frame`), DotGothic16 for headings and numbers (`.pix`),
M PLUS Rounded 1c for body text, lime accent. Dark is the designed theme; the light theme is derived from it.
The designs are on the owner's Design canvas (kept outside the repo, like the artifact URL).
Views are switched from the command menu (`CommandMenu` in `Tabs.tsx`), which becomes a bottom bar under 720 px.
The avatar is a 16×16 pixel character (`Avatar.tsx`) that gains an item per level.

## Data model
Collection `applications/<id>` holds `ApplicationDoc` (see `model.ts`); `settings/goal` holds `{weekly}`.
Every document carries `schema` (currently 1). When adding fields: bump `SCHEMA`, give the field a default in
`normalize()` so old documents keep working, and add it to `toDoc()`.
Statuses: `wait` (ei vastausta), `no` (ei valittu), `int` (haastattelu), `offer` (tarjous).
Open applications (`type: "open"`) are excluded from follow-up reminders.

## Game rules
XP, levels, streaks and badges are derived from the applications in `game.ts` – nothing extra is stored.
`xpParts`/`xpForApp` give one application's XP (log column, the dialog's PALKKIO panel); `badgeWeeks` replays the
applications to date each badge.
Rewards effort, not outcomes (a handled rejection also gives XP). Tests in `src/lib/logic.test.ts` pin the
known values of the fixture (380 XP, level 3, 10/14 badges, 3 follow-ups); update them deliberately when rules change.

## Conventions
- This repo is public. Keep real application data, real company names, and the artifact and Design canvas URLs
  out of it; fixtures use invented employers.
- Pass `today` into logic functions instead of reading the clock, so tests stay deterministic.
