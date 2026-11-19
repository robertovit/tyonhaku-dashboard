import { useCallback, useRef, useState } from "react";

export interface ToastMsg {
  title: string;
  text?: string;
  key: number;
}
export function useToast(ms = 4200) {
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback(
    (title: string, text?: string) => {
      setToast({ title, text, key: Date.now() });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setToast(null), ms);
    },
    [ms],
  );
  return { toast, show };
}
