import { useCallback, useEffect, useRef, useState } from "react";
import { celebrationFor, type Celebration, type GameState } from "../lib/game";

const ARM_WINDOW_MS = 8000;

/**
 * Celebrates only changes the viewer caused: call arm() right before a save; the next
 * game-state change within a few seconds is compared with the previous one.
 */
export function useCelebration(game: GameState | null) {
  const prev = useRef<GameState | null>(null);
  const armedAt = useRef(0);
  const [current, setCurrent] = useState<(Celebration & { key: number }) | null>(null);

  useEffect(() => {
    if (!game) return;
    const before = prev.current;
    prev.current = game;
    if (!before || !armedAt.current || Date.now() - armedAt.current > ARM_WINDOW_MS || before.xp === game.xp) return;
    armedAt.current = 0;
    const c = celebrationFor(before, game);
    if (c) setCurrent({ ...c, key: Date.now() });
  }, [game]);

  const arm = useCallback(() => {
    armedAt.current = Date.now();
  }, []);
  return { arm, celebration: current };
}
