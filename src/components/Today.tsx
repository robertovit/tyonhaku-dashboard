import { useEffect, useRef, useState } from "react";
import { fmtDate } from "../lib/dates";
import { avatarItem, statusGain, XP_RULES, type GameState } from "../lib/game";
import { deadlineLabel, URGENT_DAYS, waitLabel } from "../lib/labels";
import type { Application } from "../lib/model";
import type { Shield } from "../lib/shields";
import type { Followup } from "../lib/stats";
import { Avatar } from "./Avatar";
import { PixelIcon } from "./Pixels";

export { URGENT_DAYS };

/**
 * Character sheet: avatar with the worn shield (and a link to change it in Varusteet), level, XP / week / streak
 * meters, and what the next level brings.
 */
export function PlayerPanel({
  game,
  goal,
  avgXp,
  canWrite,
  onGoal,
  shield,
  onShields,
}: {
  game: GameState;
  goal: number;
  avgXp: number;
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
  const apps = Math.max(1, Math.ceil(missing / Math.max(avgXp, 1)));
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
          <span className="sub">{L.name}</span>
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
        <div className="stat-grid">
          <span className="k">XP</span>
          <div
            className="meter"
            role="progressbar"
            aria-label="Seuraavaan tasoon"
            aria-valuemin={L.from}
            aria-valuemax={L.to}
            aria-valuenow={game.xp}
          >
            <i style={{ width: `${pct}%` }} />
          </div>
          <span>
            {game.xp}
            <span className="of"> / {L.to}</span>
          </span>
          <span className="k">VKO</span>
          <div
            className="meter int"
            role="progressbar"
            aria-label="Viikkotavoite"
            aria-valuemin={0}
            aria-valuemax={goal}
            aria-valuenow={w.thisWeek}
          >
            <i style={{ width: `${Math.min((w.thisWeek / goal) * 100, 100)}%` }} />
          </div>
          <span>
            {w.thisWeek}
            <span className="of"> / {goal}</span>
          </span>
          <span className="k">PUTKI</span>
          <div className="segs" role="img" aria-label={`Putki ${w.current} viikkoa, paras ${w.best}`}>
            {Array.from({ length: segs }, (_, i) => (
              <i key={i} className={i < w.current ? "on" : undefined} />
            ))}
          </div>
          <span>{w.current} vk</span>
        </div>
      </div>
      <div className="nextbox">
        <span className="k">SEURAAVA TASO</span>
        <span>
          {L.n < 8 ? (
            <>
              Tl {L.n + 1} avaa <b>{avatarItem(L.n + 1)}</b>
            </>
          ) : (
            <>
              Tl {L.n + 1}: <b>Työnhaun legenda</b>
            </>
          )}
        </span>
        <span className="sub">
          {missing} XP puuttuu · noin {apps} {apps === 1 ? "hakemus" : "hakemusta"}
        </span>
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

/** How many follow-ups the Tehtävät list shows before "Näytä kaikki". */
export const QUESTS_SHOWN = 3;

/**
 * Follow-ups as quests: a short list (the oldest first); a row opens its details and quick actions right under
 * it, the same on every screen size. When an action takes the row off the list, focus moves to the row that took
 * its place (or the one before, or the heading when the list is empty).
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
  /** Resolve to whether the save went through. */
  onReject: (a: Application) => Promise<boolean>;
  onSnooze: (a: Application) => Promise<boolean>;
  onEdit: (a: Application) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refocus, setRefocus] = useState<{ id: string; order: string[]; saved: boolean } | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const shown = all ? due : due.slice(0, QUESTS_SHOWN);
  useEffect(() => {
    if (!refocus) return;
    const row = (id: string) => listRef.current?.querySelector<HTMLButtonElement>(`[data-quest="${CSS.escape(id)}"]`);
    // a failed save was rolled back: the row stays open and keeps the focus
    if (!refocus.saved) {
      setRefocus(null);
      return void row(refocus.id)?.focus();
    }
    // saved: move on once the row has left the list
    if (due.some((f) => f.app.id === refocus.id)) return;
    setRefocus(null);
    const i = refocus.order.indexOf(refocus.id);
    const next = [...refocus.order.slice(i + 1), ...refocus.order.slice(0, i).reverse()].map(row).find(Boolean);
    setOpenId(null);
    (next ?? headRef.current)?.focus();
  }, [refocus, due]);
  const run = async (f: Followup, act: () => Promise<boolean>) => {
    const order = due.map((x) => x.app.id);
    setBusy(true);
    const saved = await act();
    setBusy(false);
    setRefocus({ id: f.app.id, order, saved });
  };
  // A rejection already in the history earns nothing again.
  const gain = (a: Application) => statusGain(a, "no");
  const when = (f: Followup) => `${f.since === f.app.d ? "Haettu" : "Haku päättyi"} ${fmtDate(f.since)}`;
  return (
    <section className="frame" aria-labelledby="questH">
      <div className="ph">
        <h2 id="questH" ref={headRef} tabIndex={-1}>
          Tehtävät
        </h2>
        {due.length > 0 && <span className="count">{due.length}</span>}
        <span className="sub">Odottaa vastausta yli 3 viikkoa · avoimet hakemukset eivät ole mukana</span>
      </div>
      {due.length === 0 ? (
        <p className="sub">Ei tehtäviä. Kaikki odottavat haut on käyty läpi.</p>
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
                  data-quest={f.app.id}
                  aria-expanded={open}
                  aria-controls={panel}
                  onClick={() => setOpenId(open ? null : f.app.id)}
                >
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
                          onClick={() => run(f, () => onReject(f.app))}
                        >
                          Kuittaa ei valituksi {gain(f.app) > 0 && <span className="xp">+{gain(f.app)} XP</span>}
                        </button>
                        <button
                          type="button"
                          className="btn"
                          disabled={busy}
                          onClick={() => run(f, () => onSnooze(f.app))}
                        >
                          Muistuta 2 vk päästä
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
          Siirretty myöhemmäksi: {snoozed.map(({ app }) => `${app.org} (${fmtDate(app.snoozeUntil)})`).join(", ")}
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
/** Saved ads not applied for yet, soonest deadline first. */
export function TodoPanel({
  items,
  canWrite,
  onApply,
  onEdit,
}: {
  items: TodoItem[];
  canWrite: boolean;
  onApply: (a: Application) => void;
  onEdit: (a: Application) => void;
}) {
  if (!items.length) return null;
  const urgent = items.filter((t) => t.daysLeft != null && t.daysLeft >= 0 && t.daysLeft <= URGENT_DAYS).length;
  return (
    <section className="frame" aria-labelledby="todoH">
      <div className="ph">
        <h2 id="todoH">Haettavat</h2>
        {urgent > 0 && <span className="count">{urgent}</span>}
        <span className="sub">Talteen otetut ilmoitukset, määräaika ensin</span>
      </div>
      <ul className="todos">
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
                <button type="button" className="btn sel" onClick={() => onApply(t.app)}>
                  Merkitse haetuksi <span className="xp">+{XP_RULES.application} XP</span>
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
