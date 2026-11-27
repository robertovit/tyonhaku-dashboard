import { describe, expect, it } from "vitest";
import { parseShare, splitAdTitle } from "./share";
import { parseBackup, toBackup } from "./backup";
import { normalize, type Application } from "./model";
import { adTitle, webStore } from "./web";
import { UserFacingError } from "./store";

describe("share target", () => {
  it("takes the link from url or from the text, and the title", () => {
    expect(parseShare("?title=UX-suunnittelija&url=https%3A%2F%2Fesim.fi%2Fx")).toEqual({
      url: "https://esim.fi/x",
      title: "UX-suunnittelija",
    });
    expect(parseShare("?text=Katso%20t%C3%A4m%C3%A4%20https%3A%2F%2Fesim.fi%2Fy%3Fa%3D1")).toEqual({
      url: "https://esim.fi/y?a=1",
      title: "Katso tämä",
    });
    expect(
      parseShare(
        "?title=Rooli&url=" +
          encodeURIComponent("https://ura.esim.fi/p/1?utm_source=linkedin&utm_medium=job_post&id=5&utm_campaign=x"),
      ),
    ).toEqual({ url: "https://ura.esim.fi/p/1?id=5", title: "Rooli" });
    expect(parseShare("")).toBeNull();
    expect(parseShare("?view=loki")).toBeNull();
  });

  it("splits a job ad title into role and employer", () => {
    const cases: [string, string, string][] = [
      ["Full Stack Developer - Esimerkki Oy - Työpaikat - Duunitori", "Full Stack Developer", "Esimerkki Oy"],
      ["Data Analyst (Gaming) at Peliyhtiö Oy — Finland | LinkedIn Jobs", "Data Analyst (Gaming)", "Peliyhtiö Oy"],
      ["Data Analyst klo Peliyhtiö Oy — Tampere, Pirkanmaa | LinkedIn-Työpaikat", "Data Analyst", "Peliyhtiö Oy"],
      ["Peliyhtiö Oy hiring UX Designer in Tampere, Finland | LinkedIn", "UX Designer", "Peliyhtiö Oy"],
      ["Head of Data at Scale at Mittakaava Oy | LinkedIn", "Head of Data at Scale", "Mittakaava Oy"],
      ["Suunnittelija - Kaupunki", "Suunnittelija", "Kaupunki"],
      ["Katso tämä työpaikka", "Katso tämä työpaikka", ""],
      ["Kehittäjä - Yritys - Tampere", "Kehittäjä - Yritys - Tampere", ""],
      ["", "", ""],
    ];
    for (const [title, role, org] of cases) expect(splitAdTitle(title), title).toEqual({ role, org });
  });

  it("on an employer's own site, takes the part found in the address as the employer", () => {
    const cases: [string, string, string, string][] = [
      [
        "UX/UI designer | Esimerkkiyhtiö",
        "https://jobs.esimerkkiyhtio.com/positions/6686d0e2a65c",
        "UX/UI designer",
        "Esimerkkiyhtiö",
      ],
      ["Peliyhtiö - Senior Designer", "https://jobs.lever.co/peliyhtio/4b1c-77", "Senior Designer", "Peliyhtiö"],
      [
        "Data Analyst – Mittakaava Oy",
        "https://ura.mittakaava.fi/jobs/123-data-analyst",
        "Data Analyst",
        "Mittakaava Oy",
      ],
      ["Kehittäjä - Tampere - Yritys Oy", "https://yritys.fi/x", "Kehittäjä", "Yritys Oy"],
      ["Kehittäjä - Tampere - Yritys Oy", "https://muu.fi/x", "Kehittäjä - Tampere - Yritys Oy", ""],
      ["Job Application for Product Designer at Esimerkki", "", "Product Designer", "Esimerkki"],
    ];
    for (const [title, url, role, org] of cases) expect(splitAdTitle(title, url), title).toEqual({ role, org });
  });

  it("asks the server for a bare link's title and never throws", async () => {
    const seen: string[] = [];
    const ok = (async (u: string) => (
      seen.push(u),
      new Response(JSON.stringify({ title: "Rooli at Yritys | LinkedIn" }), { status: 200 })
    )) as unknown as typeof fetch;
    expect(await adTitle("https://www.linkedin.com/jobs/view/1", ok)).toEqual({
      title: "Rooli at Yritys | LinkedIn",
      role: "",
      org: "",
      reason: "",
    });
    expect(seen[0]).toBe("/api/ad-title?url=https%3A%2F%2Fwww.linkedin.com%2Fjobs%2Fview%2F1");
    const guest = (async () =>
      new Response(JSON.stringify({ title: "", role: "Rooli", org: "Yritys", reason: "" }))) as unknown as typeof fetch;
    expect(await adTitle("https://www.linkedin.com/jobs/view/1", guest)).toEqual({
      title: "",
      role: "Rooli",
      org: "Yritys",
      reason: "",
    });
    const blocked = (async () =>
      new Response(JSON.stringify({ title: "", reason: "www.linkedin.com vastasi 999" }))) as unknown as typeof fetch;
    expect(await adTitle("https://www.linkedin.com/jobs/view/1", blocked)).toEqual({
      title: "",
      role: "",
      org: "",
      reason: "www.linkedin.com vastasi 999",
    });
    const down = (async () => {
      throw new TypeError("offline");
    }) as unknown as typeof fetch;
    expect((await adTitle("https://www.linkedin.com/jobs/view/1", down)).title).toBe("");
  });
});

describe("backup", () => {
  it("round-trips every stored field and rejects other files", () => {
    const a = normalize(
      "x1",
      { org: "Testi", d: "2026-11-01", snoozeUntil: "2026-12-01", status: "todo" },
      "2026-11-25",
    );
    const b = parseBackup(toBackup([a], 4, "2026-11-25T00:00:00Z"), "2026-11-25");
    expect(b.goal).toBe(4);
    expect(b.items).toEqual([
      { id: "x1", doc: expect.objectContaining({ org: "Testi", snoozeUntil: "2026-12-01", status: "todo" }) },
    ]);
    expect(() => parseBackup('{"items":[]}', "2026-11-25")).toThrow(/varmuuskopio/);
    expect(() => parseBackup("not json", "2026-11-25")).toThrow();
  });
});

describe("web store", () => {
  const doc = normalize("a1", { org: "Alku Oy", d: "2026-11-01" }, "2026-11-25");
  const server = (opts: { failWrites?: boolean; authLost?: boolean } = {}) => {
    const calls: string[] = [];
    const f = (async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (opts.authLost) return { type: "opaqueredirect", status: 0, ok: false } as Response;
      if (url === "/api/applications" && !init?.method)
        return new Response(JSON.stringify({ items: [{ id: "a1", doc }] }), { status: 200 });
      if (url === "/api/settings/goal") return new Response(JSON.stringify({ weekly: 5 }), { status: 200 });
      if (opts.failWrites) return new Response(JSON.stringify({ error: "Virheellinen hakemus." }), { status: 400 });
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof fetch;
    return { f, calls };
  };
  const listen = (store: ReturnType<typeof webStore>) => {
    const seen: { apps: Application[]; pending: boolean }[] = [];
    const errors: string[] = [];
    store.subscribe({
      onApps: (apps, pending) => seen.push({ apps, pending }),
      onGoal: () => {},
      onError: (e) => errors.push(e),
    });
    return { seen, errors };
  };
  const tick = () => new Promise((r) => setTimeout(r, 0));

  it("shows a write at once and keeps it when the server accepts", async () => {
    const { f, calls } = server();
    const store = webStore(f);
    const { seen } = listen(store);
    await tick();
    const p = store.update("a1", { status: "no" });
    expect(seen.at(-1)).toMatchObject({ pending: true, apps: [expect.objectContaining({ status: "no" })] });
    await p;
    expect(seen.at(-1)).toMatchObject({ pending: false, apps: [expect.objectContaining({ status: "no" })] });
    expect(calls).toContain("PATCH /api/applications/a1");
  });
  it("rolls back a refused write and passes on the server's message", async () => {
    const store = webStore(server({ failWrites: true }).f);
    const { seen } = listen(store);
    await tick();
    await expect(store.remove("a1")).rejects.toThrow("Virheellinen hakemus.");
    expect(seen.at(-1)?.apps.map((a) => a.id)).toEqual(["a1"]);
  });
  it("reports an expired login", async () => {
    const store = webStore(server({ authLost: true }).f);
    const { errors } = listen(store);
    await tick();
    expect(errors[0]).toMatch(/Kirjautuminen/);
    await expect(store.save("a1", doc)).rejects.toBeInstanceOf(UserFacingError);
  });
});
