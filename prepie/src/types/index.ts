// ── prepie domain types ───────────────────────────────────────────────
// The whole model is three objects (Profile, PrepEvent, Task) and one rule:
// a Task's effective date resolves by precedence scheduledAt → hardDate → offset.
// See lib/timing.ts for that rule — it is the heart of the app.

export type EventType = "vacation" | "wedding_guest" | "work_trip" | "other";

export type TaskType = "appointment" | "acquisition";

// Appointments and acquisitions share one enum but use different subsets.
// appointment: needs_booking → booked → done
// acquisition: to_get → got
export type TaskStatus =
  | "needs_booking"
  | "booked"
  | "done"
  | "to_get"
  | "got";

export interface Provider {
  id: string;
  name: string;
  category?: string | null; // "hair" | "nails" | "brows" | ...
  location?: string | null;
  notes?: string | null;
}

// Profile lives ABOVE events. It is the memory layer that pre-fills the
// next event you create (saved providers, sizes, your usual timing offsets).
export interface Profile {
  id: string;
  displayName: string;
  shoeSize?: string | null;
  clothingSize?: string | null;
  providers: Provider[];
  // e.g. { hair: 4, nails: 3, brows: 7 } — your usual lead times, in days.
  timingDefaults: Record<string, number>;
}

export interface PrepEvent {
  id: string;
  title: string;
  type: EventType;
  eventDate: string; // ISO date, e.g. "2026-07-08"
  location?: string | null;
  notes?: string | null;
}

export interface Task {
  id: string;
  eventId: string;
  type: TaskType;
  title: string;

  // ── Timing (precedence: scheduledAt → hardDate → offsetDays) ──────────
  offsetDays?: number | null; // advisory suggestion: days BEFORE the event
  hardDate?: string | null; // external constraint, ISO date (e.g. ticket on-sale)
  scheduledAt?: string | null; // ISO datetime — the REAL booked slot. Reality wins.

  status: TaskStatus;
  providerId?: string | null;
  link?: string | null; // ticket / booking URL
  notes?: string | null;
}
