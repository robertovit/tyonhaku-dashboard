import { useState } from "react";
import {
  APP_MILESTONES,
  ARCHIVED_BADGES,
  avatarItem,
  EFFORT_BADGES,
  milestoneProgress,
  type GameState,
} from "../lib/game";
import { rejectionsText, SHIELDS, type Shield, type ShieldId } from "../lib/shields";
import { Avatar } from "./Avatar";
import { MilestoneItem, PixelIcon } from "./Pixels";
import { ShieldIcon } from "./Shield";

const earnedText = (week: number | undefined) => (week ? `Ansaittu vko ${week}` : "Ansaittu");

/**
 * Varusteet: the character preview and the three shields (pick one to preview, confirm with one shared
 * "Ota käyttöön"), then the application milestones, the other effort badges and, folded away, the earlier badges.
 */
export function GearView({
  game,
  fresh,
  freshShield,
  weeks,
  shield,
  onEquip,
}: {
  game: GameState;
  fresh: string[];
  freshShield: ShieldId | undefined;
  weeks: Record<string, number>;
  shield: Shield | undefined;
  onEquip: (id: ShieldId | null) => void;
}) {
  return (
    <>
      <ShieldsPanel game={game} freshShield={freshShield} shield={shield} onEquip={onEquip} />
      <MilestonesPanel game={game} weeks={weeks} fresh={fresh} />
      <BadgesPanel game={game} weeks={weeks} fresh={fresh} />
    </>
  );
}

function ShieldsPanel({
  game,
  freshShield,
  shield,
  onEquip,
}: {
  game: GameState;
  freshShield: ShieldId | undefined;
  shield: Shield | undefined;
  onEquip: (id: ShieldId | null) => void;
}) {
  const earned = SHIELDS.filter((s) => game.no >= s.required);
  const [previewId, setPreviewId] = useState<ShieldId>(
    () => freshShield ?? shield?.id ?? earned.at(-1)?.id ?? SHIELDS[0].id,
  );
  const [said, setSaid] = useState("");
  const preview = SHIELDS.find((s) => s.id === previewId)!;
  const open = game.no >= preview.required;
  const worn = shield?.id === preview.id;
  const L = game.level;
  const hint = !open
    ? `${preview.name} on lukittu. Se avautuu, kun ${preview.required} hylkäystä on kirjattu (${game.no} / ${preview.required}).`
    : worn
      ? `${preview.name} on jo käytössä.`
      : `Ota käyttöön, niin hahmo kantaa kilpeä myös Tänään-näkymässä.`;
  return (
    <section className="frame" aria-labelledby="shieldsH">
      <div className="ph">
        <h2 id="shieldsH" tabIndex={-1}>
          Kilvet
        </h2>
        <span className="sub">{rejectionsText(game.no)} kirjattu · kilvet eivät anna XP:tä</span>
      </div>
      <div className="armory">
        <div className="preview">
          <div
            className="av-box"
            role="img"
            aria-label={`Esikatselu: hahmo tasolla ${L.n}, ${avatarItem(L.n)}, ${preview.name.toLowerCase()}`}
          >
            <Avatar level={L.n} shield={preview.id} />
          </div>
          <dl className="preview-text">
            <dt>ESIKATSELU</dt>
            <dd>
              {preview.name}
              {!open && <span className="sub"> (lukittu)</span>}
            </dd>
            <dt>KÄYTÖSSÄ</dt>
            <dd className={shield ? undefined : "sub"}>{shield ? shield.name : "Ei kilpeä"}</dd>
          </dl>
        </div>
        <div className="armory-main">
          <fieldset className="shield-cards">
            <legend className="sr">Valitse esikatseltava kilpi</legend>
            {SHIELDS.map((s) => {
              const isOpen = game.no >= s.required;
              const isWorn = shield?.id === s.id;
              return (
                <label
                  key={s.id}
                  className={`shield-card${isOpen ? "" : " locked"}${isWorn ? " worn" : ""}${s.id === freshShield ? " new" : ""}`}
                >
                  <input
                    type="radio"
                    name="shield-preview"
                    value={s.id}
                    checked={s.id === previewId}
                    onChange={() => {
                      setPreviewId(s.id);
                      setSaid("");
                    }}
                  />
                  <span className="shield-art">
                    <ShieldIcon id={s.id} />
                  </span>
                  <span className="name">{s.name}</span>
                  <span className="state">
                    {isWorn ? (
                      <>
                        <PixelIcon name="check" /> Käytössä
                      </>
                    ) : isOpen ? (
                      `Ansaittu · ${rejectionsText(s.required)}`
                    ) : (
                      <>
                        <PixelIcon name="lock" /> {s.required} kirjattua hylkäystä
                      </>
                    )}
                  </span>
                  {!isOpen && (
                    <span className="sub progress">
                      {game.no} / {s.required}
                    </span>
                  )}
                  {s.id === previewId && <span className="picked">▶ Esikatselussa</span>}
                </label>
              );
            })}
          </fieldset>
          <div className="armory-actions">
            <button
              type="button"
              className="btn primary"
              disabled={!open || worn}
              onClick={() => {
                onEquip(preview.id);
                setSaid(`${preview.name} otettu käyttöön.`);
              }}
            >
              Ota käyttöön
            </button>
            {shield && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setSaid(`${shield.name} poistettu käytöstä.`);
                  onEquip(null);
                }}
              >
                Poista käytöstä
              </button>
            )}
          </div>
          <p className="sub armory-hint" aria-live="polite">
            {said || hint}
          </p>
        </div>
      </div>
    </section>
  );
}

function MilestonesPanel({ game, weeks, fresh }: { game: GameState; weeks: Record<string, number>; fresh: string[] }) {
  const { milestone, total, done } = milestoneProgress(game.total);
  return (
    <section className="frame" aria-labelledby="milestonesH">
      <div className="ph">
        <h2 id="milestonesH">Hakemusetapit</h2>
        <span className="pix sub ms-progress">
          {done
            ? `${milestone.name} saavutettu · ${total} hakemusta`
            : `${milestone.name === `${milestone.required} hakemusta` ? "Seuraavaksi" : milestone.name} · ${total} / ${milestone.required} hakemusta`}
        </span>
      </div>
      {!done && (
        <div
          className="meter ms-meter"
          role="progressbar"
          aria-label={`Seuraava etappi: ${milestone.name}`}
          aria-valuemin={0}
          aria-valuemax={milestone.required}
          aria-valuenow={total}
        >
          <i style={{ width: `${Math.min(100, (total / milestone.required) * 100)}%` }} />
        </div>
      )}
      <ul className="milestones">
        {APP_MILESTONES.map((m) => {
          const on = game.badges.includes(m.id);
          return (
            <li key={m.id} className={`${on ? "on" : "locked"}${fresh.includes(m.id) ? " new" : ""}`}>
              <span className="ms-art">
                <MilestoneItem id={m.id} />
                <span className="ms-goal pix">{m.required}</span>
              </span>
              <span className="name">{m.name}</span>
              <span className="state">
                {on ? (
                  <>
                    <PixelIcon name="check" /> {earnedText(weeks[m.id])}
                  </>
                ) : (
                  <>
                    <PixelIcon name="lock" /> Lukittu · {Math.min(total, m.required)} / {m.required}
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The other effort badges (pick one to see how it is earned), then the earlier badges folded away. */
function BadgesPanel({ game, weeks, fresh }: { game: GameState; weeks: Record<string, number>; fresh: string[] }) {
  const earned = EFFORT_BADGES.filter((b) => game.badges.includes(b.id));
  const archived = ARCHIVED_BADGES.filter((b) => game.badges.includes(b.id));
  const latest = [...earned].sort((a, b) => (weeks[b.id] ?? 0) - (weeks[a.id] ?? 0))[0]?.id;
  const [picked, setPicked] = useState<string | null>(null);
  const selId = picked ?? fresh.find((id) => EFFORT_BADGES.some((b) => b.id === id)) ?? latest ?? EFFORT_BADGES[0].id;
  const sel = EFFORT_BADGES.find((b) => b.id === selId) ?? EFFORT_BADGES[0];
  const selOn = game.badges.includes(sel.id);
  return (
    <section className="frame" aria-labelledby="badgesH">
      <div className="ph">
        <h2 id="badgesH">Merkit</h2>
        <span className="sub">
          {earned.length} / {EFFORT_BADGES.length} ansaittu muusta työnhausta
        </span>
      </div>
      <div className="items" role="group" aria-label="Merkit">
        {EFFORT_BADGES.map((b) => {
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
          {selOn ? (
            <>
              <PixelIcon name="check" /> {earnedText(weeks[sel.id])}
            </>
          ) : (
            <>
              <PixelIcon name="lock" /> Lukittu
            </>
          )}
        </span>
      </div>
      <details className="earlier">
        <summary>
          Aiemmat merkit <span className="sub">({archived.length})</span>
        </summary>
        {archived.length ? (
          <ul>
            {archived.map((b) => (
              <li key={b.id}>
                <span className="item on" aria-hidden="true">
                  {b.icon}
                </span>
                <span className="name">{b.name}</span>
                <span className="sub">{earnedText(weeks[b.id])}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="sub">Ei vielä aiempia merkkejä.</p>
        )}
        <p className="sub">Uudet haastattelut ja tarjoukset näkyvät XP:ssä ja hakemuksen historiassa.</p>
      </details>
    </section>
  );
}
