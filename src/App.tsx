import { useEffect, useMemo, useState } from "react";
import { ItemsPanel, PlayerPanel, QuestPanel, WeeksPanel } from "./components/Today";
import { StatsView } from "./components/Stats";
import { LogTable } from "./components/LogTable";
import { EditDialog, type EditTarget } from "./components/EditDialog";
import { Confetti, Toast } from "./components/Effects";
import { CommandMenu, useView } from "./components/Tabs";
import { useBackend } from "./hooks/useBackend";
import { useCelebration } from "./hooks/useCelebration";
import { useToast } from "./hooks/useToast";
import { addDays, fmtDate, isoWeek, todayIso, weekday } from "./lib/dates";
import { avgXpPerApp, badgeWeeks, gameState } from "./lib/game";
import { followups, presentStatuses, SNOOZE_DAYS, summary, weeklySeries } from "./lib/stats";
import type { Application, ApplicationDoc } from "./lib/model";
import { toCsv } from "./lib/csv";
import { UserFacingError } from "./lib/store";

const WEEKDAYS = ["ma", "ti", "ke", "to", "pe", "la", "su"];

export default function App() {
  const { backend, apps, pending, goal, error } = useBackend();
  const store = backend?.store ?? null;
  const canWrite = !!store && store.canWrite !== false;
  const today = todayIso();
  const [view, setView] = useView();
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const { toast, show } = useToast();

  const list = useMemo(() => apps ?? [], [apps]);
  const game = useMemo(() => (apps ? gameState(apps, goal, today) : null), [apps, goal, today]);
  const { arm, celebration } = useCelebration(game);
  useEffect(() => {
    if (celebration) show(celebration.title, celebration.text);
  }, [celebration, show]);

  const weeks = useMemo(() => weeklySeries(list, today), [list, today]);
  const fu = useMemo(() => followups(list, today), [list, today]);
  const present = useMemo(() => presentStatuses(list), [list]);
  const earnedWeeks = useMemo(() => badgeWeeks(list, goal, today), [list, goal, today]);

  const flash = (id: string) => {
    setHighlight(id);
    setTimeout(() => setHighlight((h) => (h === id ? null : h)), 2500);
  };
  const guard = async (f: () => Promise<void>) => {
    try {
      await f();
    } catch (e) {
      setNotice(e instanceof UserFacingError ? e.message : "Tallennus epäonnistui. Yritä uudelleen.");
      throw e;
    }
  };
  const saveApp = async (id: string, doc: ApplicationDoc) => {
    arm();
    await store!.save(id, doc);
    flash(id);
  };
  const patch = (a: Application, p: Partial<ApplicationDoc>) =>
    guard(async () => {
      arm();
      await store!.update(a.id, { ...p, updatedAt: new Date().toISOString() });
      flash(a.id);
    }).catch(() => {});
  const exportCsv = async () => {
    if (!backend?.downloads || !list.length) return;
    try {
      await backend.downloads.save(`tyonhaku-${today}.csv`, toCsv(list));
    } catch (e) {
      if (e instanceof UserFacingError && e.message) show("Lataus ei onnistunut", e.message);
    }
  };

  // status line
  let state = "loading";
  let statusText = "Ladataan hakemuksia…";
  if (backend && !store) [state, statusText] = ["snapshot", backend.reason ?? ""];
  else if (error) [state, statusText] = ["stale", error];
  else if (notice) [state, statusText] = ["stale", notice];
  else if (apps) {
    state = pending ? "loading" : "live";
    statusText = !apps.length
      ? canWrite
        ? "Tietokanta on tyhjä."
        : "Hakemuksia ei ole vielä kirjattu."
      : pending
        ? "Tallennetaan…"
        : `${apps.length} hakemusta tallessa${canWrite ? "" : " · vain luku"}`;
  }

  const has = list.length > 0;
  const s = summary(list);
  const add = canWrite ? () => setEdit({ app: null }) : null;
  const csv = backend?.downloads && has ? () => void exportCsv() : null;

  return (
    <div className="wrap">
      <header className="frame topbar">
        <h1>Työnhaku 2026</h1>
        <div className="topstats">
          <span>
            <span>VKO</span> {isoWeek(today)}
            <span className="wide">
              {" "}
              · {WEEKDAYS[weekday(today)]} {fmtDate(today)}
            </span>
          </span>
          {has && (
            <>
              <span>
                <span>HAKEMUKSET</span> {s.total}
              </span>
              <span className="wide">
                <span>TYÖNANTAJAT</span> {s.orgCount}
              </span>
            </>
          )}
        </div>
      </header>

      {(state === "stale" || state === "snapshot") && statusText && (
        <p className="frame notice" role="status">
          {statusText}
        </p>
      )}

      <div className="layout">
        {has && (
          <CommandMenu
            view={view}
            onChange={setView}
            followupCount={fu.due.length}
            total={list.length}
            onAdd={add}
            onCsv={csv}
          />
        )}
        <main className="content">
          {!apps && <p className="sub">{statusText}</p>}
          {apps && !has && (
            <section className="frame empty">
              <h2>Ei vielä hakemuksia</h2>
              <p className="sub">
                {canWrite
                  ? "Kirjaa ensimmäinen hakemus, niin hahmosi, tilastot ja hakuloki täyttyvät."
                  : "Hakemuksia ei ole vielä kirjattu."}
              </p>
              {add && (
                <button type="button" className="btn primary" onClick={add}>
                  + Lisää hakemus
                </button>
              )}
            </section>
          )}
          {has && game && (
            <>
              <div
                className="view"
                id="view-tanaan"
                role="tabpanel"
                aria-labelledby="tab-tanaan"
                hidden={view !== "tanaan"}
              >
                <PlayerPanel
                  game={game}
                  goal={goal}
                  avgXp={avgXpPerApp(list)}
                  canWrite={canWrite}
                  onGoal={(n) => guard(() => store!.setGoal(n))}
                />
                <QuestPanel
                  due={fu.due}
                  snoozed={fu.snoozed}
                  canWrite={canWrite}
                  onReject={(a) => patch(a, { status: "no" })}
                  onSnooze={(a) => patch(a, { snoozeUntil: addDays(today, SNOOZE_DAYS) })}
                  onEdit={(a) => setEdit({ app: a })}
                />
                <div className="row">
                  <ItemsPanel game={game} fresh={celebration?.newBadges ?? []} weeks={earnedWeeks} />
                  <WeeksPanel weeks={weeks} goal={goal} />
                </div>
              </div>
              <div
                className="view"
                id="view-tilastot"
                role="tabpanel"
                aria-labelledby="tab-tilastot"
                hidden={view !== "tilastot"}
              >
                {view === "tilastot" && <StatsView apps={list} present={present} />}
              </div>
              <div className="view" id="view-loki" role="tabpanel" aria-labelledby="tab-loki" hidden={view !== "loki"}>
                <LogTable
                  apps={list}
                  present={present}
                  today={today}
                  xp={game.xp}
                  canWrite={canWrite}
                  highlight={highlight}
                  onEdit={(a) => setEdit({ app: a })}
                  onCsv={csv}
                />
              </div>
            </>
          )}
          <footer>
            <span className="source" data-state={state}>
              {statusText}
            </span>
            <span>Vain sinä voit muokata hakemuksia. Lataa CSV:llä saat oman varmuuskopion.</span>
          </footer>
        </main>
      </div>

      <EditDialog
        target={edit}
        today={today}
        apps={list}
        goal={goal}
        assistant={canWrite ? (backend?.assistant ?? null) : null}
        onSave={saveApp}
        onDelete={(id) => store!.remove(id)}
        onClose={() => setEdit(null)}
      />
      <Toast toast={toast} />
      <Confetti burst={celebration?.key ?? 0} count={celebration?.confetti ?? 0} />
    </div>
  );
}
