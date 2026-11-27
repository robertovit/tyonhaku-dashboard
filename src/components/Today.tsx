import { useCallback, useEffect, useRef, useState } from "react";
import { fmtDate } from "../lib/dates";
import { avatarItem, statusGain, type GameState } from "../lib/game";
import { deadlineLabel, URGENT_DAYS, waitLabel } from "../lib/labels";
import type { Application } from "../lib/model";
import type { Shield } from "../lib/shields";
import type { Followup } from "../lib/stats";
import { Avatar } from "./Avatar";
import { PixelIcon } from "./Pixels";

export { URGENT_DAYS };

/**
 * Character sheet: avatar with the worn shield (and a link to change it in Varusteet), level, then three short
 * lines with meters: XP to the next level, this week's applications against the goal, and the streak.
 */
export function PlayerPanel({
  game,
  goal,
  canWrite,
  onGoal,
  shield,
  onShields,
}: {
  game: GameState;
  goal: number;
  canWrite: boolean;
  onGoal: (n: number) => Promise<void>;
  shield: Shield | undefined;
  onShields: () => void;
}) {
  const L = game.level;
  const pct = Math.min(100, ((game.xp - L.from) / (L.to - L.from)) * 100);
  const prevLevel = useRef(L.n);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    if (L.n > prevLevel.current) setBump(Date.now());
    prevLevel.current = L.n;
  }, [L.n]);
  const w = game.weeks;
  const segs = Math.min(8, Math.max(4, w.current + 1));
  const missing = L.to - game.xp;
  return (
    <section className="frame player" aria-labelledby="playerH">
      <div
        className={`av-box${bump ? " up" : ""}`}
        key={bump}
        role="img"
        aria-label={`Hahmo tasolla ${L.n}: ${avatarItem(L.n)}${shield ? `, ${shield.name.toLowerCase()}` : ""}`}
      >
        <Avatar level={L.n} shield={shield?.id} />
      </div>
      <div className="player-main">
        <div className="player-title">
          <h2 id="playerH">Hakija</h2>
          <span className="lvl">Tl {L.n}</span>
          <span className="sub">
            {L.name} · {game.xp} XP
          </span>
        </div>
        <p className="gear-line">
          <span className="k">KILPI</span>
          <span className={shield ? "gear-name" : "sub"}>{shield ? shield.name : "Ei käytössä"}</span>
          <a
            href="#varusteet"
            className="gear-link"
            onClick={(e) => {
              e.preventDefault();
              onShields();
            }}
          >
            {shield ? "Vaihda kilpeä" : "Katso kilvet"}
          </a>
        </p>
        <div className="stats">
          <div className="stat">
            <span className="stat-text">
              <b>{missing} XP</b> seuraavaan tasoon
            </span>
            <div
              className="meter"
              role="progressbar"
              aria-label="XP seuraavaan tasoon"
              aria-valuemin={L.from}
              aria-valuemax={L.to}
              aria-valuenow={game.xp}
              aria-valuetext={`${missing} XP seuraavaan tasoon`}
            >
              <i style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="stat">
            <span className="stat-text">
              Tällä viikolla{" "}
              <b>
                {w.thisWeek} / {goal}
              </b>{" "}
              {goal === 1 ? "hakemus" : "hakemusta"}
            </span>
            <div
              className="meter int"
              role="progressbar"
              aria-label="Viikkotavoite"
              aria-valuemin={0}
              aria-valuemax={goal}
              aria-valuenow={w.thisWeek}
              aria-valuetext={`${w.thisWeek} / ${goal} hakemusta`}
            >
              <i style={{ width: `${Math.min((w.thisWeek / goal) * 100, 100)}%` }} />
            </div>
          </div>
          <div className="stat">
            <span className="stat-text">
              Putki <b>{w.current} vk</b>
              {w.best > w.current && <span className="sub"> · paras {w.best} vk</span>}
            </span>
            <div className="segs" role="img" aria-label={`Putki ${w.current} viikkoa, paras ${w.best}`}>
              {Array.from({ length: segs }, (_, i) => (
                <i key={i} className={i < w.current ? "on" : undefined} />
              ))}
            </div>
          </div>
        </div>
        {canWrite ? <GoalInput goal={goal} onGoal={onGoal} /> : <span className="sub">Tavoite {goal} / vko</span>}
      </div>
    </section>
  );
}

function GoalInput({ goal, onGoal }: { goal: number; onGoal: (n: number) => Promise<void> }) {
  const [draft, setDraft] = useState(String(goal));
  const [saving, setSaving] = useState(false);
  const [lastGoal, setLastGoal] = useState(goal);
  if (goal !== lastGoal) {
    setLastGoal(goal);
    setDraft(String(goal));
  }
  const v = Math.round(Number(draft));
  const dirty = draft !== "" && v !== goal;
  const save = async () => {
    if (!(v >= 1 && v <= 50)) return setDraft(String(goal));
    if (v === goal) return;
    setSaving(true);
    try {
      await onGoal(v);
    } finally {
      setSaving(false);
    }
  };
  return (
    <span className="goalin">
      <label htmlFor="goalInput">Tavoite / vko</label>
      <input
        id="goalInput"
        type="number"
        min={1}
        max={50}
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void save())}
      />
      {dirty && (
        <button type="button" className="linkbtn" disabled={saving} onClick={() => void save()}>
          {saving ? "Tallennetaan…" : "Tallenna"}
        </button>
      )}
    </span>
  );
}

/** How many follow-ups the Seurattavat haut list shows before "Näytä kaikki". */
export const QUESTS_SHOWN = 3;

/**
 * Focus after a quick action that can take a row off a list: once the saved row has left, focus moves to the row
 * that took its place (or the one before, or the heading when the list is empty). Rows carry `data-row`. When
 * nothing was saved, focus stays where it is (a dialog gives it back to the button that opened it).
 */
function useRefocus(ids: string[], onMoved?: () => void) {
  const listRef = useRef<HTMLUListElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const [pending, setPending] = useState<{ id: string; order: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!pending || ids.includes(pending.id)) return;
    setPending(null);
    const row = (id: string) => listRef.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(id)}"]`);
    const i = pending.order.indexOf(pending.id);
    const next = [...pending.order.slice(i + 1), ...pending.order.slice(0, i).reverse()].map(row).find(Boolean);
    onMoved?.();
    (next ?? headRef.current)?.focus();
  }, [pending, ids, onMoved]);
  const run = async (id: string, act: () => Promise<boolean>) => {
    const order = ids;
    setBusy(true);
    const saved = await act();
    setBusy(false);
    if (saved) setPending({ id, order });
  };
  return { listRef, headRef, run, busy };
}

/**
 * Follow-ups: applications with no answer for three weeks, the longest wait first. A short list; a row opens its
 * details and actions right under it, the same on every screen size. The main action is a reminder in two weeks;
 * "Kirjaa hylkäys" opens the short status dialog with the rejection chosen, so the day it came can be set.
 */
export function QuestPanel({
  due,
  snoozed,
  canWrite,
  onReject,
  onSnooze,
  onEdit,
}: {
  due: Followup[];
  snoozed: Followup[];
  canWrite: boolean;
  /** Resolve to whether something was saved. */
  onReject: (a: Application) => Promise<boolean>;
  onSnooze: (a: Application) => Promise<boolean>;
  onEdit: (a: Application) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const ids = due.map((f) => f.app.id);
  const closeRow = useCallback(() => setOpenId(null), []);
  const { listRef, headRef, run, busy } = useRefocus(ids, closeRow);
  const shown = all ? due : due.slice(0, QUESTS_SHOWN);
  // A rejection already in the history earns nothing again.
  const gain = (a: Application) => statusGain(a, "no");
  const when = (f: Followup) => `${f.since === f.app.d ? "Haettu" : "Haku päättyi"} ${fmtDate(f.since)}`;
  return (
    <section className="frame" aria-labelledby="questH">
      <div className="ph">
        <h2 id="questH" ref={headRef} tabIndex={-1}>
          Seurattavat haut
        </h2>
        {due.length > 0 && (
          <span className="count" aria-label={`${due.length} seurattavaa`}>
            {due.length}
          </span>
        )}
        <span className="sub">Ei vastausta yli 3 viikkoon · avoimet hakemukset eivät ole mukana</span>
      </div>
      {due.length === 0 ? (
        <p className="sub">Ei seurattavia. Kaikki odottavat haut on käyty läpi.</p>
      ) : (
        <ul className="q-list" ref={listRef}>
          {shown.map((f) => {
            const open = f.app.id === openId;
            const panel = `q-${f.app.id}`;
            return (
              <li key={f.app.id} className={open ? "open" : undefined}>
                <button
                  type="button"
                  className="q-item"
                  data-row={f.app.id}
                  aria-expanded={open}
                  aria-controls={panel}
                  onClick={() => setOpenId(open ? null : f.app.id)}
                >
                  <PixelIcon name={open ? "down" : "right"} />
                  <span className="what">
                    <b>{f.app.org}</b>
                    {f.app.role && ` · ${f.app.role}`}
                  </span>
                  <span className="when-chip wait">
                    <PixelIcon name="clock" />
                    {waitLabel(f.days)}
                  </span>
                </button>
                {open && (
                  <div className="q-detail" id={panel} role="group" aria-label={`Toiminnot: ${f.app.org}`}>
                    <span className="sub">
                      {when(f)}
                      {f.app.url && (
                        <>
                          {" · "}
                          <a href={f.app.url} target="_blank" rel="noopener">
                            ilmoitus ↗
                          </a>
                        </>
                      )}
                    </span>
                    {canWrite ? (
                      <div className="q-actions">
                        <button
                          type="button"
                          className="btn sel"
                          disabled={busy}
                          onClick={() => void run(f.app.id, () => onSnooze(f.app))}
                        >
                          Muistuta 2 viikon päästä
                        </button>
                        <button
                          type="button"
                          className="btn"
                          disabled={busy}
                          onClick={() => void run(f.app.id, () => onReject(f.app))}
                        >
                          Kirjaa hylkäys {gain(f.app) > 0 && <span className="xp">+{gain(f.app)} XP</span>}
                        </button>
                        <button type="button" className="btn" onClick={() => onEdit(f.app)}>
                          Muokkaa
                        </button>
                      </div>
                    ) : (
                      <span className="sub">Vain luku</span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {due.length > QUESTS_SHOWN && (
        <button
          type="button"
          className="btn more"
          aria-expanded={all}
          onClick={() => {
            if (all && !due.slice(0, QUESTS_SHOWN).some((f) => f.app.id === openId)) setOpenId(null);
            setAll(!all);
          }}
        >
          {all ? "▲ Näytä vähemmän" : `▼ Näytä kaikki (${due.length})`}
        </button>
      )}
      {snoozed.length > 0 && (
        <p className="snoozed">
          Muistutus myöhemmin: {snoozed.map(({ app }) => `${app.org} (${fmtDate(app.snoozeUntil)})`).join(", ")}
        </p>
      )}
    </section>
  );
}

export interface TodoItem {
  app: Application;
  deadline: string | null;
  daysLeft: number | null;
}
/**
 * Saved places not applied for yet, soonest deadline first. The heading counts the deadlines that are near.
 * "Merkitse haetuksi" opens a short confirmation (send date); the XP shows after the save.
 */
export function TodoPanel({
  items,
  canWrite,
  onApply,
  onEdit,
}: {
  items: TodoItem[];
  canWrite: boolean;
  /** Resolves to whether the place was marked as applied. */
  onApply: (a: Application) => Promise<boolean>;
  onEdit: (a: Application) => void;
}) {
  const { listRef, headRef, run, busy } = useRefocus(items.map((t) => t.app.id));
  // Shown once there has been something to show, so focus has a place when the last one is marked applied.
  const [seen, setSeen] = useState(items.length > 0);
  if (items.length && !seen) setSeen(true);
  if (!seen) return null;
  const urgent = items.filter((t) => t.daysLeft != null && t.daysLeft >= 0 && t.daysLeft <= URGENT_DAYS).length;
  return (
    <section className="frame" aria-labelledby="todoH">
      <div className="ph">
        <h2 id="todoH" ref={headRef} tabIndex={-1}>
          Tallennetut paikat
        </h2>
        {urgent > 0 && (
          <span className="soon">
            <PixelIcon name="calendar" />
            {urgent} {urgent === 1 ? "päättyy" : "päättyvät"} {URGENT_DAYS} pv sisällä
          </span>
        )}
        <span className="sub">Ilmoitukset, joihin aiot hakea · määräaika ensin</span>
      </div>
      {!items.length && <p className="sub">Ei tallennettuja paikkoja. Kaikki on haettu.</p>}
      <ul className="todos" ref={listRef}>
        {items.map((t) => (
          <li key={t.app.id} className={`todo${t.daysLeft != null && t.daysLeft < 0 ? " past" : ""}`}>
            <span className="what">
              <b>{t.app.org}</b>
              {t.app.role && ` · ${t.app.role}`}
              {t.app.url && (
                <>
                  {" "}
                  <a href={t.app.url} target="_blank" rel="noopener">
                    ilmoitus ↗
                  </a>
                </>
              )}
            </span>
            <DeadlineChip item={t} />
            {canWrite && (
              <span className="todo-actions">
                <button
                  type="button"
                  className="btn sel"
                  data-row={t.app.id}
                  disabled={busy}
                  onClick={() => void run(t.app.id, () => onApply(t.app))}
                >
                  Merkitse haetuksi
                </button>
                <button type="button" className="btn" onClick={() => onEdit(t.app)}>
                  Muokkaa
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Calendar + "Haku päättyy 3 pv päästä" (the date beside it). */
function DeadlineChip({ item }: { item: TodoItem }) {
  const { text, date, tone } = deadlineLabel(item.app.end, item.deadline, item.daysLeft);
  return (
    <span className={`when-chip deadline ${tone}`}>
      <PixelIcon name="calendar" />
      <span>
        {text}
        {date && <span className="date"> · {date}</span>}
      </span>
    </span>
  );
}
