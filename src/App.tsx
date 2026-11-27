import { useEffect, useMemo, useState } from "react";
import {
  ItemsPanel,
  PlayerPanel,
  QuestPanel,
  TodoPanel,
  URGENT_DAYS,
  WeeksPanel,
  type TodoItem,
} from "./components/Today";
import { StatsView } from "./components/Stats";
import { LogTable } from "./components/LogTable";
import { EditDialog, type EditTarget } from "./components/EditDialog";
import { Confetti, Toast } from "./components/Effects";
import { CommandMenu, useView } from "./components/Tabs";
import { useBackend } from "./hooks/useBackend";
import { useCelebration } from "./hooks/useCelebration";
import { useToast } from "./hooks/useToast";
import { addDays, dayDiff, deadlineIso, fmtDate, isoWeek, todayIso, weekday } from "./lib/dates";
import { avgXpPerApp, badgeWeeks, gameState } from "./lib/game";
import { followups, presentStatuses, SNOOZE_DAYS, summary, weeklySeries } from "./lib/stats";
import type { Application, ApplicationDoc } from "./lib/model";
import { toCsv } from "./lib/csv";
import { parseBackup, toBackup } from "./lib/backup";
import { parseShare, splitAdTitle } from "./lib/share";
import { UserFacingError } from "./lib/store";
import { AUTH_MSG, LOGIN_URL } from "./lib/web";

const WEEKDAYS = ["ma", "ti", "ke", "to", "pe", "la", "su"];
const REPO_URL = "https://github.com/robertovit/tyonhaku-dashboard";

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

  // Saved ads (status "todo") are not applications yet: everything below the todo list sees only `list`.
  const all = useMemo(() => apps ?? [], [apps]);
  const list = useMemo(() => all.filter((a) => a.status !== "todo"), [all]);
  const todos = useMemo<TodoItem[]>(
    () =>
      all
        .filter((a) => a.status === "todo")
        .map((app) => {
          const deadline = deadlineIso(app);
          return { app, deadline, daysLeft: deadline ? dayDiff(today, deadline) : null };
        })
        .sort((x, y) => (x.deadline ?? "9999").localeCompare(y.deadline ?? "9999") || x.app.d.localeCompare(y.app.d)),
    [all, today],
  );
  const urgent = todos.filter((t) => t.daysLeft != null && t.daysLeft >= 0 && t.daysLeft <= URGENT_DAYS).length;
  const game = useMemo(() => (apps ? gameState(list, goal, today) : null), [apps, list, goal, today]);
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
  const download = async (name: string, data: string) => {
    if (!backend?.downloads) return;
    try {
      await backend.downloads.save(name, data);
    } catch (e) {
      if (e instanceof UserFacingError && e.message) show("Lataus ei onnistunut", e.message);
    }
  };
  const exportCsv = () => download(`tyonhaku-${today}.csv`, toCsv(all));
  const exportJson = () => download(`tyonhaku-${today}.json`, toBackup(all, goal, new Date().toISOString()));
  const importJson = async (file: File) => {
    try {
      const b = parseBackup(await file.text(), today);
      await backend!.restore!(b);
      show(`Tuotiin ${b.items.length} hakemusta`, b.goal ? `Viikkotavoite ${b.goal}` : undefined);
    } catch (e) {
      show("Tuonti ei onnistunut", e instanceof Error ? e.message : "");
    }
  };

  // An ad shared to the installed app (Android share menu) opens the add dialog as a saved ad. The role and
  // employer come from the shared title; a bare link (the LinkedIn app) gets its page title from the server.
  const [shared, setShared] = useState(() => parseShare(location.search));
  const adTitle = backend?.adTitle;
  useEffect(() => {
    if (!shared || !canWrite) return;
    setShared(null);
    history.replaceState(null, "", location.pathname + location.hash);
    setView("tanaan");
    void (async () => {
      let title = shared.title;
      if (!title && shared.url && adTitle) {
        show("Haetaan ilmoituksen tietoja…");
        const r = await adTitle(shared.url);
        title = r.title;
        if (!title) show("Ilmoituksen tietoja ei saatu", r.reason ? `Syy: ${r.reason}. Täytä kentät itse.` : undefined);
      }
      const { role, org } = splitAdTitle(title);
      setEdit({ app: null, prefill: { status: "todo", d: today, url: shared.url, role, org } });
    })();
  }, [shared, canWrite, today, setView, adTitle, show]);

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
        : `${list.length} hakemusta${todos.length ? `, ${todos.length} haettavaa` : ""} tallessa${canWrite ? "" : " · vain luku"}`;
  }

  const has = all.length > 0;
  const s = summary(list);
  const add = canWrite ? () => setEdit({ app: null }) : null;
  const csv = backend?.downloads && has ? () => void exportCsv() : null;
  const authLost = error === AUTH_MSG || notice === AUTH_MSG;

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

      {backend?.demo && (
        <p className="frame notice demo-banner">
          <span>
            <strong>Demo:</strong> hakemukset ovat keksittyjä. Kokeile vapaasti, sillä muutokset tallentuvat vain tähän
            selaimeen.
          </span>
          <span className="demo-actions">
            <button
              type="button"
              className="linkbtn"
              onClick={() =>
                void backend.demo!.reset().then(() => show("Esimerkkidata palautettu", "Muutoksesi poistettiin."))
              }
            >
              Palauta esimerkkidata
            </button>
            <a className="linkbtn" href={REPO_URL}>
              Lähdekoodi GitHubissa
            </a>
          </span>
        </p>
      )}

      {(state === "stale" || state === "snapshot") && statusText && (
        <p className="frame notice" role="status">
          {statusText}{" "}
          {authLost && (
            <a className="btn sel" href={LOGIN_URL}>
              Kirjaudu uudelleen
            </a>
          )}
        </p>
      )}

      <div className="layout">
        {has && (
          <CommandMenu
            view={view}
            onChange={setView}
            followupCount={fu.due.length + urgent}
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
                <TodoPanel
                  items={todos}
                  canWrite={canWrite}
                  onApply={(a) => setEdit({ app: a, prefill: { status: "wait", d: today } })}
                  onEdit={(a) => setEdit({ app: a })}
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
                {view === "tilastot" &&
                  (list.length ? (
                    <StatsView apps={list} present={present} />
                  ) : (
                    <p className="frame sub">Tilastot näkyvät, kun ensimmäinen hakemus on lähetetty.</p>
                  ))}
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
            {!backend?.demo && <span>Vain sinä voit muokata hakemuksia.</span>}
            <span className="version">versio {import.meta.env.VITE_APP_VERSION}</span>
            {backend?.downloads && has && (
              <button type="button" className="linkbtn" onClick={() => void exportJson()}>
                Lataa varmuuskopio (JSON)
              </button>
            )}
            {canWrite && backend?.restore && (
              <label className="linkbtn filebtn-inline">
                Tuo varmuuskopio
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importJson(file);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
            {backend?.logoutUrl && (
              <a className="linkbtn" href={backend.logoutUrl}>
                Kirjaudu ulos
              </a>
            )}
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
