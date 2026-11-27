// Picks the data backend at build time:
// - `npm run build` → the own server (web.ts)
// - `npm run build:demo` → the public demo: invented data in the visitor's browser (src/demo/demo.ts)
// - `npm run dev` → invented data in memory (src/dev/memory.ts)
// The unused branches (and the modules they import) are dropped from each build.
import type { Backend } from "./store";
import { connect as webConnect } from "./web";

export const connect = (): Promise<Backend> =>
  import.meta.env.MODE === "demo"
    ? import("../demo/demo").then((m) => m.connect())
    : import.meta.env.DEV
      ? import("../dev/memory").then((m) => m.connect())
      : webConnect();
