import { useEffect, useRef, useState } from "react";
import { dayDiff, fmtDate, waitingSince } from "../lib/dates";
import { xpForApp } from "../lib/game";
import { hadInterview } from "../lib/history";
import { appsText, sentLabel, waitLabel } from "../lib/labels";
import { STATUS, TYPES, type Application, type Status } from "../lib/model";
import { countBy, FOLLOWUP_DAYS } from "../lib/stats";
import { PHONE, useMedia } from "../hooks/useMedia";
import { Timeline } from "./History";
import { PixelIcon } from "./Pixels";

type Filter = "all" | Status;
const FIRST_ROWS = 12;
const load = (): Filter => {
  try {
    return (localStorage.getItem("th-filter") as Filter) || "all";
  } catch {
    return "all";
  }
};
/** Days a waiting application has had no news (0 when it is not waiting, or an open application). */
const waitDays = (a: Application, today: string) =>
  a.status === "wait" && a.type !== "open" ? dayDiff(waitingSince(a), today) : 0;
const applicants = (a: Application) => (a.n != null ? `${a.n}${a.nPlus ? "+" : ""}` : "");

interface Saved {
  id: string;
  text: string;
  /** The status update took the application out of the active filter. */
  gone: boolean;
}

/**
 * Hakuloki: the same rows, order and filter as cards on a phone and as a table on wider screens. "Päivitä tila"
 * opens the short status dialog; after a save the list says what was saved and where focus went.
 */
export function LogTable({
  apps,
  present,
  today,
  xp,
  canWrite,
  highlight,
  onEdit,
  onStatus,
  onCsv,
}: {
  apps: Application[];
  present: Status[];
  today: string;
  xp: number;
  canWrite: boolean;
  highlight: string | null;
  onEdit: (a: Application) => void;
  /** Opens "Päivitä tila"; resolves to the saved status, or null when nothing was saved. */
  onStatus: (a: Application) => Promise<Status | null>;
  /** CSV download of everything stored (not just the filtered rows); the label says what it holds. */
  onCsv: { label: string; run: () => void } | null;
}) {
  const phone = useMedia(PHONE);
  const [stored, setFilter] = useState<Filter>(load);
  const [all, setAll] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const noteRef = useRef<HTMLParagraphElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const filter: Filter = stored !== "all" && !present.includes(stored) ? "all" : stored;
  const counts = countBy(apps);
  const choose = (f: Filter) => {
    setFilter(f);
    setSaved(null);
    try {
      localStorage.setItem("th-filter", f);
    } catch {
      /* per-viewer convenience only */
    }
  };
  const rows = apps.filter((a) => filter === "all" || a.status === filter).sort((a, b) => b.d.localeCompare(a.d));
  const shown = all ? rows : rows.slice(0, FIRST_ROWS);

  const statusFor = async (a: Application) => {
    const s = await onStatus(a);
    if (!s) return;
    const name = a.role ? `${a.role} (${a.org})` : a.org;
    const gone = filter !== "all" && s !== filter;
    setSaved({
      id: a.id,
      gone,
      text: gone
        ? `Tallennettu: ${name} on nyt ${STATUS[s].label}. Se ei enää näy suodattimella ${STATUS[filter as Status].label}.`
        : `Tallennettu: ${name} on nyt ${STATUS[s].label}.`,
    });
  };
  // After a save: the note when the row left the list, otherwise back to the row's own "Päivitä tila".
  useEffect(() => {
    if (!saved) return;
    if (saved.gone) noteRef.current?.focus();
    else listRef.current?.querySelector<HTMLButtonElement>(`[data-status="${CSS.escape(saved.id)}"]`)?.focus();
  }, [saved]);
  const showSaved = () => {
    if (!saved) return;
    const id = saved.id;
    choose("all");
    setAll(true);
    requestAnimationFrame(() =>
      listRef.current?.querySelector<HTMLButtonElement>(`[data-status="${CSS.escape(id)}"]`)?.focus(),
    );
  };

  return (
    <section className="frame" aria-labelledby="logH">
      <div className="ph">
        <h2 id="logH">Hakuloki</h2>
        <span className="sub">{appsText(rows.length)}, uusin ensin</span>
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
      <p className="saved-note" ref={noteRef} tabIndex={-1} role="status" hidden={!saved}>
        {saved && (
          <>
            <PixelIcon name="check" />
            <span>{saved.text}</span>
            {saved.gone && (
              <button type="button" className="linkbtn" onClick={showSaved}>
                Näytä kaikki
              </button>
            )}
          </>
        )}
      </p>
      <div ref={listRef}>
        {phone ? (
          <ul className="log-cards">
            {shown.map((a) => (
              <LogCard
                key={a.id}
                app={a}
                today={today}
                canWrite={canWrite}
                saved={a.id === highlight}
                onStatus={() => void statusFor(a)}
                onEdit={() => onEdit(a)}
              />
            ))}
          </ul>
        ) : (
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
                    <span className="sr">Toiminnot</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((a) => {
                  const days = waitDays(a, today);
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
                            <summary>
                              <PixelIcon name="right" />
                              <PixelIcon name="down" />
                              Tapahtumat
                            </summary>
                            <Timeline app={a} rail />
                          </details>
                        )}
                      </td>
                      <td className="dim">
                        {a.end ? (
                          <span className="when-chip deadline none">
                            <PixelIcon name="calendar" />
                            {a.end}
                          </span>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td>
                        <span className="state">
                          <i className="dot" style={{ background: STATUS[a.status].color }} />
                          {STATUS[a.status].label}
                        </span>
                        {days >= FOLLOWUP_DAYS && (
                          <span className="when-chip wait">
                            <PixelIcon name="clock" />
                            {waitLabel(days)}
                          </span>
                        )}
                      </td>
                      <td className="num pixcell">{applicants(a) || "–"}</td>
                      <td className="num pixcell xp">+{xpForApp(a)}</td>
                      <td className="num">
                        {canWrite && (
                          <span className="row-actions">
                            <button
                              type="button"
                              className="btn sm lime"
                              data-status={a.id}
                              aria-label={`Päivitä tila: ${a.org} ${a.role}`}
                              onClick={() => void statusFor(a)}
                            >
                              Päivitä tila
                            </button>
                            <button
                              type="button"
                              className="btn sm"
                              aria-label={`Muokkaa: ${a.org} ${a.role}`}
                              onClick={() => onEdit(a)}
                            >
                              Muokkaa
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {rows.length > FIRST_ROWS && (
        <button type="button" className="btn more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? "▲ Näytä vähemmän" : `▼ Näytä kaikki ${rows.length}`}
        </button>
      )}
    </section>
  );
}

/**
 * One application on a phone: the role first and the employer under it, the status and send date, then
 * "Päivitä tila" and "Tapahtumat" (the history opens inside the card). XP, applicants and the ad link wait under
 * "Lisätiedot".
 */
function LogCard({
  app: a,
  today,
  canWrite,
  saved,
  onStatus,
  onEdit,
}: {
  app: Application;
  today: string;
  canWrite: boolean;
  saved: boolean;
  onStatus: () => void;
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const days = waitDays(a, today);
  const events = `ev-${a.id}`;
  return (
    <li className={`log-card${saved ? " just-saved" : ""}`}>
      <h3 className="lc-title">{a.role || a.org}</h3>
      {a.role && <p className="lc-org">{a.org}</p>}
      <p className="lc-meta">
        <span className="state-pill">
          <i className="dot" style={{ background: STATUS[a.status].color }} />
          {STATUS[a.status].label}
        </span>
        <span className="sub">{sentLabel(a.d)}</span>
        {days >= FOLLOWUP_DAYS && (
          <span className="when-chip wait">
            <PixelIcon name="clock" />
            {waitLabel(days)}
          </span>
        )}
      </p>
      <div className="lc-actions">
        {canWrite && (
          <button type="button" className="btn lime" data-status={a.id} onClick={onStatus}>
            Päivitä tila
          </button>
        )}
        <button
          type="button"
          className="btn"
          aria-expanded={open}
          aria-controls={events}
          onClick={() => setOpen(!open)}
        >
          Tapahtumat
          <PixelIcon name={open ? "down" : "right"} />
        </button>
      </div>
      {open && (
        <div className="lc-events" id={events}>
          <Timeline app={a} rail />
        </div>
      )}
      <details className="lc-more">
        <summary>
          <PixelIcon name="right" />
          <PixelIcon name="down" />
          Lisätiedot <span className="sub">XP, hakijat, ilmoitus, muokkaus</span>
        </summary>
        <dl>
          <dt>XP</dt>
          <dd className="pix accent">+{xpForApp(a)}</dd>
          <dt>Hakijoita</dt>
          <dd>{applicants(a) || "ei ilmoitettu"}</dd>
          {a.end && (
            <>
              <dt>Haku päättyi</dt>
              <dd className="when-chip deadline none">
                <PixelIcon name="calendar" />
                {a.end}
              </dd>
            </>
          )}
          <dt>Tyyppi</dt>
          <dd>{TYPES[a.type]}</dd>
          {(a.cv || a.att) && (
            <>
              <dt>Liitteet</dt>
              <dd>{[a.att, a.cv && `CV: ${a.cv}`].filter(Boolean).join(" · ")}</dd>
            </>
          )}
          {a.note && (
            <>
              <dt>Lisätieto</dt>
              <dd>{a.note}</dd>
            </>
          )}
        </dl>
        <div className="lc-links">
          {a.url && (
            <a className="btn sm" href={a.url} target="_blank" rel="noopener">
              Avaa ilmoitus ↗
            </a>
          )}
          {canWrite && (
            <button type="button" className="btn sm" onClick={onEdit}>
              Muokkaa tietoja
            </button>
          )}
        </div>
      </details>
    </li>
  );
}
