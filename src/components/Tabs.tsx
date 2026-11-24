import { useEffect, useState } from "react";

export const VIEWS = ["tanaan", "tilastot", "loki"] as const;
export type View = (typeof VIEWS)[number];

function initialView(): View {
  const hash = location.hash.slice(1) as View;
  if (VIEWS.includes(hash)) return hash;
  try {
    const v = localStorage.getItem("th-view") as View;
    if (VIEWS.includes(v)) return v;
  } catch {
    /* storage unavailable */
  }
  return "tanaan";
}

export function useView() {
  const [view, setView] = useState<View>(initialView);
  useEffect(() => {
    try {
      localStorage.setItem("th-view", view);
    } catch {
      /* per-viewer convenience only */
    }
  }, [view]);
  return [view, setView] as const;
}

/**
 * JRPG command menu: the three views as tabs (▶ marks the open one), then the actions.
 * A column beside the content on wide screens, a bar fixed to the bottom on phones.
 */
export function CommandMenu({
  view,
  onChange,
  followupCount,
  total,
  onAdd,
  onCsv,
}: {
  view: View;
  onChange: (v: View) => void;
  followupCount: number;
  total: number;
  onAdd: (() => void) | null;
  onCsv: (() => void) | null;
}) {
  const labels: Record<View, React.ReactNode> = {
    tanaan: (
      <>
        Tänään
        {followupCount > 0 && (
          <span className="tcount count" aria-label={`${followupCount} odottaa vastausta`}>
            {followupCount}
          </span>
        )}
      </>
    ),
    tilastot: "Tilastot",
    loki: (
      <>
        Hakuloki <span className="total">{total}</span>
      </>
    ),
  };
  const onKey = (e: React.KeyboardEvent) => {
    const i = VIEWS.indexOf(view);
    const k = e.key;
    const next =
      k === "ArrowDown" || k === "ArrowRight"
        ? VIEWS[(i + 1) % VIEWS.length]
        : k === "ArrowUp" || k === "ArrowLeft"
          ? VIEWS[(i + VIEWS.length - 1) % VIEWS.length]
          : k === "Home"
            ? VIEWS[0]
            : k === "End"
              ? VIEWS[VIEWS.length - 1]
              : null;
    if (!next) return;
    e.preventDefault();
    onChange(next);
    document.getElementById(`tab-${next}`)?.focus();
  };
  return (
    <nav className="frame cmdnav" aria-label="Komennot">
      <div className="cmdtabs" role="tablist" aria-label="Näkymät" aria-orientation="vertical" onKeyDown={onKey}>
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            className="cmd"
            id={`tab-${v}`}
            aria-controls={`view-${v}`}
            aria-selected={view === v}
            tabIndex={view === v ? 0 : -1}
            onClick={() => onChange(v)}
          >
            {labels[v]}
          </button>
        ))}
      </div>
      {(onAdd || onCsv) && <div className="cmd-sep" />}
      {onAdd && (
        <button type="button" className="cmd add" aria-label="Lisää hakemus" onClick={onAdd}>
          <span className="long">+ Lisää hakemus</span>
          <span className="short" aria-hidden="true">
            + Lisää
          </span>
        </button>
      )}
      {onCsv && (
        <button type="button" className="cmd csv" onClick={onCsv}>
          Lataa CSV
        </button>
      )}
    </nav>
  );
}
