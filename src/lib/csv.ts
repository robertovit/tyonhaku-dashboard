import { STATUS, TYPES, type Application } from "./model";

const COLUMNS: [string, (a: Application) => string | number | null][] = [
  ["Haettu", (a) => a.d],
  ["Haku päättyy", (a) => a.end],
  ["Työnantaja", (a) => a.org],
  ["Tehtävä", (a) => a.role],
  ["Tehtävätyyppi", (a) => TYPES[a.type]],
  ["Tila", (a) => STATUS[a.status].label],
  ["Lisätieto", (a) => a.note],
  ["Hakijoita", (a) => (a.n == null ? "" : `${a.n}${a.nPlus ? "+" : ""}`)],
  ["Hakutapa", (a) => a.how],
  ["Liitteet", (a) => a.att],
  ["CV-versio", (a) => a.cv],
  ["Linkki", (a) => a.url],
];

const cell = (v: string | number | null) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV with a BOM so Excel opens the Finnish characters correctly. */
export function toCsv(apps: Application[]): string {
  const rows = [...apps].sort((a, b) => a.d.localeCompare(b.d));
  const lines = [COLUMNS.map(([h]) => h).join(","), ...rows.map((a) => COLUMNS.map(([, f]) => cell(f(a))).join(","))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}
