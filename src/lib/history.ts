// Application history: the stages an application has reached after it was sent. Each stage is recorded once,
// so saving the same status again or editing other fields changes nothing. A normal status update only adds;
// taking a stage out is a deliberate correction (withoutStage), and then its XP and statistics go with it.
import { isStage, STATUS, type Stage, type StageEvent, type Status } from "./model";

type WithEvents = { status: Status; events?: StageEvent[] };

/** The history after setting `status`: a stage not reached before is added on day `d` ("" = not known). */
export function recordStatus(events: StageEvent[], status: Status, d: string): StageEvent[] {
  if (status === "todo") return [];
  if (!isStage(status) || events.some((e) => e.status === status)) return events;
  return [...events, { status, d }];
}

/** Stages reached: the recorded ones plus the current status. */
export function reached(a: WithEvents): Set<Stage> {
  const r = new Set<Stage>((a.events ?? []).map((e) => e.status));
  if (isStage(a.status)) r.add(a.status);
  return r;
}
/** An offer counts as an interview too, as before; no dated interview event is made up for it. */
export const hadInterview = (a: WithEvents) => {
  const r = reached(a);
  return r.has("int") || r.has("offer");
};
export const hadOffer = (a: WithEvents) => reached(a).has("offer");
export const hadRejection = (a: WithEvents) => reached(a).has("no");
/** Any reply at all: a recorded stage, even if the status was later set back to "Ei vastausta". */
export const gotAnswer = (a: WithEvents) => a.status !== "wait" || (a.events ?? []).length > 0;

/** Correction: a stage that was recorded by mistake is taken out. If it is the current status, the status goes
 *  back to the previous stage, or to "Ei vastausta". */
export function withoutStage(a: { status: Status; events: StageEvent[] }, stage: Stage) {
  const events = a.events.filter((e) => e.status !== stage);
  const status: Status = a.status === stage ? (events.at(-1)?.status ?? "wait") : a.status;
  return { status, events };
}
/** Correction: the day of a recorded stage ("" = not known). The order stays as recorded. */
export const withStageDate = (events: StageEvent[], stage: Stage, d: string) =>
  events.map((e) => (e.status === stage ? { ...e, d } : e));
/** Correction: an interview that was not recorded before a later outcome (e.g. an old rejection). */
export const withEarlierInterview = (events: StageEvent[], d: string): StageEvent[] =>
  events.some((e) => e.status === "int") ? events : [{ status: "int", d }, ...events];

/** The application as it was at the end of `day`: stages dated later are not reached yet. Undated stages count
 *  from the application date, as before the history existed. */
export function asOf<T extends { status: Status; events: StageEvent[] }>(a: T, day: string): T {
  const events = a.events.filter((e) => !e.d || e.d <= day);
  if (events.length === a.events.length) return a;
  const status: Status =
    isStage(a.status) && !events.some((e) => e.status === a.status) ? (events.at(-1)?.status ?? "wait") : a.status;
  return { ...a, status, events };
}

export interface TimelineRow {
  key: string;
  d: string; // "" = not known
  label: string;
}
/** Rows for the history view: sent, then each stage; a status set back to "Ei vastausta" shows last. */
export function timeline(a: { d: string; status: Status; events: StageEvent[] }): TimelineRow[] {
  if (a.status === "todo") return [{ key: "todo", d: a.d, label: "Ilmoitus otettu talteen" }];
  const rows: TimelineRow[] = [{ key: "sent", d: a.d, label: "Hakemus lähetetty" }];
  a.events.forEach((e) => rows.push({ key: e.status, d: e.d, label: STATUS[e.status].label }));
  if (a.status === "wait" && a.events.length) rows.push({ key: "wait", d: "", label: "Nyt: odottaa vastausta" });
  return rows;
}
