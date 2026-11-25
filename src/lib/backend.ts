// Picks the data backend at build time. `npm run build` → own server (web.ts);
// `npm run build:artifact` and `npm run dev` (with its in-memory mock) → claude.ai runtime (claude.ts).
import { connect as artifactConnect } from "./claude";
import { connect as webConnect } from "./web";

export const TARGET = import.meta.env.MODE === "artifact" || import.meta.env.DEV ? "artifact" : "web";
export const connect = TARGET === "artifact" ? artifactConnect : webConnect;
