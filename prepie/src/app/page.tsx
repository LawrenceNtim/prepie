import Link from "next/link";
import { listEvents, getTasksForEvent } from "@/lib/data";

// Data lives in the DB (or the process-local mock) — never prerender at
// build time, where DATABASE_URL may be set and queried from the builder.
export const dynamic = "force-dynamic";
import { daysUntil } from "@/lib/timing";
import { isComplete } from "@/lib/format";

export default async function HomePage() {
  const events = await listEvents();

  const withProgress = await Promise.all(
    events.map(async (e) => {
      const tasks = await getTasksForEvent(e.id);
      const done = tasks.filter((t) => isComplete(t.status)).length;
      return { event: e, total: tasks.length, done };
    }),
  );

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-12 flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-tight">prepie</h1>
          <p className="mt-1 text-sm text-muted">
            Calm prep for the moments that count.
          </p>
        </div>
        <Link
          href="/events/new"
          className="rounded-full bg-ink px-4 py-2 text-sm text-paper transition hover:bg-accent"
        >
          New event
        </Link>
      </header>

      <ul className="space-y-3">
        {withProgress.length === 0 ? (
          <li className="rounded-card border border-dashed bg-surface p-8 text-center">
            <p className="font-display text-xl">No events yet</p>
            <p className="mt-2 text-sm text-muted">
              Create an occasion and prepie will build your runway backward from
              the date.
            </p>
            <Link
              href="/events/new"
              className="mt-4 inline-block rounded-full bg-ink px-4 py-2 text-sm text-paper transition hover:bg-accent"
            >
              New event
            </Link>
          </li>
        ) : (
          withProgress.map(({ event, total, done }) => {
          const n = daysUntil(new Date(event.eventDate));
          return (
            <li key={event.id}>
              <Link
                href={`/events/${event.id}`}
                className="group flex items-center justify-between rounded-card border bg-surface p-5 transition hover:border-accent/40"
              >
                <div>
                  <h2 className="font-display text-xl leading-tight group-hover:text-accent">
                    {event.title}
                  </h2>
                  <p className="mt-0.5 text-sm text-muted">
                    {done} of {total} handled
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-display text-3xl leading-none text-accent">
                    {n}
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-muted">
                    days
                  </div>
                </div>
              </Link>
            </li>
          );
        })
        )}
      </ul>
    </main>
  );
}
