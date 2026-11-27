import { hadInterview, hadOffer } from "../lib/history";
import { STATUS, TYPES, type Application, type Status } from "../lib/model";
import { competition, funnel, orgRanking, summary, typeCounts, type WeekBucket } from "../lib/stats";
import { HBarChart } from "./charts/HBarChart";
import { OutcomeBar } from "./charts/OutcomeBar";
import { WeeklyChart } from "./charts/WeeklyChart";

const FUNNEL_COLOR: Record<string, string> = {
  haastattelu: "var(--st-int)",
  tarjous: "var(--st-offer)",
};

export function StatsView({
  apps,
  present,
  weeks,
  goal,
}: {
  apps: Application[];
  present: Status[];
  weeks: WeekBucket[];
  goal: number;
}) {
  const s = summary(apps);
  const ints = [...new Set(s.interviews.map((a) => a.org))];
  const comp = competition(apps);
  const kpis: { tag: string; v: string | number; small?: string; l: string }[] = [
    { tag: "HAETTU", v: s.total, l: "hakemusta lähetetty" },
    {
      tag: "VASTAUKSET",
      v: s.answered,
      small: `${Math.round((s.answered / s.total) * 100)} %`,
      l: "vastausta saatu",
    },
    {
      tag: "EDENNYT HAASTATTELUUN",
      v: s.interviews.length,
      l: ints.length ? ints.join(", ") : "ei vielä haastatteluja",
    },
    { tag: "KILPAILU", v: s.medianN ?? "–", l: `hakijaa per paikka (mediaani, ${s.knownN} hakua)` },
  ];
  return (
    <>
      <section className="kpis" aria-label="Yhteenveto">
        {kpis.map((k) => (
          <div className="frame kpi" key={k.tag}>
            <span className="tag">{k.tag}</span>
            <span className="v">
              {k.v}
              {k.small && <small>{k.small}</small>}
            </span>
            <span className="l">{k.l}</span>
          </div>
        ))}
      </section>

      <WeeksPanel weeks={weeks} goal={goal} />

      <section className="frame" aria-labelledby="outH">
        <div className="ph">
          <h2 id="outH">Lopputulokset</h2>
          <span className="sub">Kaikki hakemukset tilan mukaan</span>
        </div>
        <OutcomeBar counts={s.counts} order={present} total={s.total} />
        <div className="legend">
          {(["no", "wait", "int", "offer"] as Status[]).map((k) => (
            <span key={k}>
              <i
                className={`sw${s.counts[k] ? "" : " empty"}`}
                style={s.counts[k] ? { background: STATUS[k].color } : {}}
              />
              {k === "int" ? "Haastatteluvaiheessa" : STATUS[k].label} <b>{s.counts[k]}</b>
            </span>
          ))}
        </div>
        <div className="divider" />
        <span className="k-label">SUPPILO</span>
        <HBarChart
          ariaLabel="Suppilo: haettu, vastaus saatu, edennyt haastatteluun, tarjous"
          rows={funnel(apps).map((r) => ({
            key: r.key,
            label: <b>{r.label}</b>,
            value: r.value,
            color: FUNNEL_COLOR[r.key],
          }))}
        />
      </section>

      <div className="row">
        <section className="frame" aria-labelledby="typeH">
          <div className="ph">
            <h2 id="typeH">Tehtävätyypit</h2>
            <span className="sub">Mihin hakemukset kohdistuivat</span>
          </div>
          <HBarChart
            ariaLabel="Hakemukset tehtävätyypeittäin"
            rows={typeCounts(apps).map(([k, n]) => ({ key: k, label: <b>{TYPES[k]}</b>, value: n }))}
          />
        </section>
        <section className="frame" aria-labelledby="orgH">
          <div className="ph">
            <h2 id="orgH">Työnantajat</h2>
            <span className="sub">Eniten hakemuksia vastaanottaneet</span>
          </div>
          <HBarChart
            ariaLabel="Hakemukset työnantajittain"
            rows={orgRanking(apps).map(([l, n]) => ({ key: l, label: <b>{l}</b>, value: n }))}
          />
        </section>
      </div>

      <section className="frame" aria-labelledby="compH">
        <div className="ph">
          <h2 id="compH">Kilpailu</h2>
          <span className="sub">Hakijamäärät, kun ne ilmoitettiin · mediaani {s.medianN ?? "–"} hakijaa</span>
        </div>
        {comp.length ? (
          <HBarChart
            ariaLabel="Hakijamäärät paikoittain"
            rows={comp.map((a) => {
              const hi = hadInterview(a);
              return {
                key: a.id,
                label: (
                  <>
                    <b>{a.org}</b>
                    {a.role && <span> · {a.role}</span>}
                  </>
                ),
                value: a.n as number,
                valueLabel: `${a.n}${a.nPlus ? "+" : ""}`,
                color: hi ? "var(--accent)" : "var(--bar-muted)",
                note: hi
                  ? `★ ${STATUS[hadOffer(a) ? "offer" : "int"].label}${a.top ? " · sijoitus nro 1" : ""}`
                  : a.top
                    ? "★ Sijoitus nro 1"
                    : undefined,
                tip: (
                  <>
                    <b>{a.org}</b>
                    <br />
                    {a.role}
                    <br />
                    {a.n}
                    {a.nPlus ? "+" : ""} hakijaa · {STATUS[a.status].label}
                    {a.note && (
                      <>
                        <br />
                        {a.note}
                      </>
                    )}
                  </>
                ),
              };
            })}
          />
        ) : (
          <p className="sub">Hakijamääriä ei ole vielä kirjattu.</p>
        )}
      </section>
    </>
  );
}

/** Applications per ISO week against the weekly goal. */
function WeeksPanel({ weeks, goal }: { weeks: WeekBucket[]; goal: number }) {
  const past = weeks.filter((w) => !w.isNow);
  const met = past.filter((w) => w.count >= goal).length;
  return (
    <section className="frame" aria-labelledby="weeksH">
      <div className="ph">
        <h2 id="weeksH">Viikot</h2>
        <span className="sub">
          {past.length ? `tavoite saavutettu ${met} / ${past.length}` : "hakemukset ISO-viikoittain"}
        </span>
      </div>
      <WeeklyChart weeks={weeks} goal={goal} />
      <div className="legend small">
        <span>
          <i className="sw" style={{ background: "var(--accent)" }} />
          Tavoite
        </span>
        <span>
          <i className="sw" style={{ background: "var(--bar-muted)" }} />
          Alle tavoitteen
        </span>
        <span>
          <i className="sw dash" />
          {goal} / vko
        </span>
      </div>
    </section>
  );
}
