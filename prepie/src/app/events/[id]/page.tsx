import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvent, getTasksForEvent, getProfile } from "@/lib/data";
import { Countdown } from "@/components/countdown";
import { Runway } from "@/components/runway";
import { AddTaskForm } from "@/components/add-task-form";
import { EventDateEditor } from "@/components/event-date-editor";

export default async function EventPage({
  params,
}: {
  params: { id: string };
}) {
  const event = await getEvent(params.id);
  if (!event) notFound();

  const [tasks, profile] = await Promise.all([
    getTasksForEvent(event.id),
    getProfile(),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/"
        className="text-sm text-muted underline decoration-line underline-offset-4 hover:decoration-accent"
      >
        ← All events
      </Link>

      <header className="mb-10 mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-muted">
            {event.type.replace("_", " ")}
          </span>
          {(event.qualifiers ?? []).map((q) => (
            <span
              key={q}
              className="rounded-full border bg-paper px-2 py-0.5 text-[11px] capitalize text-muted"
            >
              {q}
            </span>
          ))}
        </div>
        <h1 className="font-display text-3xl leading-tight">{event.title}</h1>
        {event.notes && (
          <p className="mt-1 text-sm text-muted">{event.notes}</p>
        )}
        <div className="mt-5">
          <Countdown eventDate={new Date(event.eventDate)} />
          <EventDateEditor eventId={event.id} eventDate={event.eventDate} />
        </div>
      </header>

      <Runway event={event} tasks={tasks} providers={profile.providers} />

      <AddTaskForm eventId={event.id} providers={profile.providers} />
    </main>
  );
}
