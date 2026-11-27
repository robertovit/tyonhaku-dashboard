// Texts for the Today lists: a saved ad's deadline (calendar) and how long a sent application has waited (clock).
import { fmtDate } from "./dates";

/** Days left before a saved ad's deadline counts as urgent (shown on the Tänään badge). */
export const URGENT_DAYS = 3;

export type DeadlineTone = "past" | "urgent" | "soon" | "none";

/**
 * "Haku päättyy 3 pv päästä", "… tänään", "… huomenna", "Haku päättyi 3.11." or, without a readable date, the
 * ad's own wording ("jatkuva haku") or "Ei määräaikaa". `date` is the day itself where one is known.
 */
export function deadlineLabel(
  end: string,
  deadline: string | null,
  daysLeft: number | null,
): { text: string; date: string; tone: DeadlineTone } {
  if (deadline == null || daysLeft == null) {
    const own = end.trim();
    return { text: own ? `Määräaika: ${own}` : "Ei määräaikaa", date: "", tone: "none" };
  }
  const date = fmtDate(deadline);
  if (daysLeft < 0) return { text: `Haku päättyi ${date}`, date: "", tone: "past" };
  const tone = daysLeft <= URGENT_DAYS ? "urgent" : "soon";
  if (daysLeft === 0) return { text: "Haku päättyy tänään", date, tone };
  if (daysLeft === 1) return { text: "Haku päättyy huomenna", date, tone };
  return { text: `Haku päättyy ${daysLeft} pv päästä`, date, tone };
}

/** "Odottanut 47 pv" */
export const waitLabel = (days: number) => `Odottanut ${days} pv`;
