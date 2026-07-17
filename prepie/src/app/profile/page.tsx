import Link from "next/link";
import { getProfile } from "@/lib/data";
import {
  addProviderAction,
  deleteProviderAction,
  removeTimingDefaultAction,
  saveTimingDefaultAction,
  updateProfileAction,
} from "@/app/actions";

// Data lives in the DB (or the process-local mock) — never prerender at
// build time, where DATABASE_URL may be set and queried from the builder.
export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-md border bg-paper px-3 py-2 text-sm outline-none focus:border-accent";

// The memory layer, finally editable. Everything on this page feeds the
// create-event pre-fill: timing defaults become seeded appointments, and
// providers attach to them by category.
export default async function ProfilePage() {
  const profile = await getProfile();
  const defaults = Object.entries(profile.timingDefaults).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-12">
        <Link
          href="/"
          className="text-sm text-muted underline decoration-line underline-offset-4 hover:decoration-accent"
        >
          ← All events
        </Link>
        <h1 className="mt-3 font-display text-4xl tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted">
          The memory that pre-fills every new event.
        </p>
      </header>

      {/* ── Basics ── */}
      <section className="rounded-card border bg-surface p-5">
        <h2 className="font-display text-lg">Basics</h2>
        <form action={updateProfileAction} className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Name</span>
            <input
              name="displayName"
              required
              defaultValue={profile.displayName}
              className={inputClass}
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">
                Shoe size
              </span>
              <input
                name="shoeSize"
                defaultValue={profile.shoeSize ?? ""}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">
                Clothing size
              </span>
              <input
                name="clothingSize"
                defaultValue={profile.clothingSize ?? ""}
                className={inputClass}
              />
            </label>
          </div>
          <button
            type="submit"
            className="rounded-full bg-ink px-4 py-2 text-sm text-paper transition hover:bg-accent"
          >
            Save basics
          </button>
        </form>
      </section>

      {/* ── Timing defaults ── */}
      <section className="mt-6 rounded-card border bg-surface p-5">
        <h2 className="font-display text-lg">Usual timing</h2>
        <p className="mt-1 text-sm text-muted">
          Days before the event you usually handle each thing. New events start
          with one unbooked appointment per row.
        </p>

        <ul className="mt-4 space-y-2">
          {defaults.length === 0 && (
            <li className="text-sm text-muted">No timing defaults yet.</li>
          )}
          {defaults.map(([category, days]) => (
            <li
              key={category}
              className="flex items-center justify-between rounded-md border bg-paper px-3 py-2 text-sm"
            >
              <span className="capitalize">{category}</span>
              <span className="ml-auto mr-4 text-muted">
                −{days} day{days === 1 ? "" : "s"}
              </span>
              <form action={removeTimingDefaultAction.bind(null, category)}>
                <button
                  type="submit"
                  aria-label={`Remove ${category}`}
                  className="text-[13px] text-muted underline decoration-line underline-offset-4 hover:decoration-accent"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>

        <form action={saveTimingDefaultAction} className="mt-4 flex items-end gap-3">
          <label className="block flex-1">
            <span className="mb-1.5 block text-sm font-medium">Category</span>
            <input name="category" required placeholder="hair" className={inputClass} />
          </label>
          <label className="block w-32">
            <span className="mb-1.5 block text-sm font-medium">Days before</span>
            <input
              name="days"
              type="number"
              min={0}
              required
              placeholder="4"
              className={inputClass}
            />
          </label>
          <button
            type="submit"
            className="rounded-full bg-ink px-4 py-2 text-sm text-paper transition hover:bg-accent"
          >
            Save
          </button>
        </form>
      </section>

      {/* ── Providers ── */}
      <section className="mt-6 rounded-card border bg-surface p-5">
        <h2 className="font-display text-lg">Saved providers</h2>
        <p className="mt-1 text-sm text-muted">
          Attached to pre-filled appointments by matching category.
        </p>

        <ul className="mt-4 space-y-2">
          {profile.providers.length === 0 && (
            <li className="text-sm text-muted">No providers saved yet.</li>
          )}
          {profile.providers.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-md border bg-paper px-3 py-2 text-sm"
            >
              <div>
                <span>{p.name}</span>
                <span className="ml-2 text-muted">
                  {[p.category, p.location].filter(Boolean).join(" · ")}
                </span>
              </div>
              <form action={deleteProviderAction.bind(null, p.id)}>
                <button
                  type="submit"
                  aria-label={`Remove ${p.name}`}
                  className="text-[13px] text-muted underline decoration-line underline-offset-4 hover:decoration-accent"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>

        <form action={addProviderAction} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Name</span>
              <input name="name" required placeholder="Salon Aiko" className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Category</span>
              <input name="category" placeholder="hair" className={inputClass} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              Location (optional)
            </span>
            <input name="location" className={inputClass} />
          </label>
          <button
            type="submit"
            className="rounded-full bg-ink px-4 py-2 text-sm text-paper transition hover:bg-accent"
          >
            Add provider
          </button>
        </form>
      </section>
    </main>
  );
}
