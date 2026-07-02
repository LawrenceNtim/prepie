import { format } from "date-fns";
import type { TaskStatus, TaskType } from "@/types";
import { daysUntil } from "./timing";

export function formatDate(d: Date): string {
  return format(d, "EEE, MMM d");
}

export function formatTime(d: Date): string {
  return format(d, "h:mm a");
}

// "in 9 days" / "today" / "tomorrow" / "3 days ago"
export function relativeDays(d: Date, from: Date = new Date()): string {
  const n = daysUntil(d, from);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  if (n > 1) return `in ${n} days`;
  return `${Math.abs(n)} days ago`;
}

export function statusLabel(status: TaskStatus): string {
  switch (status) {
    case "needs_booking":
      return "Needs booking";
    case "booked":
      return "Booked";
    case "done":
      return "Done";
    case "to_get":
      return "To get";
    case "got":
      return "Got it";
  }
}

// Status options valid for a given task type — used by the status control.
export function statusesFor(type: TaskType): TaskStatus[] {
  return type === "appointment"
    ? ["needs_booking", "booked", "done"]
    : ["to_get", "got"];
}

export function isComplete(status: TaskStatus): boolean {
  return status === "done" || status === "got";
}
