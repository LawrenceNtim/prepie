import Link from "next/link";
import { createEventAction } from "@/app/actions";
import { getProfile } from "@/lib/data";
import { STARTER_TEMPLATES, effectiveTemplates } from "@/lib/templates";

// Data lives in the DB (or the process-local mock) — never prerender at
// build time, where DATABASE_URL may be set and queried from the builder.
export const dynamic = "force-dynamic";

// On submit this calls createEventAction, which seeds the new event with your
// usual prep (from profile.timingDefaults + saved providers) plus the items
// from any occasion templates you tag it with. The one-tap "already booked"
// path lives on each seeded card's status control.
export default async function NewEventPage() {
  const profile = await getProfile();
  const qualifiers = Object.keys(
    effectiveTemplates(STARTER_TEMPLATES, profile.templates ?? {}),
  ).sort();
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

        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium">
            Occasion templates
          </legend>
          <p className="mb-2 text-[13px] text-muted">
            Tag the event and prepie seeds each template&rsquo;s prep. Edit
            them on your profile.
          </p>
          <div className="flex flex-wrap gap-2">
            {qualifiers.map((q) => (
              <label key={q} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="qualifiers"
                  value={q}
                  className="peer sr-only"
                />
                <span className="inline-block rounded-full border px-3 py-1 text-[13px] capitalize text-muted transition peer-checked:border-accent peer-checked:bg-accent-soft/40 peer-checked:text-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50">
                  {q}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

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
