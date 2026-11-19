import { useEffect, useRef, useState } from "react";
import {
  classifyType,
  newId,
  STATUS,
  STATUS_ORDER,
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

export interface EditTarget {
  app: Application | null; // null = new application
}

export function EditDialog({
  target,
  today,
  assistant,
  onSave,
  onDelete,
  onClose,
}: {
  target: EditTarget | null;
  today: string;
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
      setDraft(fromApp(target.app, today));
      setFilled(new Set());
      setError("");
      setArmedDelete(false);
      setTypeTouched(!!target.app);
      d.showModal();
      setTimeout(() => (target.app ? nField.current : firstField.current)?.focus(), 0);
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
    const now = new Date().toISOString();
    const doc: ApplicationDoc = toDoc({
      schema: SCHEMA,
      d: draft.d,
      org,
      role: draft.role.trim(),
      end: draft.end.trim(),
      how: draft.how.trim(),
      att: draft.att.trim(),
      cv: draft.cv.trim(),
      note: draft.note.trim(),
      url,
      status: draft.status,
      type: draft.type,
      n,
      nPlus: draft.nPlus,
      createdAt: app?.createdAt || now,
      updatedAt: now,
      snoozeUntil: app?.snoozeUntil ?? "",
    });
    setSaving(true);
    setError("");
    try {
      await onSave(app?.id ?? newId(draft.d, org, doc.role), doc);
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

  const f = (k: string) => `field${filled.has(k) ? " filled" : ""}`;
  return (
    <dialog ref={ref} aria-labelledby="dlgTitle" onClose={onClose} onCancel={onClose}>
      {target && (
        <form onSubmit={submit} noValidate>
          <h2 id="dlgTitle">{app ? `${app.org}${app.role ? ` · ${app.role}` : ""}` : "Uusi hakemus"}</h2>
          {assistant && <AiFill key={app?.id ?? "new"} assistant={assistant} openByDefault={!app} onResult={applyAd} />}
          <div className="field">
            <span className="lbl">Tila</span>
            <div className="seg" role="radiogroup" aria-label="Tila">
              {STATUS_ORDER.map((k) => (
                <label key={k}>
                  <input
                    type="radio"
                    name="status"
                    value={k}
                    checked={draft.status === k}
                    onChange={() => set("status", k)}
                  />
                  <i style={{ background: STATUS[k].color }} />
                  {STATUS[k].label}
                </label>
              ))}
            </div>
          </div>
          <div className="fgrid">
            <div className={f("n")}>
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
            <div className="field" style={{ alignContent: "end" }}>
              <label className="check">
                <input type="checkbox" checked={draft.nPlus} onChange={(e) => set("nPlus", e.target.checked)} />{" "}
                Vähintään (esim. 500+)
              </label>
            </div>
            <div className="field full">
              <label htmlFor="f-note">Lisätieto lopputuloksesta</label>
              <textarea
                id="f-note"
                rows={2}
                placeholder="Esim. haastattelu 3.10., palaute, sijoitus"
                value={draft.note}
                onChange={(e) => set("note", e.target.value)}
              />
            </div>
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
            <div className="field">
              <label htmlFor="f-d">Haettu</label>
              <input id="f-d" type="date" value={draft.d} onChange={(e) => set("d", e.target.value)} />
            </div>
            <div className={f("end")}>
              <label htmlFor="f-end">Haku päättyy</label>
              <input
                id="f-end"
                type="text"
                placeholder="esim. 31.10. tai jatkuva haku"
                value={draft.end}
                onChange={(e) => set("end", e.target.value)}
              />
            </div>
            <div className={f("type")}>
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
            <div className={f("how")}>
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
            <div className={f("att")}>
              <label htmlFor="f-att">Liitteet</label>
              <input
                id="f-att"
                type="text"
                placeholder="CV, saatekirje"
                value={draft.att}
                onChange={(e) => set("att", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="f-cv">CV-versio</label>
              <input id="f-cv" type="text" value={draft.cv} onChange={(e) => set("cv", e.target.value)} />
            </div>
            <div className={`${f("url")} full`}>
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
          <datalist id="howList">
            {["Nettilomake", "Sähköposti", "Lomake", "Duunitori", "LinkedIn"].map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          {error && <p className="ferr">{error}</p>}
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
              <button type="submit" className="btn primary" disabled={saving}>
                {saving ? "Tallennetaan…" : "Tallenna"}
              </button>
            </div>
          </div>
        </form>
      )}
    </dialog>
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
        <summary>Täytä ilmoituksesta</summary>
        <textarea
          aria-label="Työpaikkailmoituksen teksti"
          placeholder="Liitä työpaikkailmoituksen teksti tähän. Claude poimii siitä työnantajan, tehtävän, määräajan ja muut tiedot."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="ai-row">
          <button type="button" className="btn sm primary" disabled={busy} onClick={() => void run()}>
            {busy ? "Luetaan…" : "Täytä kentät"}
          </button>
          {busy && (
            <button type="button" className="btn sm" onClick={() => ctl.current?.abort()}>
              Pysäytä
            </button>
          )}
          {assistant.imageTypes.length > 0 && (
            <label className="ai-file">
              tai kuvakaappaus:{" "}
              <input
                type="file"
                accept={assistant.imageTypes.join(",")}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
        </div>
      </details>
      {status.msg && <p className={`ai-status${status.err ? " err" : ""}`}>{status.msg}</p>}
    </>
  );
}
