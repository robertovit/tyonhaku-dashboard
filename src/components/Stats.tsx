import { STATUS, TYPES, type Application, type Status } from "../lib/model";
import { competition, orgRanking, summary, typeCounts } from "../lib/stats";
import { HBarChart } from "./charts/HBarChart";
import { OutcomeBar } from "./charts/OutcomeBar";

export function StatsView({ apps, present }: { apps: Application[]; present: Status[] }) {
  const s = summary(apps);
  const ints = [...new Set(s.interviews.map((a) => a.org))];
  const comp = competition(apps);
  const kpis: { v: string | number; small?: string; l: string }[] = [
    { v: s.total, l: "Hakemusta lähetetty" },
    { v: s.answered, small: `${Math.round((s.answered / s.total) * 100)} %`, l: "Vastausta saatu" },
    {
      v: ints.length ? s.interviews.length : 0,
      l: ints.length ? `Haastattelu tai tarjous (${ints.join(", ")})` : "Haastattelua",
    },
    { v: s.medianN ?? "–", l: `Hakijaa per paikka (mediaani, ${s.knownN} hakua)` },
  ];
  return (
    <>
      <section className="kpis" aria-label="Yhteenveto">
        {kpis.map((k) => (
          <div className="kpi" key={k.l}>
            <div className="v">
              {k.v}
              {k.small && <small>{k.small}</small>}
            </div>
            <div className="l">{k.l}</div>
          </div>
        ))}
      </section>
      <div className="grid2">
        <section className="panel wide">
          <div className="ph">
            <h2>Hakujen lopputulokset</h2>
            <p className="sub">Kaikki hakemukset tilan mukaan</p>
          </div>
          <OutcomeBar counts={s.counts} order={present} total={s.total} />
          <div className="legend">
            {present.map((k) => (
              <span key={k}>
                <i className="sw" style={{ background: STATUS[k].color }} />
                {STATUS[k].label} <b>{s.counts[k]}</b>
              </span>
            ))}
          </div>
          <HBarChart
            ariaLabel="Suppilo: haettu, vastaus saatu, haastattelu"
            labelWidth={130}
            gutter={50}
            rows={[
              { key: "h", label: "Haettu", value: s.total, tone: "accent" },
              { key: "v", label: "Vastaus saatu", value: s.answered, tone: "accent" },
              { key: "i", label: "Haastattelu", value: s.interviews.length, tone: "accent" },
            ]}
          />
        </section>
        <section className="panel">
          <div className="ph">
            <h2>Tehtävätyyppi</h2>
            <p className="sub">Mihin hakemukset kohdistuivat</p>
          </div>
          <HBarChart
            ariaLabel="Hakemukset tehtävätyypeittäin"
            gutter={40}
            rows={typeCounts(apps).map(([k, n]) => ({ key: k, label: <b>{TYPES[k]}</b>, value: n }))}
          />
        </section>
        <section className="panel">
          <div className="ph">
            <h2>Työnantajat</h2>
            <p className="sub">Eniten hakemuksia vastaanottaneet</p>
          </div>
          <HBarChart
            ariaLabel="Hakemukset työnantajittain"
            gutter={40}
            rows={orgRanking(apps).map(([l, n]) => ({ key: l, label: <b>{l}</b>, value: n }))}
          />
        </section>
        <section className="panel wide">
          <div className="ph">
            <h2>Kilpailu: hakijamäärät</h2>
            <p className="sub">Paikat, joissa hakijamäärä ilmoitettiin. Mediaani {s.medianN ?? "–"} hakijaa.</p>
          </div>
          {comp.length ? (
            <HBarChart
              ariaLabel="Hakijamäärät paikoittain"
              labelWidth={320}
              rows={comp.map((a) => {
                const hi = a.status === "int" || a.status === "offer";
                return {
                  key: a.id,
                  label: (
                    <>
                      <b>{a.org}</b>
                      {a.role && ` · ${a.role}`}
                    </>
                  ),
                  value: a.n as number,
                  valueLabel: `${a.n}${a.nPlus ? "+" : ""}`,
                  tone: hi ? "accent" : undefined,
                  note: a.top ? "Sijoitus nro 1" : hi ? STATUS[a.status].label : undefined,
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
      </div>
    </>
  );
}
