"use client";

import { useRef, useState } from "react";
import type { Provider, TaskType } from "@/types";
import { addTaskAction } from "@/app/actions";

interface AddTaskFormProps {
  eventId: string;
  providers: Provider[];
}

// Collapsible "+ Add a task". Choice of appointment vs acquisition, and a
// timing mode toggle: a relative offset (the prepie default — recomputes if the
// event moves) or a hard date (an external constraint like an on-sale window).
export function AddTaskForm({ eventId, providers }: AddTaskFormProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TaskType>("appointment");
  const [timing, setTiming] = useState<"offset" | "hard">("offset");
  const formRef = useRef<HTMLFormElement>(null);

  const action = addTaskAction.bind(null, eventId);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-8 w-full rounded-card border border-dashed p-4 text-center text-sm text-muted transition hover:border-accent hover:text-accent"
      >
        + Add a task
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await action(formData);
        formRef.current?.reset();
        setType("appointment");
        setTiming("offset");
        setOpen(false);
      }}
      className="mt-8 space-y-4 rounded-card border bg-surface p-5"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg">Add a task</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-muted underline decoration-line underline-offset-4 hover:decoration-accent"
        >
          Cancel
        </button>
      </div>

      {/* type */}
      <div className="flex gap-2">
        {(["appointment", "acquisition"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded-full border px-3 py-1 text-[13px] transition ${
              type === t
                ? "border-accent bg-accent-soft/40 text-accent"
                : "text-muted hover:border-accent"
            }`}
          >
            {t === "appointment" ? "Appointment" : "Acquire"}
          </button>
        ))}
        <input type="hidden" name="type" value={type} />
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Title</span>
        <input
          name="title"
          required
          placeholder={type === "appointment" ? "Hair" : "Buy walking shoes"}
          className="w-full rounded-md border bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>

      {/* timing mode */}
      <div className="flex gap-2 text-[13px]">
        {(["offset", "hard"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setTiming(m)}
            className={`rounded-full border px-3 py-1 transition ${
              timing === m
                ? "border-accent bg-accent-soft/40 text-accent"
                : "text-muted hover:border-accent"
            }`}
          >
            {m === "offset" ? "Days before event" : "Fixed date"}
          </button>
        ))}
      </div>

      {timing === "offset" ? (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            How many days before?
          </span>
          <input
            name="offsetDays"
            type="number"
            min={0}
            placeholder="4"
            className="w-full rounded-md border bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>
      ) : (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">On this date</span>
          <input
            name="hardDate"
            type="date"
            className="w-full rounded-md border bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>
      )}

      {type === "appointment" && providers.length > 0 && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Provider</span>
          <select
            name="providerId"
            defaultValue=""
            className="w-full rounded-md border bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="">— none —</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.category ? ` · ${p.category}` : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Link (optional)</span>
        <input
          name="link"
          type="url"
          placeholder="https://…"
          className="w-full rounded-md border bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>

      <button
        type="submit"
        className="w-full rounded-full bg-ink px-4 py-2.5 text-sm text-paper transition hover:bg-accent"
      >
        Add to runway
      </button>
    </form>
  );
}
