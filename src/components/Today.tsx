import { useEffect, useRef, useState } from "react";
import { fmtDate, weekday } from "../lib/dates";
import { avatarItem, BADGES, XP_RULES, type GameState } from "../lib/game";
import type { Application } from "../lib/model";
import type { Followup, WeekBucket } from "../lib/stats";
import { Avatar } from "./Avatar";
import { WeeklyChart } from "./charts/WeeklyChart";

export function GameCard({ game }: { game: GameState }) {
  const L = game.level;
  const pct = Math.min(100, Math.round(((game.xp - L.from) / (L.to - L.from)) * 100));
  const prevLevel = useRef(L.n);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    if (L.n > prevLevel.current) setBump(Date.now());
    prevLevel.current = L.n;
  }, [L.n]);
  const r = XP_RULES;
  return (
    <section className="panel">
      <div className="lvl">
        <div className={`lvl-badge${bump ? " up" : ""}`} key={bump} style={{ "--p": `${pct}%` } as React.CSSProperties}>
          <div className="av" role="img" aria-label={`Avatar tasolla ${L.n}: ${avatarItem(L.n)}`}>
            <Avatar level={L.n} />
          </div>
          <b>{L.n}</b>
        </div>
        <div>
          <div className="lvl-name">{L.name}</div>
          <div className="lvl-sub">
            {game.xp} XP · {L.to - game.xp} XP seuraavaan tasoon
          </div>
          <div className="lvl-next">
            {L.n < 8 ? `Tasolla ${L.n + 1} avautuu: ${avatarItem(L.n + 1)}` : "Kaikki varusteet avattu"}
          </div>
          <div
            className="xpbar"
            role="progressbar"
            aria-label="Seuraavaan tasoon"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <p className="xp-how">
        Hakemus {r.application} XP · räätälöity CV +{r.tailoredCv} · saatekirje +{r.coverLetter} · käsitelty ei-valinta{" "}
        {r.rejectionHandled} · haastattelu {r.interview} · tarjous {r.offer} · täysi viikko {r.fullWeek}
      </p>
    </section>
  );
}

export function StreakCard({ game, goal }: { game: GameState; goal: number }) {
  const w = game.weeks;
  return (
    <section className="panel">
      <div className={`streak${w.current > 0 ? " on" : ""}`}>
        <svg className="flame" viewBox="0 0 44 52" aria-hidden="true">
          <path d="M22 2c2 9 12 14 12 27a12 12 0 0 1-24 0c0-6 3-10 6-13 0 5 2 8 5 9-2-8 0-16 1-23z" />
        </svg>
        <div>
          <div className="streak-n">
            {w.current}
            <small>{w.current === 1 ? "viikko" : "viikkoa"} putkeen</small>
          </div>
          <div className="lvl-sub">
            {w.current
              ? `Pidä putki yllä: tällä viikolla ${w.thisWeek} / ${goal}. Paras putki ${w.best} vk.`
              : `Täytä viikkotavoite (${w.thisWeek} / ${goal}) aloittaaksesi putken. Paras putki ${w.best} vk.`}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Badges({ game, fresh }: { game: GameState; fresh: string[] }) {
  return (
    <section className="panel">
      <div className="ph">
        <h2>
          Saavutukset{" "}
          <span className="sub" style={{ fontWeight: 400 }}>
            {game.badges.length} / {BADGES.length}
          </span>
        </h2>
      </div>
      <div className="badges">
        {BADGES.map((b) => {
          const on = game.badges.includes(b.id);
          return (
            <div key={b.id} className={`bdg${on ? " on" : ""}${fresh.includes(b.id) ? " new" : ""}`} title={b.how}>
              <i aria-hidden="true">{b.icon}</i>
              <div>
                <b>{b.name}</b>
                <span>{on ? "Ansaittu" : b.how}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function FollowupList({
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
  const [busy, setBusy] = useState<string | null>(null);
  if (!due.length && !snoozed.length) return null;
  const run = async (id: string, f: () => Promise<void>) => {
    setBusy(id);
    try {
      await f();
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className="panel followup" aria-labelledby="fuTitle">
      <div className="ph">
        <h2 id="fuTitle">
          Odottaa vastausta <span className="count">{due.length}</span>
        </h2>
        <p className="sub">
          Ei kuulumisia yli 3 viikkoon hakuajan päättymisestä. Tiedustele tilannetta tai kuittaa haku. Avoimet
          hakemukset eivät ole mukana.
        </p>
      </div>
      <div className="fu-list">
        {due.length === 0 && <p className="sub">Kaikki odottavat haut on käyty läpi.</p>}
        {due.map(({ app: a, since, days }) => (
          <div className="fu-item" key={a.id}>
            <div className="fu-what">
              <div>
                <span className="org">{a.org}</span>
                {a.role && ` · ${a.role}`}
              </div>
              <div className="fu-meta">
                <span className={`days${days >= 42 ? " long" : ""}`}>{days} pv</span>
                <span>
                  {since === a.d ? "haettu" : "haku päättyi"} {fmtDate(since)}
                </span>
                {a.url && (
                  <a href={a.url} target="_blank" rel="noopener" className="link">
                    ilmoitus ↗
                  </a>
                )}
              </div>
            </div>
            {canWrite && (
              <div className="fu-actions">
                <button
                  type="button"
                  className="btn sm"
                  disabled={busy === a.id}
                  onClick={() => run(a.id, () => onReject(a))}
                >
                  Merkitse ei valituksi
                </button>
                <button
                  type="button"
                  className="btn sm"
                  disabled={busy === a.id}
                  onClick={() => run(a.id, () => onSnooze(a))}
                >
                  Muistuta 2 vk päästä
                </button>
                <button type="button" className="btn sm" onClick={() => onEdit(a)}>
                  Muokkaa
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {snoozed.length > 0 && (
        <p className="fu-snoozed">
          Siirretty myöhemmäksi: {snoozed.map(({ app }) => `${app.org} (${fmtDate(app.snoozeUntil)})`).join(", ")}
        </p>
      )}
    </section>
  );
}

export function WeeklyPanel({
  weeks,
  goal,
  game,
  today,
  canWrite,
  onGoal,
}: {
  weeks: WeekBucket[];
  goal: number;
  game: GameState;
  today: string;
  canWrite: boolean;
  onGoal: (n: number) => Promise<void>;
}) {
  const [draft, setDraft] = useState(String(goal));
  const [saving, setSaving] = useState(false);
  const [lastGoal, setLastGoal] = useState(goal);
  if (goal !== lastGoal) {
    setLastGoal(goal);
    setDraft(String(goal));
  }
  const thisWeek = game.weeks.thisWeek;
  const left = Math.max(goal - thisWeek, 0);
  const daysLeft = 7 - weekday(today);
  const past = weeks.filter((w) => !w.isNow);
  const met = past.filter((w) => w.count >= goal).length;
  let streak = 0;
  for (let i = past.length - 1; i >= 0 && past[i].count >= goal; i--) streak++;
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
  const nowWeek = weeks.find((w) => w.isNow)?.week;
  return (
    <section className="panel">
      <div className="ph">
        <h2>Hakemuksia viikoittain</h2>
        <p className="sub">
          {past.length
            ? `Tavoite saavutettu ${met} / ${past.length} päättyneellä viikolla${streak > 1 ? ` · ${streak} viikkoa putkeen` : ""}`
            : "Lähetetyt hakemukset ISO-viikoittain"}
        </p>
      </div>
      <div className="goalbox">
        <div className="goalrow">
          <span className="goalnow">
            <b>
              {thisWeek} / {goal}
            </b>{" "}
            tällä viikolla{nowWeek ? ` (vko ${nowWeek})` : ""} ·{" "}
            {left ? `${left} jäljellä, ${daysLeft} ${daysLeft === 1 ? "päivä" : "päivää"} aikaa` : "tavoite saavutettu"}
          </span>
          {canWrite && (
            <span className="goaledit">
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
          )}
        </div>
        <div
          className={`goalmeter${left ? "" : " done"}`}
          role="progressbar"
          aria-label="Tämän viikon tavoite"
          aria-valuemin={0}
          aria-valuemax={goal}
          aria-valuenow={thisWeek}
        >
          <div style={{ width: `${Math.min((thisWeek / goal) * 100, 100)}%` }} />
        </div>
      </div>
      <WeeklyChart weeks={weeks} goal={goal} />
      <div className="wlegend">
        <span>
          <i className="sw" style={{ background: "var(--accent)" }} />
          Tavoite saavutettu
        </span>
        <span>
          <i className="sw" style={{ background: "var(--bar)" }} />
          Alle tavoitteen
        </span>
        <span>
          <i className="dash" />
          Tavoite
        </span>
      </div>
    </section>
  );
}
