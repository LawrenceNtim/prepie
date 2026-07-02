"use client";

import { useTransition } from "react";
import { subDays, set } from "date-fns";
import type { TaskStatus, TaskType } from "@/types";
import { statusesFor, statusLabel } from "@/lib/format";
import { setTaskStatusAction } from "@/app/actions";

interface TaskStatusControlProps {
  taskId: string;
  eventId: string;
  eventDate: string; // ISO "YYYY-MM-DD"
  type: TaskType;
  status: TaskStatus;
  offsetDays: number | null;
  scheduledAt: string | null;
}

// Decide the real slot to record for a target status. This is where the
// precedence rule's "reality wins" gets a value: marking an appointment
// "booked" with no real slot yet defaults to noon on the suggested offset
// date, so the card immediately shows a booked time + a timed .ics. Moving
// back to "needs_booking" clears the slot so the advisory offset takes over;
// "done" preserves whatever slot was already there.
function slotFor(
  next: TaskStatus,
  props: TaskStatusControlProps,
): string | null {
  if (props.type !== "appointment") return null;
  if (next === "needs_booking") return null;
  if (next === "done") return props.scheduledAt ?? null;
  // next === "booked"
  if (props.scheduledAt) return props.scheduledAt;
  if (props.offsetDays != null) {
    const day = subDays(new Date(props.eventDate), props.offsetDays);
    const noon = set(day, {
      hours: 12,
      minutes: 0,
      seconds: 0,
      milliseconds: 0,
    });
    return noon.toISOString();
  }
  return null;
}

export function TaskStatusControl(props: TaskStatusControlProps) {
  const { taskId, eventId, type, status } = props;
  const [pending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as TaskStatus;
    if (next === status) return;
    const scheduledAt = slotFor(next, props);
    startTransition(() => {
      setTaskStatusAction(taskId, eventId, next, scheduledAt);
    });
  }

  return (
    <label className="ml-auto inline-flex items-center gap-1.5 text-[13px] text-muted">
      <span className="sr-only">Status</span>
      <select
        value={status}
        onChange={onChange}
        disabled={pending}
        className="rounded-md border bg-paper px-2 py-1 text-[13px] text-ink outline-none focus:border-accent disabled:opacity-50"
      >
        {statusesFor(type).map((s) => (
          <option key={s} value={s}>
            {statusLabel(s)}
          </option>
        ))}
      </select>
    </label>
  );
}
