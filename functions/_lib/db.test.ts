import { describe, expect, it } from "vitest";
import { onRequestPatch, onRequestPut } from "../api/applications/[id]";
import type { Env } from "./env";

/** Just enough of D1 for the single-application handlers: a map of id → doc JSON. */
function fakeDb(rows = new Map<string, string>()) {
  const prepare = (sql: string) => ({
    bind: (...args: unknown[]) => ({
      first: async () =>
        sql.startsWith("SELECT") && rows.has(args[0] as string) ? { doc: rows.get(args[0] as string) } : null,
      run: async () => {
        if (sql.startsWith("INSERT")) rows.set(args[0] as string, args[1] as string);
        return {};
      },
    }),
  });
  return { rows, db: { prepare } as unknown as D1Database };
}
const call = (handler: typeof onRequestPut, db: D1Database, body: unknown) =>
  handler({
    request: new Request("https://x/api/applications/a1", { method: "PUT", body: JSON.stringify(body) }),
    env: { DB: db } as Env,
    params: { id: "a1" },
  } as never);
const stored = (rows: Map<string, string>) => JSON.parse(rows.get("a1")!);

describe("applications API and the history", () => {
  const withHistory = {
    schema: 2,
    d: "2026-11-03",
    org: "Esimerkki Oy",
    status: "int",
    events: [{ status: "int", d: "2026-11-15" }],
  };

  it("stores the history sent by the app", async () => {
    const { rows, db } = fakeDb();
    await call(onRequestPut, db, {
      ...withHistory,
      status: "no",
      events: [...withHistory.events, { status: "no", d: "2026-11-20" }],
    });
    expect(stored(rows).events).toEqual([
      { status: "int", d: "2026-11-15" },
      { status: "no", d: "2026-11-20" },
    ]);
  });

  it("keeps the stored history when an older installed app saves without it", async () => {
    const { rows, db } = fakeDb(new Map([["a1", JSON.stringify(withHistory)]]));
    const oldClientDoc = { schema: 1, d: withHistory.d, org: withHistory.org, status: "no" }; // no `events`
    await call(onRequestPut, db, oldClientDoc);
    expect(stored(rows)).toMatchObject({
      schema: 2,
      status: "no",
      events: [
        { status: "int", d: "2026-11-15" },
        { status: "no", d: "" },
      ],
    });
  });

  it("a quick status patch merges into the stored history", async () => {
    const { rows, db } = fakeDb(new Map([["a1", JSON.stringify(withHistory)]]));
    await call(onRequestPatch, db, {
      status: "no",
      events: [...withHistory.events, { status: "no", d: "2026-11-20" }],
    });
    expect(stored(rows).events).toHaveLength(2);
    // an old app's patch without history still keeps the interview
    await call(onRequestPatch, db, { status: "no" });
    expect(stored(rows).events.map((e: { status: string }) => e.status)).toEqual(["int", "no"]);
  });

  it("derives the history of an old document on its next save", async () => {
    const { rows, db } = fakeDb();
    await call(onRequestPut, db, { schema: 1, d: "2026-08-01", org: "Vanha Oy", status: "no" });
    expect(stored(rows).events).toEqual([{ status: "no", d: "" }]);
  });
});
