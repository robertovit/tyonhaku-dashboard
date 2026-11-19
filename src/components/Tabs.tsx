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

export function Tabs({
  view,
  onChange,
  followupCount,
  total,
}: {
  view: View;
  onChange: (v: View) => void;
  followupCount: number;
  total: number;
}) {
  const labels: Record<View, React.ReactNode> = {
    tanaan: (
      <>
        Tänään
        {followupCount > 0 && (
          <span className="tcount" aria-label={`${followupCount} odottaa vastausta`}>
            {followupCount}
          </span>
        )}
      </>
    ),
    tilastot: "Tilastot",
    loki: (
      <>
        Hakuloki <span className="tcount muted">{total}</span>
      </>
    ),
  };
  const onKey = (e: React.KeyboardEvent) => {
    const i = VIEWS.indexOf(view);
    const next =
      e.key === "ArrowRight"
        ? VIEWS[(i + 1) % VIEWS.length]
        : e.key === "ArrowLeft"
          ? VIEWS[(i + VIEWS.length - 1) % VIEWS.length]
          : e.key === "Home"
            ? VIEWS[0]
            : e.key === "End"
              ? VIEWS[VIEWS.length - 1]
              : null;
    if (!next) return;
    e.preventDefault();
    onChange(next);
    document.getElementById(`tab-${next}`)?.focus();
  };
  return (
    <nav className="tabs" role="tablist" aria-label="Näkymät" onKeyDown={onKey}>
      {VIEWS.map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          id={`tab-${v}`}
          aria-controls={`view-${v}`}
          aria-selected={view === v}
          tabIndex={view === v ? 0 : -1}
          onClick={() => onChange(v)}
        >
          {labels[v]}
        </button>
      ))}
    </nav>
  );
}
