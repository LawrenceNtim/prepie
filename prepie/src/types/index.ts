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
  templates?: TemplateMap;
}

export interface PrepEvent {
  id: string;
  title: string;
  type: EventType;
  eventDate: string; // ISO date, e.g. "2026-07-08"
  location?: string | null;
  qualifiers?: string[];
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

// ── Occasion templates ──────────────────────────────────────────────────
// A qualifier ("beach", "formal", …) maps to template items that seed a new
// event's runway: appointments (linked to saved providers by category) and
// acquisitions (grouped by a shopping/packing/errands/prep label).

export type TemplateCategory = "shopping" | "packing" | "errands" | "prep";

export interface TemplateItem {
  type: TaskType;
  title: string;
  offsetDays?: number | null; // days before the event (advisory)
  providerCategory?: string | null; // appointments: link saved provider by category
  category?: TemplateCategory | null; // acquisitions: list grouping label
  notes?: string | null;
}

// Keyed by normalized qualifier name. On the profile this stores USER
// OVERRIDES only; the effective view merges the built-in starter set
// (see lib/templates.ts). An empty list is a tombstone that hides a
// starter qualifier.
export type TemplateMap = Record<string, TemplateItem[]>;
