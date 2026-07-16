"use client";

import { useState, useTransition } from "react";
import type { TaskStatus, TaskType } from "@/types";
import { statusesFor, statusLabel } from "@/lib/format";
import {
  fromDatetimeLocalValue,
  suggestedSlotISO,
  toDatetimeLocalValue,
} from "@/lib/slots";
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

// Status control with the precedence rule's "reality wins" made explicit:
// booking an appointment asks for the real slot (prefilled with the
// suggested noon-on-offset-day placeholder) instead of silently writing a
// guess. Moving back to "needs_booking" clears the slot so the advisory
// offset takes over; "done" preserves whatever slot exists.
export function TaskStatusControl(props: TaskStatusControlProps) {
  const { taskId, eventId, type, status } = props;
  const [pending, startTransition] = useTransition();
  // Non-null while the booking picker is open; holds the datetime-local draft.
  const [slotDraft, setSlotDraft] = useState<string | null>(null);

  function commit(next: TaskStatus, scheduledAt: string | null) {
    startTransition(() => {
      setTaskStatusAction(taskId, eventId, next, scheduledAt);
    });
  }

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as TaskStatus;
    if (next === status) return;
    if (type === "appointment" && next === "booked") {
      setSlotDraft(
        toDatetimeLocalValue(
          props.scheduledAt ??
            suggestedSlotISO(props.eventDate, props.offsetDays),
        ),
      );
      return;
    }
    const scheduledAt =
      type === "appointment" && next === "done" ? props.scheduledAt : null;
    commit(next, scheduledAt);
  }

  if (slotDraft !== null) {
    return (
      <form
        className="ml-auto flex items-center gap-1.5 text-[13px]"
        onSubmit={(e) => {
          e.preventDefault();
          commit("booked", fromDatetimeLocalValue(slotDraft));
          setSlotDraft(null);
        }}
      >
        <input
          type="datetime-local"
          value={slotDraft}
          onChange={(e) => setSlotDraft(e.target.value)}
          required
          autoFocus
          className="rounded-md border bg-paper px-2 py-1 text-[13px] text-ink outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-ink px-3 py-1 text-paper transition hover:bg-accent disabled:opacity-50"
        >
          Book
        </button>
        <button
          type="button"
          onClick={() => setSlotDraft(null)}
          className="text-muted underline decoration-line underline-offset-4 hover:decoration-accent"
        >
          Cancel
        </button>
      </form>
    );
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
