// The app talks to its data only through these interfaces. Two implementations: lib/web.ts (own server,
// Cloudflare Pages Functions + D1) and lib/claude.ts (claude.ai artifact runtime); lib/backend.ts picks one.
import type { Backup } from "./backup";
import type { Application, ApplicationDoc } from "./model";

export interface StoreListener {
  onApps(apps: Application[], pending: boolean): void;
  onGoal(weekly: number | null): void;
  onError(message: string): void;
}

export interface ApplicationStore {
  /** False for read-only viewers; null when the platform did not say (try, and handle a refused write). */
  readonly canWrite: boolean | null;
  subscribe(listener: StoreListener): () => void;
  save(id: string, doc: ApplicationDoc): Promise<void>;
  update(id: string, patch: Partial<ApplicationDoc>): Promise<void>;
  remove(id: string): Promise<void>;
  setGoal(weekly: number): Promise<void>;
}

/** Fields the assistant can read from a job ad. Empty string / null = not in the ad. */
export interface AdFields {
  org: string;
  role: string;
  end: string;
  type: string;
  how: string;
  att: string;
  url: string;
  n: number | null;
}
export interface Assistant {
  readonly imageTypes: string[]; // empty when screenshots cannot be sent
  fillFromAd(text: string, image: File | null, signal: AbortSignal): Promise<AdFields>;
}

export interface Downloads {
  save(filename: string, data: string): Promise<void>;
}

/** A failure the UI can show as is. `fatal` = hide the feature for the rest of the visit. */
export class UserFacingError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly fatal = false,
  ) {
    super(message);
  }
}

export interface Backend {
  store: ApplicationStore | null;
  assistant: Assistant | null;
  downloads: Downloads | null;
  /** Writes a backup into the store (upsert by id); null when the backend cannot import. */
  restore?: ((b: Backup) => Promise<void>) | null;
  /** Why there is no store, for the status line. */
  reason?: string;
}
