import { useEffect, useMemo, useRef, useState } from "react";
import { weekKey } from "../lib/dates";
import { gameState, xpForApp, xpParts } from "../lib/game";
import {
  classifyType,
  newId,
  normalize,
  STATUS,
  toDoc,
  TYPES,
  SCHEMA,
  type Application,
  type ApplicationDoc,
  type JobType,
  type Status,
} from "../lib/model";
import { UserFacingError, type AdFields, type Assistant } from "../lib/store";

interface Draft {
  status: Status;
  n: string;
  nPlus: boolean;
  note: string;
  org: string;
  role: string;
  d: string;
  end: string;
  type: JobType;
  how: string;
  att: string;
  cv: string;
  url: string;
}
type AdField = "org" | "role" | "end" | "how" | "att" | "url" | "n";
const LABELS: Record<string, string> = {
  org: "työnantaja",
  role: "tehtävä",
  end: "määräaika",
  how: "hakutapa",
  att: "liitteet",
  url: "linkki",
  n: "hakijamäärä",
  type: "tyyppi",
};

const fromApp = (a: Application | null, today: string): Draft =>
  a
    ? { ...a, n: a.n != null ? String(a.n) : "" }
    : {
        status: "wait",
        n: "",
        nPlus: false,
        note: "",
        org: "",
        role: "",
        d: today,
        end: "",
        type: "trainee",
        how: "",
        att: "",
        cv: "",
        url: "",
      };

function buildDoc(draft: Draft, app: Application | null, now: string): ApplicationDoc {
  const n = draft.n.trim() === "" ? null : Math.round(Number(draft.n));
  return toDoc({
    schema: SCHEMA,
    d: draft.d,
    org: draft.org.trim(),
    role: draft.role.trim(),
    end: draft.end.trim(),
    how: draft.how.trim(),
    att: draft.att.trim(),
    cv: draft.cv.trim(),
    note: draft.note.trim(),
    url: draft.url.trim(),
    status: draft.status,
    type: draft.type,
    n: n != null && n >= 0 ? n : null,
    nPlus: draft.nPlus,
    createdAt: app?.createdAt || now,
    updatedAt: now,
    snoozeUntil: app?.snoozeUntil ?? "",
  });
}

export interface EditTarget {
  app: Application | null; // null = new application
  /** Fields to start from, e.g. a shared ad or "mark as applied" on a saved one. */
  prefill?: Partial<Pick<Draft, "status" | "d" | "url" | "role" | "org">>;
}

export function EditDialog({
  target,
  today,
  apps,
  goal,
  assistant,
  onSave,
  onDelete,
  onClose,
}: {
  target: EditTarget | null;
  today: string;
  apps: Application[];
  goal: number;
  assistant: Assistant | null;
  onSave: (id: string, doc: ApplicationDoc) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Draft>(() => fromApp(null, today));
  const [filled, setFilled] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [armedDelete, setArmedDelete] = useState(false);
  const [typeTouched, setTypeTouched] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);
  const nField = useRef<HTMLInputElement>(null);
  const app = target?.app ?? null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (target && !d.open) {
      setDraft({ ...fromApp(target.app, today), ...target.prefill });
      setFilled(new Set());
      setError("");
      setArmedDelete(false);
      setTypeTouched(!!target.app);
      d.showModal();
      setTimeout(
        () => (target.app && target.prefill?.status !== "wait" ? nField.current : firstField.current)?.focus(),
        0,
      );
    } else if (!target && d.open) d.close();
  }, [target, today]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((p) => {
      const next = { ...p, [k]: v };
      if (!app && !typeTouched && (k === "org" || k === "role")) next.type = classifyType(next.org, next.role);
      return next;
    });
    setFilled((f) => {
      if (!f.has(k)) return f;
      const n = new Set(f);
      n.delete(k);
      return n;
    });
  };

  const applyAd = (r: AdFields) => {
    const got: string[] = [];
    const next = { ...draft };
    const put = (k: AdField, v: string) => {
      if (!v || (app && String(next[k]).trim() !== "")) return;
      next[k] = v;
      got.push(k);
    };
    put("org", r.org);
    put("role", r.role);
    put("end", /^\d{1,2}\.\d{1,2}\.?/.test(r.end) || /jatkuva/i.test(r.end) ? r.end : "");
    put("how", r.how);
    put("att", r.att);
    put("url", /^https?:\/\/\S+$/.test(r.url) ? r.url : "");
    put("n", r.n != null ? String(r.n) : "");
    if (r.type in TYPES && (!app || !typeTouched)) {
      next.type = r.type as JobType;
      got.push("type");
      setTypeTouched(true);
    }
    setDraft(next);
    setFilled(new Set(got));
    return got.map((k) => LABELS[k]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const org = draft.org.trim();
    if (!org) return setError("Kirjoita työnantajan nimi.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.d)) return setError("Valitse hakupäivä.");
    const n = draft.n.trim() === "" ? null : Math.round(Number(draft.n));
    if (n != null && !(n >= 0)) return setError("Hakijoiden määrän pitää olla luku.");
    const url = draft.url.trim();
    if (url && !/^https?:\/\//.test(url)) return setError("Linkin pitää alkaa https://");
    const doc = buildDoc(draft, app, new Date().toISOString());
    setSaving(true);
    setError("");
    try {
      await onSave(app?.id ?? newId(draft.d, doc.org, doc.role), doc);
      onClose();
    } catch (err) {
      setError(err instanceof UserFacingError ? err.message : "Tallennus epäonnistui. Yritä uudelleen.");
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!app) return;
    if (!armedDelete) return setArmedDelete(true);
    try {
      await onDelete(app.id);
      onClose();
    } catch (err) {
      setError(err instanceof UserFacingError ? err.message : "Poisto epäonnistui. Yritä uudelleen.");
    }
  };

  const title =
    app?.status === "todo" && draft.status !== "todo"
      ? "Merkitse haetuksi"
      : app
        ? "Muokkaa hakemusta"
        : draft.status === "todo"
          ? "Uusi haettava"
          : "Uusi hakemus";
  const f = (k: string, size = "") => `field${size ? ` ${size}` : ""}${filled.has(k) ? " filled" : ""}`;
  const base = { cv: draft.cv, att: draft.att };
  const statusXp = (k: Status) => xpForApp({ ...base, status: k }) - xpForApp({ ...base, status: "wait" });
  return (
    <dialog ref={ref} className="frame dlg" aria-labelledby="dlgTitle" onClose={onClose} onCancel={onClose}>
      {target && (
        <form onSubmit={submit} noValidate>
          <div className="dlg-head">
            <h2 id="dlgTitle">{title}</h2>
            <span className="sub">
              {app
                ? `${app.org}${app.role ? ` · ${app.role}` : ""}`
                : target.prefill
                  ? "Jaettu ilmoitus talteen"
                  : "Uusi tehtävä kirjaan"}
            </span>
            <button type="button" className="btn x" aria-label="Sulje" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          </div>
          <div className="dlg-body">
            <div className="dlg-main">
              {assistant && (
                <AiFill key={app?.id ?? "new"} assistant={assistant} openByDefault={!app} onResult={applyAd} />
              )}
              <div className="fgrid">
                <div className={f("org")}>
                  <label htmlFor="f-org">Työnantaja</label>
                  <input
                    ref={firstField}
                    id="f-org"
                    type="text"
                    autoComplete="off"
                    value={draft.org}
                    onChange={(e) => set("org", e.target.value)}
                  />
                </div>
                <div className={f("role")}>
                  <label htmlFor="f-role">Tehtävä</label>
                  <input
                    id="f-role"
                    type="text"
                    autoComplete="off"
                    value={draft.role}
                    onChange={(e) => set("role", e.target.value)}
                  />
                </div>
                <div className="field s">
                  <label htmlFor="f-d">{draft.status === "todo" ? "Lisätty" : "Haettu"}</label>
                  <input id="f-d" type="date" value={draft.d} onChange={(e) => set("d", e.target.value)} />
                </div>
                <div className={f("end", "s")}>
                  <label htmlFor="f-end">Haku päättyy</label>
                  <input
                    id="f-end"
                    type="text"
                    placeholder="esim. 31.10. tai jatkuva haku"
                    value={draft.end}
                    onChange={(e) => set("end", e.target.value)}
                  />
                </div>
                <div className={f("type", "m")}>
                  <label htmlFor="f-type">Tehtävätyyppi</label>
                  <select
                    id="f-type"
                    value={draft.type}
                    onChange={(e) => {
                      setTypeTouched(true);
                      set("type", e.target.value as JobType);
                    }}
                  >
                    {(Object.keys(TYPES) as JobType[]).map((k) => (
                      <option key={k} value={k}>
                        {TYPES[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={f("how", "m")}>
                  <label htmlFor="f-how">Hakutapa</label>
                  <input
                    id="f-how"
                    type="text"
                    list="howList"
                    placeholder="Nettilomake, sähköposti…"
                    value={draft.how}
                    onChange={(e) => set("how", e.target.value)}
                  />
                </div>
                <div className={f("att", "m")}>
                  <label htmlFor="f-att">Liitteet</label>
                  <input
                    id="f-att"
                    type="text"
                    placeholder="CV, saatekirje"
                    value={draft.att}
                    onChange={(e) => set("att", e.target.value)}
                  />
                </div>
                <div className="field m">
                  <label htmlFor="f-cv">CV-versio</label>
                  <input
                    id="f-cv"
                    type="text"
                    placeholder="räätälöidyn CV:n nimi"
                    value={draft.cv}
                    onChange={(e) => set("cv", e.target.value)}
                  />
                </div>
                <div className={f("url", "full")}>
                  <label htmlFor="f-url">Ilmoituksen linkki</label>
                  <input
                    id="f-url"
                    type="url"
                    placeholder="https://"
                    value={draft.url}
                    onChange={(e) => set("url", e.target.value)}
                  />
                </div>
              </div>
              <fieldset className="status">
                <legend>Tila</legend>
                <div className="scards">
                  {(["todo", "wait", "no", "int", "offer"] as Status[]).map((k) => {
                    const gain = statusXp(k);
                    return (
                      <label key={k} className="scard">
                        <input
                          type="radio"
                          name="status"
                          value={k}
                          checked={draft.status === k}
                          onChange={() => set("status", k)}
                        />
                        <i className="dot" style={{ background: STATUS[k].color }} />
                        <span className="lab">{STATUS[k].label}</span>
                        {gain > 0 && <span className="xp">+{gain}</span>}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <div className="fgrid">
                <div className={f("n", "s")}>
                  <label htmlFor="f-n">Hakijoiden määrä</label>
                  <input
                    ref={nField}
                    id="f-n"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder="ei ilmoitettu"
                    value={draft.n}
                    onChange={(e) => set("n", e.target.value)}
                  />
                </div>
                <label className="check field auto">
                  <input type="checkbox" checked={draft.nPlus} onChange={(e) => set("nPlus", e.target.checked)} />
                  <span>
                    Vähintään <span className="sr">(esim. 500+)</span>
                    <span aria-hidden="true">(500+)</span>
                  </span>
                </label>
                <div className="field" style={{ flexGrow: 3 }}>
                  <label htmlFor="f-note">Lisätieto lopputuloksesta</label>
                  <input
                    id="f-note"
                    type="text"
                    placeholder="Esim. haastattelu 3.10., palaute, sijoitus"
                    value={draft.note}
                    onChange={(e) => set("note", e.target.value)}
                  />
                </div>
              </div>
            </div>
            <Reward draft={draft} app={app} apps={apps} goal={goal} today={today} />
          </div>
          <datalist id="howList">
            {["Nettilomake", "Sähköposti", "Lomake", "Duunitori", "LinkedIn"].map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          {error && (
            <p className="ferr" role="alert">
              {error}
            </p>
          )}
          <div className="factions">
            {app && (
              <button type="button" className={`btn danger${armedDelete ? " confirm" : ""}`} onClick={() => void del()}>
                {armedDelete ? "Vahvista poisto" : "Poista"}
              </button>
            )}
            <div className="right">
              <button type="button" className="btn" onClick={onClose}>
                Peruuta
              </button>
              <SaveButton saving={saving} draft={draft} app={app} apps={apps} goal={goal} today={today} />
            </div>
          </div>
        </form>
      )}
    </dialog>
  );
}

interface PreviewProps {
  draft: Draft;
  app: Application | null;
  apps: Application[];
  goal: number;
  today: string;
}
/** Game state before and after saving the draft, to show what the save is worth. */
function usePreview({ draft, app, apps, goal, today }: PreviewProps) {
  return useMemo(() => {
    const id = app?.id ?? "__draft__";
    const next = normalize(id, { ...buildDoc(draft, app, "") }, today);
    const others = apps.filter((a) => a.id !== id);
    const before = gameState(apps, goal, today);
    const after = gameState(next.status === "todo" ? others : [...others, next], goal, today);
    return { next, before, after, gain: after.xp - before.xp };
  }, [draft, app, apps, goal, today]);
}

function SaveButton({ saving, ...p }: PreviewProps & { saving: boolean }) {
  const { gain } = usePreview(p);
  return (
    <button type="submit" className="btn primary" disabled={saving}>
      {saving ? "Tallennetaan…" : gain > 0 ? `Tallenna · +${gain} XP` : "Tallenna"}
    </button>
  );
}

/** PALKKIO: what this application is worth, the XP bar before → after and the weekly goal. */
function Reward(p: PreviewProps) {
  const { next, before, after, gain } = usePreview(p);
  const L = before.level;
  const span = L.to - L.from;
  const basePct = Math.min(100, ((before.xp - L.from) / span) * 100);
  const gainPct = Math.max(0, Math.min(100 - basePct, (gain / span) * 100));
  const parts = xpParts(next);
  const weekBonus = after.weeks.met - before.weeks.met;
  const isNew = !p.app || p.app.status === "todo";
  const todo = next.status === "todo";
  const thisWeek = isNew && !todo && weekKey(next.d) === weekKey(p.today);
  const w = before.weeks;
  const segs = Math.min(p.goal, 10);
  const left = p.goal - w.thisWeek - 1;
  const hint = todo
    ? "Haettava ilmoitus ei vielä tuo XP:tä. Se tulee, kun merkitset hakemuksen haetuksi."
    : !thisWeek
      ? null
      : left > 0
        ? `Vielä ${left} ${left === 1 ? "hakemus" : "hakemusta"}, niin viikkotavoite täyttyy (+20 XP).`
        : left === 0
          ? `Tämä hakemus täyttää viikkotavoitteen${w.current ? ` ja jatkaa putken ${w.current + 1} viikkoon` : ""}.`
          : "Viikkotavoite on jo täynnä. Hyvä tahti!";
  return (
    <aside className="reward" aria-labelledby="rewardH">
      <h3 id="rewardH">PALKKIO</h3>
      <div className="reward-grid">
        {parts.map((x) => (
          <span key={x.label} style={{ display: "contents" }}>
            <span>{x.label}</span>
            <span className="xp">+{x.xp}</span>
          </span>
        ))}
        {weekBonus > 0 && (
          <>
            <span>Viikkotavoite täynnä</span>
            <span className="xp">+{weekBonus * 20}</span>
          </>
        )}
      </div>
      <div className="divider" style={{ margin: 0 }} />
      <div className="reward-total" aria-live="polite">
        <span>{isNew ? "Yhteensä" : "Muutos"}</span>
        <span className="v">
          {gain >= 0 ? "+" : "−"}
          {Math.abs(gain)} XP
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="k">
          XP {before.xp} → {after.xp}
          {after.level.n > L.n && <span className="accent"> · TASO {after.level.n}!</span>}
        </span>
        <div className="meter" aria-hidden="true">
          <i style={{ width: `${basePct}%` }} />
          <i className="gain" style={{ width: `${gainPct}%` }} />
        </div>
      </div>
      {thisWeek && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="k">
            VKO {w.thisWeek} → {w.thisWeek + 1} / {p.goal}
          </span>
          <div className="segs fluid int" aria-hidden="true">
            {Array.from({ length: segs }, (_, i) => (
              <i key={i} className={i < w.thisWeek ? "on" : i === w.thisWeek ? "next" : undefined} />
            ))}
          </div>
        </div>
      )}
      {hint && <span className="hint">{hint}</span>}
    </aside>
  );
}

function AiFill({
  assistant,
  openByDefault,
  onResult,
}: {
  assistant: Assistant;
  openByDefault: boolean;
  onResult: (r: AdFields) => string[];
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ msg: string; err?: boolean }>({ msg: "" });
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(openByDefault);
  const ctl = useRef<AbortController | null>(null);
  useEffect(() => () => ctl.current?.abort(), []);
  if (hidden) return status.msg ? <p className="ai-status err">{status.msg}</p> : null;

  const run = async () => {
    if (!text.trim() && !file) return setStatus({ msg: "Liitä ensin ilmoituksen teksti tai kuvakaappaus.", err: true });
    ctl.current = new AbortController();
    setBusy(true);
    setStatus({ msg: "Claude lukee ilmoitusta…" });
    try {
      const got = onResult(await assistant.fillFromAd(text, file, ctl.current.signal));
      setStatus(
        got.length
          ? { msg: `Täytettiin ${got.length} kenttää: ${got.join(", ")}. Tarkista tiedot ennen tallennusta.` }
          : { msg: "Ilmoituksesta ei löytynyt uusia tietoja.", err: true },
      );
      if (got.length) setOpen(false);
    } catch (e) {
      const err =
        e instanceof UserFacingError
          ? e
          : new UserFacingError("Ilmoituksen lukeminen epäonnistui. Yritä uudelleen.", "");
      setStatus(err.message ? { msg: err.message, err: true } : { msg: "" });
      if (err.fatal) setHidden(true);
    } finally {
      setBusy(false);
      ctl.current = null;
    }
  };

  return (
    <>
      <details className="ai" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary>
          LIITÄ ILMOITUS <span>· Claude täyttää kentät puolestasi</span>
        </summary>
        <textarea
          aria-label="Työpaikkailmoituksen teksti"
          rows={3}
          placeholder="Liitä työpaikkailmoituksen teksti tähän. Claude poimii siitä työnantajan, tehtävän, määräajan ja muut tiedot."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="ai-row">
          <button type="button" className="btn sel" disabled={busy} onClick={() => void run()}>
            <span className="ptr" aria-hidden="true" />
            {busy ? "Luetaan…" : "Täytä kentät"}
          </button>
          {busy && (
            <button type="button" className="btn" onClick={() => ctl.current?.abort()}>
              Pysäytä
            </button>
          )}
          {assistant.imageTypes.length > 0 && (
            <label className="btn filebtn">
              {file ? `Kuva: ${file.name}` : "Lataa ilmoitus kuvana"}
              <input
                type="file"
                accept={assistant.imageTypes.join(",")}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
        </div>
      </details>
      {status.msg && (
        <p className={`ai-status${status.err ? " err" : ""}`} role="status">
          {status.msg}
        </p>
      )}
    </>
  );
}
