import { useState } from "react";
import { dayDiff, fmtDate, waitingSince } from "../lib/dates";
import { xpForApp } from "../lib/game";
import { hadInterview } from "../lib/history";
import { STATUS, type Application, type Status } from "../lib/model";
import { countBy, FOLLOWUP_DAYS } from "../lib/stats";
import { Timeline } from "./History";

type Filter = "all" | Status;
const FIRST_ROWS = 12;
const load = (): Filter => {
  try {
    return (localStorage.getItem("th-filter") as Filter) || "all";
  } catch {
    return "all";
  }
};

export function LogTable({
  apps,
  present,
  today,
  xp,
  canWrite,
  highlight,
  onEdit,
  onCsv,
}: {
  apps: Application[];
  present: Status[];
  today: string;
  xp: number;
  canWrite: boolean;
  highlight: string | null;
  onEdit: (a: Application) => void;
  /** CSV download of everything stored (not just the filtered rows); the label says what it holds. */
  onCsv: { label: string; run: () => void } | null;
}) {
  const [stored, setFilter] = useState<Filter>(load);
  const [all, setAll] = useState(false);
  const filter: Filter = stored !== "all" && !present.includes(stored) ? "all" : stored;
  const counts = countBy(apps);
  const choose = (f: Filter) => {
    setFilter(f);
    try {
      localStorage.setItem("th-filter", f);
    } catch {
      /* per-viewer convenience only */
    }
  };
  const rows = apps.filter((a) => filter === "all" || a.status === filter).sort((a, b) => b.d.localeCompare(a.d));
  const shown = all ? rows : rows.slice(0, FIRST_ROWS);
  return (
    <section className="frame" aria-labelledby="logH">
      <div className="ph">
        <h2 id="logH">Hakuloki</h2>
        <span className="sub">{rows.length} hakemusta, uusin ensin</span>
        <span className="end pix sub">
          KERÄTTY XP <span className="accent">{xp}</span>
        </span>
      </div>
      {onCsv && (
        <div className="log-tools">
          <button type="button" className="btn sm" onClick={onCsv.run}>
            {onCsv.label}
          </button>
          {filter !== "all" && <span className="sub">Lataus sisältää kaikki, ei vain suodatettuja.</span>}
        </div>
      )}
      <div className="filters" role="group" aria-label="Suodata tilan mukaan">
        {(["all", ...present] as Filter[]).map((k) => (
          <button type="button" key={k} className="chip" aria-pressed={filter === k} onClick={() => choose(k)}>
            {k !== "all" && <i className="dot" style={{ background: STATUS[k].color }} />}
            {k === "all" ? "Kaikki" : STATUS[k].label} <b>{k === "all" ? apps.length : counts[k]}</b>
          </button>
        ))}
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Haettu</th>
              <th>Työnantaja ja tehtävä</th>
              <th>Haku päättyi</th>
              <th>Tila</th>
              <th className="num">Hakijoita</th>
              <th className="num">XP</th>
              <th>
                <span className="sr">Muokkaa</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((a) => {
              const days = a.status === "wait" && a.type !== "open" ? dayDiff(waitingSince(a), today) : 0;
              const hi = hadInterview(a);
              return (
                <tr key={a.id} className={a.id === highlight ? "just-saved" : undefined}>
                  <td className="pixcell">{fmtDate(a.d)}</td>
                  <td>
                    <span className="org">{a.org}</span>
                    {a.role && ` · ${a.role}`}{" "}
                    {a.url && (
                      <a href={a.url} target="_blank" rel="noopener">
                        ilmoitus ↗
                      </a>
                    )}
                    {a.note && <span className={`detail${hi ? " hi" : ""}`}>{hi ? `★ ${a.note}` : a.note}</span>}
                    {a.events.length > 0 && (
                      <details className="hist">
                        <summary>Historia</summary>
                        <Timeline app={a} />
                      </details>
                    )}
                  </td>
                  <td className="pixcell dim">{a.end || "–"}</td>
                  <td>
                    <span className="state">
                      <i className="dot" style={{ background: STATUS[a.status].color }} />
                      {STATUS[a.status].label}
                      {days >= FOLLOWUP_DAYS && <small>{days} pv</small>}
                    </span>
                  </td>
                  <td className="num pixcell">{a.n != null ? `${a.n}${a.nPlus ? "+" : ""}` : "–"}</td>
                  <td className="num pixcell xp">+{xpForApp(a)}</td>
                  <td className="num">
                    {canWrite && (
                      <button
                        type="button"
                        className="btn sm"
                        aria-label={`Muokkaa: ${a.org} ${a.role}`}
                        onClick={() => onEdit(a)}
                      >
                        Muokkaa
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > FIRST_ROWS && (
        <button type="button" className="btn more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? "▲ Näytä vähemmän" : `▼ Näytä kaikki ${rows.length}`}
        </button>
      )}
    </section>
  );
}
