// Kept for the planned Claude fill (see CLAUDE.md, "Later: Claude fill"): the prompt that turns a job ad into
// the add dialog's fields, and the clean-up of the model's JSON answer. Not wired to any backend yet.
import type { AdFields } from "./store";

export function adPrompt(text: string, hasImage: boolean, today: string): string {
  return `Poimi työpaikkailmoituksesta tiedot työnhakijan hakulokiin. Tänään on ${today}.
Vastaa VAIN yhdellä JSON-objektilla, jossa on nämä kentät (käytä tyhjää merkkijonoa tai null, jos tietoa ei ole ilmoituksessa, älä arvaa):
{
  "org": "työnantajan nimi",
  "role": "tehtävänimike sellaisenaan",
  "end": "hakuajan viimeinen päivä muodossa P.K. (esim. 31.10.) tai \\"jatkuva haku\\" tai \\"\\"",
  "type": "trainee" (trainee, harjoittelu, kesätyö) | "open" (avoin hakemus) | "expert" (muut),
  "how": "hakutapa lyhyesti, esim. Nettilomake, Sähköposti, LinkedIn",
  "att": "pyydetyt liitteet pilkuilla eroteltuna, esim. CV, saatekirje, palkkatoive",
  "url": "ilmoituksen tai hakulomakkeen https-osoite, jos se on tekstissä",
  "n": hakijamäärä numerona, jos ilmoituksessa mainitaan, muuten null
}
${hasImage ? "Ilmoitus on liitteenä kuvana." : ""}${text ? `\nIlmoituksen teksti:\n"""\n${text}\n"""` : ""}`;
}

/** Turns the model's JSON answer into AdFields: strings trimmed and capped, `n` a whole non-negative number or null. */
export function toAdFields(r: unknown): AdFields {
  const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 200) : "");
  const n = Number(o.n);
  return {
    org: s(o.org),
    role: s(o.role),
    end: s(o.end),
    type: s(o.type),
    how: s(o.how),
    att: s(o.att),
    url: s(o.url),
    n: o.n != null && Number.isFinite(n) && n >= 0 ? Math.round(n) : null,
  };
}
