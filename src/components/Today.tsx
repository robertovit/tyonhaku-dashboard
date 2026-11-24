import { useEffect, useRef, useState } from "react";
import { fmtDate } from "../lib/dates";
import { avatarItem, BADGES, XP_RULES, type GameState } from "../lib/game";
import type { Application } from "../lib/model";
import type { Followup, WeekBucket } from "../lib/stats";
import { Avatar } from "./Avatar";
import { WeeklyChart } from "./charts/WeeklyChart";

/** Character sheet: avatar, level, XP / week / streak meters, and what the next level brings. */
export function PlayerPanel({
  game,
  goal,
  avgXp,
  canWrite,
  onGoal,
}: {
  game: GameState;
  goal: number;
  avgXp: number;
  canWrite: boolean;
  onGoal: (n: number) => Promise<void>;
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
        aria-label={`Hahmo tasolla ${L.n}: ${avatarItem(L.n)}`}
      >
        <Avatar level={L.n} />
      </div>
      <div className="player-main">
        <div className="player-title">
          <h2 id="playerH">Hakija</h2>
          <span className="lvl">Tl {L.n}</span>
          <span className="sub">{L.name}</span>
        </div>
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

/** Follow-ups as quests: pick one from the list, act on it from the menu beside (or under it on phones). */
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
  onReject: (a: Application) => Promise<void>;
  onSnooze: (a: Application) => Promise<void>;
  onEdit: (a: Application) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sel = due.find((f) => f.app.id === picked) ?? due[0];
  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    try {
      await f();
    } finally {
      setBusy(false);
    }
  };
  const when = (f: Followup) => `${f.since === f.app.d ? "haettu" : "haku päättyi"} ${fmtDate(f.since)}`;
  const actions = (f: Followup, inline: boolean) =>
    inline ? (
      <div className="q-inline">
        <span className="sub">{when(f)}</span>
        {canWrite && (
          <>
            <button type="button" className="btn sel" disabled={busy} onClick={() => run(() => onReject(f.app))}>
              Kuittaa ei valituksi <span className="xp">+{XP_RULES.rejectionHandled} XP</span>
            </button>
            <div className="pair">
              <button type="button" className="btn" disabled={busy} onClick={() => run(() => onSnooze(f.app))}>
                Muistuta 2 vk
              </button>
              <button type="button" className="btn" onClick={() => onEdit(f.app)}>
                Muokkaa
              </button>
            </div>
          </>
        )}
      </div>
    ) : (
      <div className="q-side" aria-label={`Toiminnot: ${f.app.org}`} role="group">
        <span className="meta">
          {f.app.org} · {when(f)}
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
          <>
            <button type="button" className="menu-btn" disabled={busy} onClick={() => run(() => onReject(f.app))}>
              Kuittaa ei valituksi <span className="xp">+{XP_RULES.rejectionHandled} XP</span>
            </button>
            <button type="button" className="menu-btn" disabled={busy} onClick={() => run(() => onSnooze(f.app))}>
              Muistuta 2 vk päästä
            </button>
            <button type="button" className="menu-btn" onClick={() => onEdit(f.app)}>
              Muokkaa
            </button>
          </>
        ) : (
          <span className="sub">Vain luku</span>
        )}
      </div>
    );
  return (
    <section className="frame" aria-labelledby="questH">
      <div className="ph">
        <h2 id="questH">Tehtävät</h2>
        {due.length > 0 && <span className="count">{due.length}</span>}
        <span className="sub">Odottaa vastausta yli 3 viikkoa · avoimet hakemukset eivät ole mukana</span>
      </div>
      {due.length === 0 ? (
        <p className="sub">Ei tehtäviä. Kaikki odottavat haut on käyty läpi.</p>
      ) : (
        <div className="quests">
          <div className="q-list">
            {due.map((f) => {
              const on = f === sel;
              return (
                <div key={f.app.id}>
                  <button type="button" className="q-item" aria-pressed={on} onClick={() => setPicked(f.app.id)}>
                    <span className="what">
                      <b>{f.app.org}</b>
                      {f.app.role && ` · ${f.app.role}`}
                    </span>
                    <span className="q-days">{f.days} PV</span>
                  </button>
                  {on && actions(f, true)}
                </div>
              );
            })}
          </div>
          {sel && actions(sel, false)}
        </div>
      )}
      {snoozed.length > 0 && (
        <p className="snoozed">
          Siirretty myöhemmäksi: {snoozed.map(({ app }) => `${app.org} (${fmtDate(app.snoozeUntil)})`).join(", ")}
        </p>
      )}
    </section>
  );
}

/** Badges as inventory items; selecting one shows what it is and when it was earned. */
export function ItemsPanel({
  game,
  fresh,
  weeks,
}: {
  game: GameState;
  fresh: string[];
  weeks: Record<string, number>;
}) {
  const latest = [...game.badges].sort((a, b) => (weeks[b] ?? 0) - (weeks[a] ?? 0))[0];
  const [picked, setPicked] = useState<string | null>(null);
  const selId = picked ?? fresh[0] ?? latest ?? BADGES[0].id;
  const sel = BADGES.find((b) => b.id === selId)!;
  const selOn = game.badges.includes(sel.id);
  return (
    <section className="frame" aria-labelledby="itemsH">
      <div className="ph">
        <h2 id="itemsH">Esineet</h2>
        <span className="pix sub" style={{ fontSize: 18 }}>
          {game.badges.length} / {BADGES.length}
        </span>
      </div>
      <div className="items">
        {BADGES.map((b) => {
          const on = game.badges.includes(b.id);
          return (
            <button
              type="button"
              key={b.id}
              className={`item${on ? " on" : ""}${fresh.includes(b.id) ? " new" : ""}`}
              aria-pressed={b.id === sel.id}
              aria-label={`${b.name}, ${on ? "ansaittu" : "lukittu"}`}
              title={b.name}
              onClick={() => setPicked(b.id)}
            >
              {b.icon}
            </button>
          );
        })}
      </div>
      <div className="item-detail" aria-live="polite">
        <span className={`name${selOn ? " on" : ""}`}>{sel.name}</span>
        <span>{sel.how}.</span>
        <span className={`when ${selOn ? "accent" : "sub"}`}>
          {selOn ? (weeks[sel.id] ? `Ansaittu vko ${weeks[sel.id]}` : "Ansaittu") : "Lukittu"}
        </span>
      </div>
    </section>
  );
}

export function WeeksPanel({ weeks, goal }: { weeks: WeekBucket[]; goal: number }) {
  const past = weeks.filter((w) => !w.isNow);
  const met = past.filter((w) => w.count >= goal).length;
  return (
    <section className="frame" aria-labelledby="weeksH">
      <div className="ph">
        <h2 id="weeksH">Viikot</h2>
        <span className="sub">
          {past.length ? `tavoite saavutettu ${met} / ${past.length}` : "hakemukset ISO-viikoittain"}
        </span>
      </div>
      <WeeklyChart weeks={weeks} goal={goal} />
      <div className="legend small">
        <span>
          <i className="sw" style={{ background: "var(--accent)" }} />
          Tavoite
        </span>
        <span>
          <i className="sw" style={{ background: "var(--bar-muted)" }} />
          Alle tavoitteen
        </span>
        <span>
          <i className="sw dash" />
          {goal} / vko
        </span>
      </div>
    </section>
  );
}
