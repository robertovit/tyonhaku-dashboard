import { useState } from "react";
import { dayDiff, fmtDate, waitingSince } from "../lib/dates";
import { STATUS, type Application, type Status } from "../lib/model";
import { countBy } from "../lib/stats";

type Filter = "all" | Status;
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
  canWrite,
  highlight,
  onEdit,
}: {
  apps: Application[];
  present: Status[];
  today: string;
  canWrite: boolean;
  highlight: string | null;
  onEdit: (a: Application) => void;
}) {
  const [stored, setFilter] = useState<Filter>(load);
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
  return (
    <section className="panel">
      <div className="ph">
        <h2>Kaikki hakemukset</h2>
        <p className="sub">{rows.length} hakemusta, uusin ensin</p>
      </div>
      <div className="filters" role="group" aria-label="Suodata tilan mukaan">
        {(["all", ...present] as Filter[]).map((k) => (
          <button type="button" key={k} className="chip" aria-pressed={filter === k} onClick={() => choose(k)}>
            {k === "all" ? "Kaikki" : STATUS[k].label} {k === "all" ? apps.length : counts[k]}
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
              <th>
                <span className="sr">Muokkaa</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className={a.id === highlight ? "just-saved" : undefined}>
                <td className="date">{fmtDate(a.d)}</td>
                <td>
                  <span className="org">{a.org}</span>
                  {a.role && ` · ${a.role}`}{" "}
                  {a.url && (
                    <a href={a.url} target="_blank" rel="noopener">
                      ilmoitus ↗
                    </a>
                  )}
                  {a.note && <span className="detail">{a.note}</span>}
                </td>
                <td className="date">{a.end || "–"}</td>
                <td>
                  <span className="pill">
                    <i style={{ background: STATUS[a.status].color }} />
                    {STATUS[a.status].label}
                    {a.status === "wait" && a.type !== "open" && <small> {dayDiff(waitingSince(a), today)} pv</small>}
                  </span>
                </td>
                <td className="num">{a.n != null ? `${a.n}${a.nPlus ? "+" : ""}` : "–"}</td>
                <td>
                  {canWrite && (
                    <button
                      type="button"
                      className="rowbtn"
                      aria-label={`Muokkaa: ${a.org} ${a.role}`}
                      onClick={() => onEdit(a)}
                    >
                      Muokkaa
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
