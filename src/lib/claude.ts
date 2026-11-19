// claude.ai artifact runtime (window.claude) behind the app's store interfaces.
// Capabilities this page declares when published: db (owner writes), user, sample, downloads.
import { normalize } from "./model";
import { todayIso } from "./dates";
import {
  UserFacingError,
  type AdFields,
  type ApplicationStore,
  type Assistant,
  type Backend,
  type Downloads,
} from "./store";

/* Minimal typings for the parts of the runtime this app uses. */
interface Snap {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
  metadata?: { hasPendingWrites?: boolean };
}
interface QuerySnap {
  docs: Snap[];
  metadata?: { hasPendingWrites?: boolean };
}
interface DocRef {
  set(d: Record<string, unknown>): Promise<void>;
  update(d: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
  onSnapshot(next: (s: Snap) => void, err?: (e: { code: string }) => void): () => void;
}
interface Db {
  doc(path: string): DocRef;
  collection(path: string): {
    doc(id: string): DocRef;
    onSnapshot(next: (s: QuerySnap) => void, err?: (e: { code: string }) => void): () => void;
  };
}
interface SampleFn {
  json(input: string, opts: Record<string, unknown>): Promise<unknown>;
  limits(): Promise<{ images?: { mediaTypes: string[] } }>;
}
interface UserNs {
  can(name: string): Promise<boolean | null>;
}
interface DownloadsNs {
  save(req: { filename: string; data: string }): Promise<unknown>;
}
interface ClaudeRuntime {
  use(name: "db"): Promise<Db | null>;
  use(name: "user"): Promise<UserNs | null>;
  use(name: "sample"): Promise<SampleFn | null>;
  use(name: "downloads"): Promise<DownloadsNs | null>;
}
declare global {
  interface Window {
    claude?: ClaudeRuntime;
  }
}

const COL = "applications";
const GOAL_DOC = "settings/goal";
const code = (e: unknown) => (e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "");

function dbStore(db: Db, canWrite: boolean | null): ApplicationStore {
  const writeError = (e: unknown) => {
    const c = code(e);
    if (c === "invalid_argument") return new UserFacingError("Sinulla ei ole oikeutta muokata hakemuksia.", c, true);
    if (c === "quota_exceeded")
      return new UserFacingError("Tietokanta on täynnä. Poista vanhoja hakemuksia ja yritä uudelleen.", c);
    return new UserFacingError("Tallennus epäonnistui. Tarkista yhteys ja yritä uudelleen.", c);
  };
  const wrap = async (p: () => Promise<void>) => {
    try {
      await p();
    } catch (e) {
      throw writeError(e);
    }
  };
  return {
    canWrite,
    subscribe(l) {
      const offApps = db.collection(COL).onSnapshot(
        (s) => {
          const today = todayIso();
          l.onApps(
            s.docs.filter((d) => d.exists).map((d) => normalize(d.id, d.data(), today)),
            !!s.metadata?.hasPendingWrites,
          );
        },
        (e) =>
          l.onError(
            e.code === "revoked"
              ? "Pääsy hakemuksiin päättyi. Lataa sivu uudelleen."
              : `Yhteys tietokantaan katkesi (${e.code}). Lataa sivu uudelleen.`,
          ),
      );
      const offGoal = db.doc(GOAL_DOC).onSnapshot(
        (s) => {
          const w = s.exists ? Number(s.data()?.weekly) : NaN;
          l.onGoal(w >= 1 && w <= 50 ? Math.round(w) : null);
        },
        () => {},
      );
      return () => {
        offApps();
        offGoal();
      };
    },
    save: (id, doc) =>
      wrap(() =>
        db
          .collection(COL)
          .doc(id)
          .set({ ...doc }),
      ),
    update: (id, patch) =>
      wrap(() =>
        db
          .collection(COL)
          .doc(id)
          .update({ ...patch }),
      ),
    remove: (id) => wrap(() => db.collection(COL).doc(id).delete()),
    setGoal: (weekly) => wrap(() => db.doc(GOAL_DOC).set({ weekly, updatedAt: new Date().toISOString() })),
  };
}

const AI_ERRORS: Record<string, string> = {
  not_granted: "Claude-apu ei ole sallittu tällä sivulla.",
  sampling_disabled: "Claude ei ole käytettävissä tilillesi.",
  rate_limited: "Liian monta pyyntöä tai käyttöraja täynnä. Yritä hetken päästä uudelleen.",
  session_expired: "Kirjaudu claude.aihin uudelleen ja yritä sitten.",
  refused: "Claude ei käsitellyt tätä tekstiä. Kokeile liittää pelkkä ilmoitus.",
  empty_completion: "Ilmoituksesta ei löytynyt tietoja. Tarkista teksti.",
  invalid_json: "Vastausta ei saatu luettua. Yritä uudelleen.",
  prompt_too_large: "Teksti on liian pitkä. Liitä vain ilmoituksen oleellinen osa.",
  image_rejected: "Kuvaa ei voitu käyttää. Kokeile toista tiedostoa (JPG tai PNG).",
};
const AI_FATAL = ["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"];

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

async function sampleAssistant(sample: SampleFn): Promise<Assistant> {
  let imageTypes: string[];
  try {
    imageTypes = (await sample.limits()).images?.mediaTypes ?? [];
  } catch {
    imageTypes = [];
  }
  return {
    imageTypes,
    async fillFromAd(text, image, signal) {
      try {
        const r = await sample.json(adPrompt(text.slice(0, 20000), !!image, todayIso()), {
          modelTier: "quick",
          signal,
          ...(image ? { images: image } : {}),
        });
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
        } satisfies AdFields;
      } catch (e) {
        const c = code(e);
        throw new UserFacingError(
          AI_ERRORS[c] ?? (c === "cancelled" ? "" : "Ilmoituksen lukeminen epäonnistui. Yritä uudelleen."),
          c,
          AI_FATAL.includes(c),
        );
      }
    },
  };
}

function downloadsAdapter(dl: DownloadsNs): Downloads {
  return {
    async save(filename, data) {
      try {
        await dl.save({ filename, data });
      } catch (e) {
        const c = code(e);
        if (c === "declined") throw new UserFacingError("", c);
        throw new UserFacingError(
          c === "rate_limited"
            ? "Tallennusikkuna on jo auki. Yritä hetken päästä."
            : "Tiedoston tallennus ei onnistunut.",
          c,
          ["unavailable", "not_granted", "capability_disabled", "capability_removed"].includes(c),
        );
      }
    },
  };
}

export async function connect(): Promise<Backend> {
  const rt = window.claude;
  if (!rt?.use)
    return {
      store: null,
      assistant: null,
      downloads: null,
      reason: "Hakemukset näkyvät, kun avaat sivun claude.aissa kirjautuneena.",
    };
  const [db, user, sample, dl] = await Promise.all([
    rt.use("db").catch(() => null),
    rt.use("user").catch(() => null),
    rt.use("sample").catch(() => null),
    rt.use("downloads").catch(() => null),
  ]);
  if (!db)
    return {
      store: null,
      assistant: null,
      downloads: null,
      reason: "Hakemuksia ei voitu ladata. Avaa sivu claude.aissa kirjautuneena.",
    };
  let can: boolean | null;
  try {
    can = user ? await user.can("data.write") : null;
  } catch {
    can = null;
  }
  return {
    store: dbStore(db, can === false ? false : can),
    assistant: sample ? await sampleAssistant(sample) : null,
    downloads: dl ? downloadsAdapter(dl) : null,
  };
}
