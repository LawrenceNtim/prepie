import { createEvent, type DateArray, type EventAttributes } from "ics";
import type { PrepEvent, Task } from "@/types";
import { resolveEffectiveDate } from "./timing";

// Build a single-event .ics string for a task, anchored to its effective date.
// Appointments with a real scheduledAt get a timed 1-hour block; everything
// else becomes an all-day reminder on its resolved date.
export function taskToIcs(task: Task, prepEvent: PrepEvent): string | null {
  const { date, source } = resolveEffectiveDate(task, new Date(prepEvent.eventDate));
  if (!date) return null;

  const timed = source === "scheduled";

  const start: DateArray = timed
    ? [
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
      ]
    : [date.getFullYear(), date.getMonth() + 1, date.getDate()];

  const attrs: EventAttributes = {
    title: `${task.title} — for ${prepEvent.title}`,
    start,
    ...(timed
      ? { duration: { hours: 1 } }
      : { duration: { days: 1 } }),
    description: task.notes ?? `prepie • ${prepEvent.title}`,
    ...(task.link ? { url: task.link } : {}),
    busyStatus: "BUSY",
    productId: "prepie/ics",
  };

  const { error, value } = createEvent(attrs);
  if (error || !value) return null;
  return value;
}
