import { useSyncExternalStore } from "react";

/** Whether a media query matches, kept current (e.g. the phone layout under 720 px). */
export function useMedia(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const m = matchMedia(query);
      m.addEventListener("change", onChange);
      return () => m.removeEventListener("change", onChange);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}
/** The phone layout: the command menu is a bottom bar and the log shows cards. Same breakpoint as app.css. */
export const PHONE = "(max-width: 720px)";
