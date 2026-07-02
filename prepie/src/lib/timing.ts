import { differenceInCalendarDays, subDays } from "date-fns";
import type { Task } from "@/types";

// ── The one rule everything hangs off ──────────────────────────────────
// A task's effective date resolves in STRICT priority:
//   1. scheduledAt  — the real booked slot. Reality wins.
//   2. hardDate     — an external constraint (e.g. tickets on-sale date).
//   3. offsetDays   — the advisory suggestion, computed from the event date.
// Once scheduledAt exists, the offset retires from scheduling but stays
// stored as a benchmark (see offsetDrift below).

export type DateSource = "scheduled" | "hard" | "offset" | "none";

export interface EffectiveDate {
  date: Date | null;
  source: DateSource;
}

export function resolveEffectiveDate(task: Task, eventDate: Date): EffectiveDate {
  if (task.scheduledAt) {
    return { date: new Date(task.scheduledAt), source: "scheduled" };
  }
  if (task.hardDate) {
    return { date: new Date(task.hardDate + "T00:00:00"), source: "hard" };
  }
  if (task.offsetDays != null) {
    return { date: subDays(eventDate, task.offsetDays), source: "offset" };
  }
  return { date: null, source: "none" };
}

// ── P1 benchmark ────────────────────────────────────────────────────────
// How far a *booked* appointment drifts from the user's usual offset.
// Negative = booked earlier than usual, positive = later.
// Returns null when there's no booking or no benchmark offset to compare to.
// This powers the gentle flag: "that's earlier than your usual −4."
export function offsetDrift(task: Task, eventDate: Date): number | null {
  if (!task.scheduledAt || task.offsetDays == null) return null;
  const suggested = subDays(eventDate, task.offsetDays);
  return differenceInCalendarDays(new Date(task.scheduledAt), suggested);
}

// Whole-number days from `from` until `target` (calendar days, not 24h spans).
export function daysUntil(target: Date, from: Date = new Date()): number {
  return differenceInCalendarDays(target, from);
}

// Sort tasks chronologically by their effective date for the runway.
// Undated tasks (source: "none") sink to the bottom.
export function sortByEffectiveDate(tasks: Task[], eventDate: Date): Task[] {
  return [...tasks].sort((a, b) => {
    const da = resolveEffectiveDate(a, eventDate).date;
    const db = resolveEffectiveDate(b, eventDate).date;
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da.getTime() - db.getTime();
  });
}
