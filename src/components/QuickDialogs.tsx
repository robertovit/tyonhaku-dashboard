import { useEffect, useMemo, useRef, useState } from "react";
import { fmtDate } from "../lib/dates";
import { gameState, statusGain } from "../lib/game";
import { recordStatus } from "../lib/history";
import { sentLabel } from "../lib/labels";
import { isStage, normalize, STATUS, toDoc, type Application, type ApplicationDoc, type Status } from "../lib/model";
import { UserFacingError } from "../lib/store";
import { Timeline } from "./History";

/** Saves a whole document; `label` names the save in the XP message ("Hylkäys kirjattu"). */
export type SaveDoc = (id: string, doc: ApplicationDoc, label: string) => Promise<void>;

/**
 * A short modal dialog: shown while `open`, closed by the caller's `finish` (saved or not). Escape and the close
 * button count as cancel. Focus goes back to the control that opened it when the dialog closes.
 */
function useQuickDialog(open: boolean, onCancel: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const active = useRef(false);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      active.current = true;
      d.showModal();
      first.current?.focus();
    } else if (!open && d.open) {
      active.current = false;
      d.close();
    }
  }, [open]);
  /** Closes the dialog right away (before the list re-renders), so focus can be moved after it. */
  const close = () => {
    active.current = false;
    ref.current?.close();
  };
  const props = {
    ref,
    onClose: () => {
      if (!active.current) return;
      active.current = false;
      onCancel();
    },
  };
  return { props, close, first };
}

function Head({ title, name, onCancel }: { title: string; name: string; onCancel: () => void }) {
  return (
    <div className="dlg-head">
      <h2 id="quickTitle">{title}</h2>
      <span className="sub quick-name">{name}</span>
      <button type="button" className="btn x" aria-label="Sulje" onClick={onCancel}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
    </div>
  );
}

const appName = (a: Application) => (a.role ? `${a.role} · ${a.org}` : a.org);
const STATUS_CHOICES: Status[] = ["int", "offer", "no", "wait"];
/** What the XP message calls each status update. */
const SAVED_AS: Record<Status, string> = {
  no: "Hylkäys kirjattu",
  int: "Haastattelu kirjattu",
  offer: "Tarjous kirjattu",
  wait: "Tila päivitetty",
  todo: "Tila päivitetty",
};

export interface StatusTarget {
  app: Application;
  /** The status to start from, e.g. "no" for "Kirjaa hylkäys". */
  preset?: Status;
}

/**
 * "Päivitä tila": the application's name, the new status, the day the news came and Tallenna. Saves through the
 * same history path as the edit dialog (recordStatus), so an interview stays in the history when a rejection
 * comes later. Resolves `onDone` with the saved status, or null when cancelled.
 */
export function StatusDialog({
  target,
  today,
  apps,
  goal,
  onSave,
  onDone,
  onMore,
}: {
  target: StatusTarget | null;
  today: string;
  apps: Application[];
  goal: number;
  onSave: SaveDoc;
  onDone: (saved: Status | null) => void;
  /** Opens the full edit dialog with the choices made here. */
  onMore: (app: Application, status: Status, eventDate: string) => void;
}) {
  const { props, close, first } = useQuickDialog(!!target, () => onDone(null));
  const cancel = () => {
    close();
    onDone(null);
  };
  return (
    <dialog {...props} className="frame dlg quick" aria-labelledby="quickTitle">
      {target && (
        <StatusForm
          key={target.app.id}
          target={target}
          today={today}
          apps={apps}
          goal={goal}
          first={first}
          onCancel={cancel}
          onSave={onSave}
          onSaved={(s) => {
            close();
            onDone(s);
          }}
          onMore={(s, d) => {
            close();
            onDone(null);
            onMore(target.app, s, d);
          }}
        />
      )}
    </dialog>
  );
}

function StatusForm({
  target,
  today,
  apps,
  goal,
  first,
  onCancel,
  onSave,
  onSaved,
  onMore,
}: {
  target: StatusTarget;
  today: string;
  apps: Application[];
  goal: number;
  first: React.RefObject<HTMLInputElement | null>;
  onCancel: () => void;
  onSave: SaveDoc;
  onSaved: (s: Status) => void;
  onMore: (s: Status, eventDate: string) => void;
}) {
  const { app } = target;
  const [status, setStatus] = useState<Status>(target.preset ?? app.status);
  const [day, setDay] = useState(today);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const events = recordStatus(app.events, status, day);
  const adds = isStage(status) && !app.events.some((e) => e.status === status) ? status : null;
  const already = !adds && isStage(status) && status !== app.status;
  const changed = status !== app.status;
  const gain = useMemo(() => {
    const next = normalize(app.id, { ...toDoc({ ...app, status, events }) }, today);
    const others = apps.filter((a) => a.id !== app.id);
    return gameState([...others, next], goal, today).xp - gameState(apps, goal, today).xp;
    // events follow from status and day
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app, apps, goal, today, status, day]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changed) return;
    if (adds && day && day < app.d) return setError(`Päivä on ennen hakupäivää ${fmtDate(app.d)}. Tarkista päivä.`);
    if (adds && day > today) return setError("Päivä on tulevaisuudessa. Valitse päivä, jolloin sait tiedon.");
    setSaving(true);
    setError("");
    try {
      await onSave(app.id, toDoc({ ...app, status, events, updatedAt: new Date().toISOString() }), SAVED_AS[status]);
      onSaved(status);
    } catch (err) {
      setError(err instanceof UserFacingError ? err.message : "Tallennus epäonnistui. Yritä uudelleen.");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <Head title="Päivitä tila" name={appName(app)} onCancel={onCancel} />
      <div className="quick-body">
        <p className="sub quick-now">
          Nyt: {STATUS[app.status].label} · {sentLabel(app.d)}
        </p>
        <fieldset className="status">
          <legend>Uusi tila</legend>
          <div className="scards">
            {STATUS_CHOICES.map((k) => {
              const g = statusGain(app, k);
              return (
                <label key={k} className="scard">
                  <input
                    ref={status === k ? first : undefined}
                    type="radio"
                    name="quick-status"
                    value={k}
                    checked={status === k}
                    onChange={() => {
                      setStatus(k);
                      setError("");
                    }}
                  />
                  <i className="dot" style={{ background: STATUS[k].color }} />
                  <span className="lab">
                    {STATUS[k].label}
                    {k === app.status && <span className="sub"> · nyt</span>}
                  </span>
                  {g > 0 && <span className="xp">+{g}</span>}
                </label>
              );
            })}
          </div>
        </fieldset>
        {adds && (
          <div className="field s">
            <label htmlFor="q-day">{STATUS[adds].label}: päivä, jolloin sait tiedon</label>
            <input
              id="q-day"
              type="date"
              min={app.d}
              max={today}
              value={day}
              onChange={(e) => {
                setDay(e.target.value);
                setError("");
              }}
            />
          </div>
        )}
        {already && (
          <p className="hint">{STATUS[status].label} on jo historiassa, joten siitä ei tule pisteitä uudelleen.</p>
        )}
        <section className="history" aria-label="Tapahtumat tallennuksen jälkeen">
          <h3>TAPAHTUMAT</h3>
          <Timeline app={{ d: app.d, status, events }} fresh={adds} rail />
        </section>
        <button type="button" className="linkbtn quick-more" onClick={() => onMore(status, day)}>
          Muokkaa muita tietoja
        </button>
      </div>
      {error && (
        <p className="ferr" role="alert">
          {error}
        </p>
      )}
      <div className="factions">
        <div className="right">
          <button type="button" className="btn" onClick={onCancel}>
            Peruuta
          </button>
          <button type="submit" className="btn primary" disabled={saving || !changed}>
            {saving ? "Tallennetaan…" : gain > 0 ? `Tallenna · +${gain} XP` : "Tallenna"}
          </button>
        </div>
      </div>
    </form>
  );
}

/**
 * "Merkitse haetuksi" for a saved ad: the place, the send date (today unless changed) and one button. The rest of
 * the application (CV version, attachments) opens in the full dialog. The XP that came true is shown after the
 * save (the celebration toast), not guessed beforehand.
 */
export function ApplyDialog({
  app,
  today,
  onSave,
  onDone,
  onMore,
}: {
  app: Application | null;
  today: string;
  onSave: SaveDoc;
  onDone: (saved: boolean) => void;
  onMore: (app: Application, d: string) => void;
}) {
  const { props, close, first } = useQuickDialog(!!app, () => onDone(false));
  const cancel = () => {
    close();
    onDone(false);
  };
  return (
    <dialog {...props} className="frame dlg quick" aria-labelledby="quickTitle">
      {app && (
        <ApplyForm
          key={app.id}
          app={app}
          today={today}
          first={first}
          onCancel={cancel}
          onSave={onSave}
          onSaved={() => {
            close();
            onDone(true);
          }}
          onMore={(d) => {
            close();
            onDone(false);
            onMore(app, d);
          }}
        />
      )}
    </dialog>
  );
}

function ApplyForm({
  app,
  today,
  first,
  onCancel,
  onSave,
  onSaved,
  onMore,
}: {
  app: Application;
  today: string;
  first: React.RefObject<HTMLInputElement | null>;
  onCancel: () => void;
  onSave: SaveDoc;
  onSaved: () => void;
  onMore: (d: string) => void;
}) {
  const [d, setD] = useState(today);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return setError("Valitse lähetyspäivä.");
    if (d > today) return setError("Lähetyspäivä on tulevaisuudessa. Valitse päivä, jolloin lähetit hakemuksen.");
    setSaving(true);
    setError("");
    try {
      const doc = toDoc({ ...app, status: "wait", d, events: [], updatedAt: new Date().toISOString() });
      await onSave(app.id, doc, "Merkitty haetuksi");
      onSaved();
    } catch (err) {
      setError(err instanceof UserFacingError ? err.message : "Tallennus epäonnistui. Yritä uudelleen.");
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} noValidate>
      <Head title="Merkitse haetuksi" name={appName(app)} onCancel={onCancel} />
      <div className="quick-body">
        <div className="field s">
          <label htmlFor="q-sent">Lähetyspäivä</label>
          <input
            ref={first}
            id="q-sent"
            type="date"
            max={today}
            value={d}
            onChange={(e) => {
              setD(e.target.value);
              setError("");
            }}
          />
        </div>
        <p className="hint">Hakemus siirtyy hakulokiin tilaan Ei vastausta. Pisteet näkyvät tallennuksen jälkeen.</p>
        <button type="button" className="linkbtn quick-more" onClick={() => onMore(d)}>
          Lisää muut tiedot (CV-versio, liitteet, hakutapa)
        </button>
      </div>
      {error && (
        <p className="ferr" role="alert">
          {error}
        </p>
      )}
      <div className="factions">
        <div className="right">
          <button type="button" className="btn" onClick={onCancel}>
            Peruuta
          </button>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? "Tallennetaan…" : "Merkitse haetuksi"}
          </button>
        </div>
      </div>
    </form>
  );
}
