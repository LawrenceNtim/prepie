"use client";

import { useTransition } from "react";
import { updateEventDateAction } from "@/app/actions";

export function EventDateEditor({
  eventId,
  eventDate,
}: {
  eventId: string;
  eventDate: string;
}) {
  const [pending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    if (!next || next === eventDate) return;
    startTransition(() => {
      updateEventDateAction(eventId, next);
    });
  }

  return (
    <label className="mt-3 inline-flex items-center gap-2 text-sm text-muted">
      <span>Move event to</span>
      <input
        type="date"
        defaultValue={eventDate}
        onChange={onChange}
        disabled={pending}
        className="rounded-md border bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-accent disabled:opacity-50"
      />
    </label>
  );
}
