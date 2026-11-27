import { useCallback, useRef, useState } from "react";
import type { Shield } from "../lib/shields";

export interface ToastMsg {
  title: string;
  text?: string;
  /** A newly unlocked shield: the toast shows it with "Ota käyttöön" and stays longer. */
  shield?: Shield;
  key: number;
}
export function useToast(ms = 4200) {
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback(
    (title: string, text?: string, shield?: Shield) => {
      setToast({ title, text, shield, key: Date.now() });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setToast(null), shield ? 10_000 : ms);
    },
    [ms],
  );
  return { toast, show };
}
