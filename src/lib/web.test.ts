import { describe, expect, it } from "vitest";
import { parseShare } from "./share";
import { parseBackup, toBackup } from "./backup";
import { normalize, type Application } from "./model";
import { webStore } from "./web";
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
    expect(parseShare("")).toBeNull();
    expect(parseShare("?view=loki")).toBeNull();
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
