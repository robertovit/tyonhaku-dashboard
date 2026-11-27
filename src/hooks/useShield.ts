import { useCallback, useState } from "react";
import { equippedShield, type ShieldId } from "../lib/shields";

// The worn shield is a choice made in this browser, not application data, so it lives in localStorage.
const KEY = `tyonhaku:shield:${import.meta.env.MODE}`;

function saved(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** The shield the avatar wears (undefined while none is chosen or the choice is no longer earned). */
export function useShield(rejections: number) {
  const [id, setId] = useState(saved);
  const equip = useCallback((next: ShieldId | null) => {
    setId(next);
    try {
      if (next) localStorage.setItem(KEY, next);
      else localStorage.removeItem(KEY);
    } catch {
      /* blocked storage: the choice still holds for this visit */
    }
  }, []);
  return { shield: equippedShield(id, rejections), equip };
}
