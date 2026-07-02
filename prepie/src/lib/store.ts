import type { PrepEvent, Profile, Task } from "@/types";
import { mockEvents, mockProfile, mockTasks } from "./mock";

// ── In-memory store ─────────────────────────────────────────────────────
// prepie runs on mock data this round (no DATABASE_URL). Reads AND writes go
// through lib/data.ts; this module owns the mutable state behind that seam.
//
// We seed from mock.ts once (deep-cloned, so the seed stays pristine) and pin
// the result on globalThis. Pinning matters in Next.js dev: route handlers,
// server components, and Server Actions can each re-evaluate this module, and
// HMR re-imports it — a plain module-level `let` would silently reset and drop
// writes. globalThis is shared across all of them, so everyone sees one store.
//
// HONEST LIMIT: persistence is per server *process*. A full dev-server restart
// (or a prod cold start) re-seeds from mock.ts. That's acceptable for this
// round — when Drizzle is wired, lib/data.ts swaps this store for real queries.

interface PrepieStore {
  profile: Profile;
  events: PrepEvent[];
  tasks: Task[];
  seq: number;
}

const globalForStore = globalThis as unknown as {
  __prepieStore?: PrepieStore;
};

function createStore(): PrepieStore {
  return {
    profile: structuredClone(mockProfile),
    events: structuredClone(mockEvents),
    tasks: structuredClone(mockTasks),
    seq: 0,
  };
}

export const store: PrepieStore =
  globalForStore.__prepieStore ??
  (globalForStore.__prepieStore = createStore());

// Seed ids are human strings ("evt-japan", "t-hair"). New ids just need to be
// unique within the process and URL-safe — a prefix + counter + short random
// suffix is plenty. When Drizzle lands, ids become DB-generated uuids and this
// helper drops away.
export function newId(prefix: "evt" | "t"): string {
  store.seq += 1;
  return `${prefix}-${store.seq}-${Math.random().toString(36).slice(2, 6)}`;
}
