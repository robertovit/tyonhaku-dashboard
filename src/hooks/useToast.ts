import { useCallback, useRef, useState } from "react";
import type { PostItem } from "../lib/post";
import type { Shield } from "../lib/shields";

/** A newly unlocked piece of gear: the toast shows it with "Ota käyttöön" and stays longer. */
export type Unlock = { slot: "shield"; item: Shield } | { slot: "post"; item: PostItem };

export interface ToastMsg {
  title: string;
  text?: string;
  unlock?: Unlock;
  key: number;
}
export function useToast(ms = 4200) {
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback(
    (title: string, text?: string, unlock?: Unlock) => {
      setToast({ title, text, unlock, key: Date.now() });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setToast(null), unlock ? 10_000 : ms);
    },
    [ms],
  );
  return { toast, show };
}
