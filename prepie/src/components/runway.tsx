import type { PrepEvent, Provider, Task } from "@/types";
import {
  resolveEffectiveDate,
  offsetDrift,
  sortByEffectiveDate,
} from "@/lib/timing";
import { formatDate } from "@/lib/format";
import { TaskCard } from "./task-card";

interface RunwayProps {
  event: PrepEvent;
  tasks: Task[];
  providers: Provider[];
}

// The runway: an unhurried vertical timeline from today down to the event.
// Tasks are ordered nodes (not pixel-proportional — ordered reads calmer),
// each resolved through the precedence rule. The event sits at the bottom
// like a destination.
export function Runway({ event, tasks, providers }: RunwayProps) {
  const eventDate = new Date(event.eventDate);
  const ordered = sortByEffectiveDate(tasks, eventDate);
  const providerById = new Map(providers.map((p) => [p.id, p]));

  return (
    <div className="relative">
      {/* the line */}
      <div
        className="absolute left-[7px] top-2 bottom-2 w-px bg-line"
        aria-hidden
      />

      <ul className="space-y-4">
        {/* today marker */}
        <li className="relative pl-8">
          <span className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-accent bg-paper" />
          <span className="text-[11px] font-medium uppercase tracking-wider text-accent">
            Today
          </span>
        </li>

        {ordered.map((task, i) => {
          const { date, source } = resolveEffectiveDate(task, eventDate);
          const drift = offsetDrift(task, eventDate);
          const provider = task.providerId
            ? providerById.get(task.providerId)
            : undefined;
          return (
            <li
              key={task.id}
              className="relative pl-8 rise"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="absolute left-[2px] top-5 h-2.5 w-2.5 rounded-full bg-ink/20" />
              <TaskCard
                task={task}
                eventId={event.id}
                eventDate={event.eventDate}
                effectiveDate={date}
                source={source}
                drift={drift}
                provider={provider}
              />
            </li>
          );
        })}

        {/* destination: the event itself */}
        <li
          className="relative pl-8 rise"
          style={{ animationDelay: `${ordered.length * 60}ms` }}
        >
          <span className="absolute left-0 top-2 h-3.5 w-3.5 rounded-full bg-accent" />
          <div className="rounded-card border border-accent/30 bg-accent-soft/40 p-4">
            <span className="text-[11px] font-medium uppercase tracking-wider text-accent">
              Event day
            </span>
            <h3 className="font-display text-xl leading-tight">{event.title}</h3>
            <p className="mt-0.5 text-sm text-muted">
              {formatDate(eventDate)}
              {event.location ? ` · ${event.location}` : ""}
            </p>
          </div>
        </li>
      </ul>
    </div>
  );
}
