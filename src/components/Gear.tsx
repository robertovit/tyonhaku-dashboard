import { useState, type ReactNode } from "react";
import { weekKey, weekLabel } from "../lib/dates";
import {
  ARCHIVED_BADGES,
  avatarItem,
  badgeProgress,
  EFFORT_BADGES,
  milestoneProgress,
  type Badge,
  type GameState,
} from "../lib/game";
import { POST_ITEMS, sentText, type PostItem, type PostItemId } from "../lib/post";
import { rejectionsText, SHIELDS, type Shield, type ShieldId } from "../lib/shields";
import { Avatar } from "./Avatar";
import { PixelIcon } from "./Pixels";
import { PostIcon } from "./Post";
import { ShieldIcon } from "./Shield";

/** "Ansaittu vko 37", "Ansaittu vko 53/2026" (another year) or "Ansaittu tällä viikolla". */
const earnedText = (week: string | undefined, today: string) =>
  !week ? "Ansaittu" : week === weekKey(today) ? "Ansaittu tällä viikolla" : `Ansaittu ${weekLabel(week, today)}`;

/**
 * Varusteet: two gear slots that work the same way, the shields (from recorded rejections) and the post series
 * (from sent applications). Pick an item to preview it on the character, confirm with "Ota käyttöön" beside the
 * preview; a locked one can be previewed too and says how it is earned. Then the other effort badges and, folded
 * away, the earlier badges.
 */
export function GearView({
  game,
  fresh,
  freshShield,
  freshPost,
  weeks,
  today,
  shield,
  post,
  onShield,
  onPost,
}: {
  game: GameState;
  fresh: string[];
  freshShield: ShieldId | undefined;
  freshPost: PostItemId | undefined;
  /** The week (its Monday) each earned badge was reached, from badgeWeeks(). */
  weeks: Record<string, string>;
  today: string;
  shield: Shield | undefined;
  post: PostItem | undefined;
  onShield: (id: ShieldId | null) => void;
  onPost: (id: PostItemId | null) => void;
}) {
  const L = game.level.n;
  const { milestone, total, done } = milestoneProgress(game.total);
  return (
    <>
      <Armory
        slot="shield"
        title="Kilvet"
        sub={`${rejectionsText(game.no)} kirjattu · kilvet eivät anna XP:tä`}
        items={SHIELDS}
        count={game.no}
        worn={shield}
        fresh={freshShield}
        onEquip={onShield}
        art={(id) => <ShieldIcon id={id} />}
        avatar={(id) => <Avatar level={L} shield={id} post={post?.id} />}
        noun="kilpeä"
        need={(n) => `${n} kirjattua hylkäystä`}
        earnedAs={(it) => `Ansaittu · ${rejectionsText(it.required)}`}
        opensWhen={(it) => `${it.required} hylkäystä on kirjattu`}
        level={L}
      />
      <Armory
        slot="post"
        title="Postisarja"
        sub={
          done
            ? `Kaikki ansaittu · ${sentText(total)} lähetetty`
            : `Seuraavaksi ${POST_ITEMS.find((p) => p.milestone === milestone.id)!.name} · ${total} / ${sentText(milestone.required)}`
        }
        items={POST_ITEMS}
        count={game.total}
        worn={post}
        fresh={freshPost}
        onEquip={onPost}
        art={(id) => <PostIcon id={id} />}
        avatar={(id) => <Avatar level={L} shield={shield?.id} post={id} />}
        noun="postiesinettä"
        need={(n) => sentText(n)}
        earnedAs={(it) => earnedText(weeks[(it as PostItem).milestone], today)}
        opensWhen={(it) => `${it.required} hakemusta on lähetetty`}
        level={L}
        meter={
          !done && (
            <div
              className="meter ms-meter"
              role="progressbar"
              aria-label={`Seuraava postiesine: ${milestone.required} hakemusta`}
              aria-valuemin={0}
              aria-valuemax={milestone.required}
              aria-valuenow={total}
            >
              <i style={{ width: `${Math.min(100, (total / milestone.required) * 100)}%` }} />
            </div>
          )
        }
      />
      <BadgesPanel game={game} weeks={weeks} today={today} fresh={fresh} />
    </>
  );
}

type Item = { id: string; name: string; required: number };

/**
 * One gear slot: the character preview with "Ota käyttöön" / "Poista käytöstä" beside it, then the items as
 * radio cards (the previewed one has the lime border; the worn one a check and "Käytössä"; a locked one a lock
 * and how it is earned). The choice is stored by the item's id, never its name.
 */
function Armory<T extends Item>({
  slot,
  title,
  sub,
  items,
  count,
  worn,
  fresh,
  onEquip,
  art,
  avatar,
  noun,
  need,
  earnedAs,
  opensWhen,
  level,
  meter,
}: {
  slot: "shield" | "post";
  title: string;
  sub: string;
  items: readonly T[];
  count: number;
  worn: T | undefined;
  fresh: T["id"] | undefined;
  onEquip: (id: T["id"] | null) => void;
  art: (id: T["id"]) => ReactNode;
  avatar: (id: T["id"]) => ReactNode;
  /** "kilpeä", "postiesinettä" (partitive, for the hint) */
  noun: string;
  need: (n: number) => string;
  earnedAs: (item: T) => string;
  opensWhen: (item: T) => string;
  level: number;
  meter?: ReactNode;
}) {
  const earned = items.filter((s) => count >= s.required);
  const [previewId, setPreviewId] = useState<T["id"]>(() => fresh ?? worn?.id ?? earned.at(-1)?.id ?? items[0].id);
  const [said, setSaid] = useState("");
  const preview = items.find((s) => s.id === previewId)!;
  const open = count >= preview.required;
  const isWorn = worn?.id === preview.id;
  const h = `${slot}H`;
  const hint = !open
    ? `${preview.name} on lukittu. Se avautuu, kun ${opensWhen(preview)} (${count} / ${preview.required}).`
    : isWorn
      ? `${preview.name} on jo käytössä.`
      : `Ota käyttöön, niin hahmo kantaa ${noun} myös Tänään-näkymässä.`;
  return (
    <section className="frame" aria-labelledby={h}>
      <div className="ph">
        <h2 id={h} tabIndex={-1}>
          {title}
        </h2>
        <span className="sub">{sub}</span>
      </div>
      {meter}
      <div className="armory">
        <div className="preview">
          <div
            className="av-box"
            role="img"
            aria-label={`Esikatselu: hahmo tasolla ${level}, ${avatarItem(level)}, ${preview.name.toLowerCase()}`}
          >
            {avatar(preview.id)}
          </div>
          <div className="preview-side">
            <dl className="preview-text">
              <dt>ESIKATSELU</dt>
              <dd>
                {preview.name}
                {!open && <span className="sub"> (lukittu)</span>}
              </dd>
              <dt>KÄYTÖSSÄ</dt>
              <dd className={worn ? undefined : "sub"}>{worn ? worn.name : "Ei mitään"}</dd>
            </dl>
            <div className="armory-actions">
              <button
                type="button"
                className="btn primary"
                disabled={!open || isWorn}
                onClick={() => {
                  onEquip(preview.id);
                  setSaid(`${preview.name} otettu käyttöön.`);
                }}
              >
                Ota käyttöön
              </button>
              {worn && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setSaid(`${worn.name} poistettu käytöstä.`);
                    onEquip(null);
                  }}
                >
                  Poista käytöstä
                </button>
              )}
            </div>
          </div>
          <p className="sub armory-hint" aria-live="polite">
            {said || hint}
          </p>
        </div>
        <div className="armory-main">
          <fieldset className={`shield-cards ${slot}-cards`}>
            <legend className="sr">Valitse esikatseltava: {title.toLowerCase()}</legend>
            {items.map((s) => {
              const itemOpen = count >= s.required;
              const itemWorn = worn?.id === s.id;
              return (
                <label
                  key={s.id}
                  className={`shield-card${itemOpen ? "" : " locked"}${itemWorn ? " worn" : ""}${s.id === fresh ? " new" : ""}`}
                >
                  <input
                    type="radio"
                    name={`${slot}-preview`}
                    value={s.id}
                    checked={s.id === previewId}
                    onChange={() => {
                      setPreviewId(s.id);
                      setSaid("");
                    }}
                  />
                  <span className={slot === "shield" ? "shield-art" : "shield-art ms-art"}>
                    {art(s.id)}
                    {slot === "post" && <span className="ms-goal pix">{s.required}</span>}
                  </span>
                  <span className="name">{s.name}</span>
                  <span className="state">
                    {itemWorn ? (
                      <>
                        <PixelIcon name="check" /> Käytössä
                      </>
                    ) : itemOpen ? (
                      earnedAs(s)
                    ) : (
                      <>
                        <PixelIcon name="lock" /> {need(s.required)}
                      </>
                    )}
                  </span>
                  {!itemOpen && (
                    <span className="sub progress">
                      {Math.min(count, s.required)} / {s.required}
                    </span>
                  )}
                  {s.id === previewId && <span className="picked">Esikatselussa</span>}
                </label>
              );
            })}
          </fieldset>
        </div>
      </div>
    </section>
  );
}

/**
 * The other effort badges, then the earlier badges folded away. Pick one to see what it asks for, how far along it
 * is (the same count that unlocks it, badgeProgress) and the next step. Opens on a badge just earned, else the first
 * locked one with progress to show, else the latest earned.
 */
function BadgesPanel({
  game,
  weeks,
  today,
  fresh,
}: {
  game: GameState;
  weeks: Record<string, string>;
  today: string;
  fresh: string[];
}) {
  const earned = EFFORT_BADGES.filter((b) => game.badges.includes(b.id));
  const archived = ARCHIVED_BADGES.filter((b) => game.badges.includes(b.id));
  const latest = [...earned].sort((a, b) => (weeks[b.id] ?? "").localeCompare(weeks[a.id] ?? ""))[0]?.id;
  const nextUp = EFFORT_BADGES.find((b) => b.unit && !game.badges.includes(b.id))?.id;
  const [picked, setPicked] = useState<string | null>(null);
  const selId =
    picked ?? fresh.find((id) => EFFORT_BADGES.some((b) => b.id === id)) ?? nextUp ?? latest ?? EFFORT_BADGES[0].id;
  const sel = EFFORT_BADGES.find((b) => b.id === selId) ?? EFFORT_BADGES[0];
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
          const p = badgeProgress(b, game);
          const showProg = !p.done && b.unit;
          return (
            <button
              type="button"
              key={b.id}
              className={`item${p.done ? " on" : ""}${fresh.includes(b.id) ? " new" : ""}`}
              aria-pressed={b.id === sel.id}
              aria-label={`${b.name}, ${p.done ? "ansaittu" : `lukittu${showProg ? `, ${p.have} / ${p.need}` : ""}`}`}
              title={b.name}
              onClick={() => setPicked(b.id)}
            >
              <span aria-hidden="true">{b.icon}</span>
              {showProg && (
                <small className="prog" aria-hidden="true">
                  {p.have}/{p.need}
                </small>
              )}
            </button>
          );
        })}
      </div>
      <BadgeDetail badge={sel} game={game} week={weeks[sel.id]} today={today} isNew={fresh.includes(sel.id)} />
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
                <span className="sub">{earnedText(weeks[b.id], today)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="sub">Ei vielä aiempia merkkejä.</p>
        )}
        <p className="sub">
          Näitä merkkejä ei enää kerätä. Ansaitut säilyvät täällä. Uudet haastattelut ja tarjoukset näkyvät XP:ssä ja
          hakemuksen historiassa.
        </p>
      </details>
    </section>
  );
}

/** The picked badge: name and state (icon and text, never color alone), the condition, progress and next step. */
function BadgeDetail({
  badge: b,
  game,
  week,
  today,
  isNew,
}: {
  badge: Badge;
  game: GameState;
  week: string | undefined;
  today: string;
  isNew: boolean;
}) {
  const p = badgeProgress(b, game);
  const note = b.note?.(game, today);
  return (
    <div className="item-detail" aria-live="polite">
      <span className={`name${p.done ? " on" : ""}`}>
        {isNew && <span className="new-chip pix">UUSI</span>}
        {b.name}
      </span>
      <span className={`when ${p.done ? "accent" : "sub"}`}>
        {p.done ? (
          <>
            <PixelIcon name="check" /> {earnedText(week, today)}
          </>
        ) : (
          <>
            <PixelIcon name="lock" /> Lukittu
          </>
        )}
      </span>
      <span>{b.how}.</span>
      {b.unit && (
        <>
          {!p.done && (
            <div
              className="meter badge-meter"
              role="progressbar"
              aria-label={`${b.name}: eteneminen`}
              aria-valuemin={0}
              aria-valuemax={p.need}
              aria-valuenow={p.have}
              aria-valuetext={`${p.have} / ${b.unit(p.need)}`}
            >
              <i style={{ width: `${(p.have / p.need) * 100}%` }} />
            </div>
          )}
          <span className="pix badge-count">{p.done ? b.unit(p.count) : `${p.have} / ${b.unit(p.need)}`}</span>
        </>
      )}
      {!p.done && b.next && <span className="badge-next">{b.next(p.left)}</span>}
      {note && <span className="sub">{note}</span>}
    </div>
  );
}
