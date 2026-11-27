import { useCallback, useEffect, useState } from "react";
import { PixelIcon, type IconName } from "./Pixels";

export const VIEWS = ["tanaan", "varusteet", "loki", "tilastot"] as const;
export type View = (typeof VIEWS)[number];
const ICON: Record<View, IconName> = { tanaan: "calendar", varusteet: "shield", loki: "list", tilastot: "bars" };

const fromHash = (): View | null => {
  const hash = location.hash.slice(1) as View;
  return VIEWS.includes(hash) ? hash : null;
};

function initialView(): View {
  const hash = fromHash();
  if (hash) return hash;
  try {
    const v = localStorage.getItem("th-view") as View;
    if (VIEWS.includes(v)) return v;
  } catch {
    /* storage unavailable */
  }
  return "tanaan";
}

/**
 * The open view, kept in the address (#varusteet) so a view can be linked to and the back button returns to the
 * previous one. The last view is also remembered for the next visit without a hash.
 */
export function useView() {
  const [view, setState] = useState<View>(initialView);
  useEffect(() => {
    // The first view goes into the address too, so the back button can return to it.
    if (!fromHash()) history.replaceState(history.state, "", `${location.pathname}${location.search}#${view}`);
    const sync = () => {
      const v = fromHash();
      if (v) setState(v);
    };
    addEventListener("hashchange", sync);
    addEventListener("popstate", sync);
    return () => {
      removeEventListener("hashchange", sync);
      removeEventListener("popstate", sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the view shown on load
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("th-view", view);
    } catch {
      /* per-viewer convenience only */
    }
  }, [view]);
  const setView = useCallback((v: View) => {
    setState(v);
    if (fromHash() !== v) history.pushState(null, "", `${location.pathname}${location.search}#${v}`);
  }, []);
  return [view, setView] as const;
}

/**
 * JRPG command menu: the four views as tabs (the open one has the selected background and accent color, and is
 * aria-selected; a pixel icon beside each name), then "+ Lisää hakemus". Counts live in the views themselves.
 * A column beside the content on wide screens, a bar fixed to the bottom on phones.
 */
export function CommandMenu({
  view,
  onChange,
  total,
  onAdd,
}: {
  view: View;
  onChange: (v: View) => void;
  total: number;
  onAdd: (() => void) | null;
}) {
  const labels: Record<View, React.ReactNode> = {
    tanaan: <span className="name">Tänään</span>,
    varusteet: <span className="name">Varusteet</span>,
    loki: (
      <>
        <span className="name">Hakuloki</span>{" "}
        <span className="total" aria-label={`${total} hakemusta`}>
          {total}
        </span>
      </>
    ),
    tilastot: <span className="name">Tilastot</span>,
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
            <PixelIcon name={ICON[v]} />
            {labels[v]}
          </button>
        ))}
      </div>
      {onAdd && (
        <>
          <div className="cmd-sep" />
          <button type="button" className="cmd add" aria-label="Lisää hakemus" onClick={onAdd}>
            <PixelIcon name="plus" />
            <span className="long">Lisää hakemus</span>
            <span className="short" aria-hidden="true">
              Lisää
            </span>
          </button>
        </>
      )}
    </nav>
  );
}
