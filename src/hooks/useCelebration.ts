import { useEffect, useState } from "react";
import { celebrationWatch, type Celebration, type GameState } from "../lib/game";

/** Celebrates saves the viewer made (see celebrationWatch): call arm() right before a save. */
export function useCelebration(game: GameState | null, pending: boolean) {
  const [watch] = useState(() => celebrationWatch());
  const [current, setCurrent] = useState<(Celebration & { key: number }) | null>(null);

  useEffect(() => {
    if (!game) return;
    const c = watch.see(game, pending);
    if (c) setCurrent({ ...c, key: Date.now() });
  }, [watch, game, pending]);

  return { arm: watch.arm, celebration: current };
}
