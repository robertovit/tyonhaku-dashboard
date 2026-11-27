import { useState } from "react";
import { fmtDate } from "../lib/dates";
import { recordStatus, timeline, withEarlierInterview, withoutStage, withStageDate } from "../lib/history";
import { STATUS, type Stage, type StageEvent, type Status } from "../lib/model";

type HistoryOf = { d: string; status: Status; events: StageEvent[] };
const dateText = (d: string) => (d ? fmtDate(d) : "pvm ?");

/**
 * Read-only history: sent, then each stage reached, one row each (fits a phone screen). `rail` draws it as a
 * line of dots in the stage colors (the log cards).
 */
export function Timeline({ app, fresh, rail }: { app: HistoryOf; fresh?: Stage | null; rail?: boolean }) {
  return (
    <ol className={`timeline${rail ? " rail" : ""}`}>
      {timeline(app).map((r) => (
        <li key={r.key} data-k={r.key} className={r.key === fresh ? "new" : undefined}>
          <span className="pix">{r.key === "wait" ? "" : dateText(r.d)}</span>
          <span>
            {r.label}
            {r.key === fresh && <small> · kirjataan nyt</small>}
            {r.key !== "wait" && !r.d && <small className="sr"> (päivä ei tiedossa)</small>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The history in the edit dialog. Reading is the default; "Korjaa historiaa" is the deliberate way to change a
 * recorded day or take out a stage marked by mistake. Corrections go into the draft, so the reward box shows
 * what they cost before anything is saved.
 */
export function HistoryBox({
  draft,
  onFix,
}: {
  draft: HistoryOf & { eventDate: string };
  onFix: (fix: { status?: Status; events: StageEvent[] }) => void;
}) {
  const [fixing, setFixing] = useState(false);
  const pending = recordStatus(draft.events, draft.status, draft.eventDate);
  const fresh = pending.length > draft.events.length ? (pending.at(-1)!.status as Stage) : null;
  const canAddInterview =
    (draft.status === "no" || draft.status === "offer") && !draft.events.some((e) => e.status === "int");
  return (
    <section className="history" aria-labelledby="histH">
      <div className="history-head">
        <h3 id="histH">HISTORIA</h3>
        <button type="button" className="linkbtn" aria-expanded={fixing} onClick={() => setFixing(!fixing)}>
          {fixing ? "Valmis" : "Korjaa historiaa"}
        </button>
      </div>
      {!fixing ? (
        <Timeline app={{ ...draft, events: pending }} fresh={fresh} />
      ) : (
        <>
          <p className="hint">
            Korjaa väärä päivä tai poista vahingossa kirjattu vaihe. Poistettu vaihe poistuu myös pisteistä ja
            tilastoista. Muutokset tallentuvat, kun painat Tallenna.
          </p>
          <ol className="timeline fix">
            <li>
              <span>Hakemus lähetetty</span>
              <span className="pix">{fmtDate(draft.d)}</span>
            </li>
            {draft.events.map((e) => (
              <li key={e.status}>
                <span>{STATUS[e.status].label}</span>
                <input
                  type="date"
                  aria-label={`${STATUS[e.status].label}: päivä`}
                  value={e.d}
                  onChange={(ev) => onFix({ events: withStageDate(draft.events, e.status, ev.target.value) })}
                />
                <button
                  type="button"
                  className="btn sm danger"
                  aria-label={`Poista historiasta: ${STATUS[e.status].label}`}
                  onClick={() => onFix(withoutStage(draft, e.status))}
                >
                  Poista
                </button>
              </li>
            ))}
          </ol>
          {canAddInterview && (
            <button
              type="button"
              className="btn sm"
              onClick={() => onFix({ events: withEarlierInterview(draft.events, "") })}
            >
              + Lisää aiempi haastattelu
            </button>
          )}
        </>
      )}
    </section>
  );
}
