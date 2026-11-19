import { useEffect, useState } from "react";
import { connect } from "../lib/claude";
import type { Application } from "../lib/model";
import type { Backend } from "../lib/store";

export const DEFAULT_GOAL = 5;

/** Connects to the runtime once and keeps the applications and the weekly goal live. */
export function useBackend() {
  const [backend, setBackend] = useState<Backend | null>(null);
  const [apps, setApps] = useState<Application[] | null>(null);
  const [pending, setPending] = useState(false);
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void connect().then((b) => alive && setBackend(b));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const store = backend?.store;
    if (!store) return;
    return store.subscribe({
      onApps: (list, isPending) => {
        setApps(list);
        setPending(isPending);
        setError("");
      },
      onGoal: (w) => setGoal(w ?? DEFAULT_GOAL),
      onError: setError,
    });
  }, [backend]);

  return { backend, apps, pending, goal, error };
}
