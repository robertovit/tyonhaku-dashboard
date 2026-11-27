// Picks the data backend: the own server (web.ts) in the build, and in `npm run dev` an in-memory backend with
// invented example data (src/dev/memory.ts). The DEV branch is removed from the build, dev code included.
import type { Backend } from "./store";
import { connect as webConnect } from "./web";

export const connect = (): Promise<Backend> =>
  import.meta.env.DEV ? import("../dev/memory").then((m) => m.connect()) : webConnect();
