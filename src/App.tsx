import { useEffect, useMemo, useState } from "react";
import { Badges, FollowupList, GameCard, StreakCard, WeeklyPanel } from "./components/Today";
import { StatsView } from "./components/Stats";
import { LogTable } from "./components/LogTable";
import { EditDialog, type EditTarget } from "./components/EditDialog";
import { Confetti, Toast } from "./components/Effects";
import { Tabs, useView } from "./components/Tabs";
import { useBackend } from "./hooks/useBackend";
import { useCelebration } from "./hooks/useCelebration";
import { useToast } from "./hooks/useToast";
import { addDays, isoWeek, todayIso } from "./lib/dates";
import { gameState } from "./lib/game";
import { followups, presentStatuses, SNOOZE_DAYS, summary, typeCounts, weeklySeries } from "./lib/stats";
import { TYPES, type Application, type ApplicationDoc } from "./lib/model";
import { toCsv } from "./lib/csv";
import { UserFacingError } from "./lib/store";

const MONTHS_FROM = [
  "tammikuusta",
  "helmikuusta",
  "maaliskuusta",
  "huhtikuusta",
  "toukokuusta",
  "kesäkuusta",
  "heinäkuusta",
  "elokuusta",
  "syyskuusta",
  "lokakuusta",
  "marraskuusta",
  "joulukuusta",
];
const MONTHS_TO = [
  "tammikuuhun",
  "helmikuuhun",
  "maaliskuuhun",
  "huhtikuuhun",
  "toukokuuhun",
  "kesäkuuhun",
  "heinäkuuhun",
  "elokuuhun",
  "syyskuuhun",
  "lokakuuhun",
  "marraskuuhun",
  "joulukuuhun",
];

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
  const dates = list.map((a) => a.d).sort();
  const types = typeCounts(list);
  const m0 = has ? +dates[0].slice(5, 7) - 1 : 0;
  const m1 = has ? +dates[dates.length - 1].slice(5, 7) - 1 : 0;
  const lede = has
    ? `${s.total} hakemusta ${s.orgCount} työnantajalle ${m0 === m1 ? MONTHS_FROM[m0].replace(/sta$/, "ssa") : `${MONTHS_FROM[m0]} ${MONTHS_TO[m1]}`}. Eniten hakemuksia kohdistui ryhmään ${TYPES[types[0][0]].toLowerCase()} (${types[0][1]} kpl).`
    : "Kirjaa hakemukset, niin näet tahtisi, lopputulokset ja edistymisesi.";
  const range = weeks.length
    ? `vko ${weeks[0].week}–${weeks[weeks.length - 1].week} / ${dates[0].slice(0, 4)}`
    : `vko ${isoWeek(today)}`;

  return (
    <div className="wrap">
      <header>
        <div className="eyebrow">Haetut paikat · {range}</div>
        <h1>Työnhaku 2026</h1>
        <p className="lede">{lede}</p>
        <div className="toolbar">
          <div className="source" data-state={state}>
            <i />
            <span className="txt">{statusText}</span>
          </div>
          <div className="toolbar-actions">
            {backend?.downloads && has && (
              <button type="button" className="btn" onClick={() => void exportCsv()}>
                Lataa CSV
              </button>
            )}
            {canWrite && (
              <button type="button" className="btn primary" onClick={() => setEdit({ app: null })}>
                + Lisää hakemus
              </button>
            )}
          </div>
        </div>
      </header>

      {apps && !has && canWrite && (
        <section className="panel empty">
          <h2>Ei vielä hakemuksia</h2>
          <p className="lede">Kirjaa ensimmäinen hakemus, niin yhteenveto, kaaviot ja hakuloki täyttyvät.</p>
          <button type="button" className="btn primary" onClick={() => setEdit({ app: null })}>
            + Lisää hakemus
          </button>
        </section>
      )}

      {has && game && (
        <div id="dash">
          <Tabs view={view} onChange={setView} followupCount={fu.due.length} total={list.length} />
          <div
            className="view"
            id="view-tanaan"
            role="tabpanel"
            aria-labelledby="tab-tanaan"
            hidden={view !== "tanaan"}
          >
            <div className="game" aria-label="Edistyminen">
              <GameCard game={game} />
              <StreakCard game={game} goal={goal} />
            </div>
            <FollowupList
              due={fu.due}
              snoozed={fu.snoozed}
              canWrite={canWrite}
              onReject={(a) => patch(a, { status: "no" })}
              onSnooze={(a) => patch(a, { snoozeUntil: addDays(today, SNOOZE_DAYS) })}
              onEdit={(a) => setEdit({ app: a })}
            />
            <div className="grid2">
              <WeeklyPanel
                weeks={weeks}
                goal={goal}
                game={game}
                today={today}
                canWrite={canWrite}
                onGoal={(n) => guard(() => store!.setGoal(n))}
              />
              <Badges game={game} fresh={celebration?.newBadges ?? []} />
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
              canWrite={canWrite}
              highlight={highlight}
              onEdit={(a) => setEdit({ app: a })}
            />
          </div>
        </div>
      )}

      <footer>
        Hakemukset tallentuvat tämän dashboardin omaan tietokantaan. Vain sinä voit muokata niitä. Lataa CSV -napista
        saat oman varmuuskopion.
      </footer>

      <EditDialog
        target={edit}
        today={today}
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
