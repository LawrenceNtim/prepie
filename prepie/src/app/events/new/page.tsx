import Link from "next/link";
import { createEventAction } from "@/app/actions";

// On submit this calls createEventAction, which seeds the new event with your
// usual prep (from profile.timingDefaults + saved providers) and drops you onto
// the runway. The one-tap "already booked" path lives on each seeded card's
// status control — set it to Booked and reality (a real slot) wins.
export default function NewEventPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <Link
        href="/"
        className="text-sm text-muted underline decoration-line underline-offset-4 hover:decoration-accent"
      >
        ← All events
      </Link>

      <h1 className="mb-2 mt-6 font-display text-3xl">New event</h1>
      <p className="mb-8 text-sm text-muted">
        Name the moment and its date. prepie computes the runway backward from
        there.
      </p>

      <form
        action={createEventAction}
        className="space-y-5 rounded-card border bg-surface p-6"
      >
        <Field
          name="title"
          label="What's the occasion?"
          placeholder="Japan — concert trip"
          required
        />
        <Field
          name="eventDate"
          label="Event date"
          placeholder="YYYY-MM-DD"
          type="date"
          required
        />
        <Field name="location" label="Where?" placeholder="Tokyo & Osaka" />

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Type</span>
          <select
            name="type"
            defaultValue="vacation"
            className="w-full rounded-md border bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="vacation">Vacation</option>
            <option value="wedding_guest">Wedding guest</option>
            <option value="work_trip">Work trip</option>
            <option value="other">Other</option>
          </select>
        </label>

        <div className="rounded-md bg-accent-soft/40 p-3 text-[13px] text-accent">
          On create, prepie pre-fills your usual prep (hair −4, nails −3,
          brows −7…) from memory. Each item has an &ldquo;already
          booked&rdquo; shortcut.
        </div>

        <button
          type="submit"
          className="w-full rounded-full bg-ink px-4 py-2.5 text-sm text-paper transition hover:bg-accent"
        >
          Create event
        </button>
      </form>
    </main>
  );
}

function Field({
  name,
  label,
  placeholder,
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-md border bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}
