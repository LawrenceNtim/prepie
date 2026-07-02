import type { Provider, Task } from "@/types";
import type { DateSource } from "@/lib/timing";
import { formatDate, formatTime, relativeDays, isComplete } from "@/lib/format";
import { StatusBadge } from "./status-badge";
import { TaskStatusControl } from "./task-status-control";

interface TaskCardProps {
  task: Task;
  eventId: string;
  eventDate: string; // ISO "YYYY-MM-DD" — for the status control's slot math
  effectiveDate: Date | null;
  source: DateSource;
  drift: number | null;
  provider?: Provider;
}

// Small contextual hint that explains WHERE a task's date came from.
function SourceHint({ source }: { source: DateSource }) {
  if (source === "scheduled")
    return <span className="text-muted">booked slot</span>;
  if (source === "hard")
    return <span className="text-accent">on-sale date</span>;
  if (source === "offset")
    return <span className="text-muted">suggested</span>;
  return <span className="text-muted">no date yet</span>;
}

export function TaskCard({
  task,
  eventId,
  eventDate,
  effectiveDate,
  source,
  drift,
  provider,
}: TaskCardProps) {
  const complete = isComplete(task.status);

  return (
    <div
      className={`rounded-card border bg-surface p-4 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition ${
        complete ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-muted">
              {task.type === "appointment" ? "Appointment" : "Acquire"}
            </span>
          </div>
          <h3
            className={`font-display text-lg leading-tight ${
              complete ? "line-through decoration-1" : ""
            }`}
          >
            {task.title}
          </h3>
          {provider && (
            <p className="mt-0.5 text-sm text-muted">
              {provider.name}
              {provider.location ? ` · ${provider.location}` : ""}
            </p>
          )}
        </div>
        <StatusBadge status={task.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {effectiveDate ? (
          <>
            <span className="font-medium">{formatDate(effectiveDate)}</span>
            {source === "scheduled" && (
              <span className="text-muted">· {formatTime(effectiveDate)}</span>
            )}
            <span className="text-muted">· {relativeDays(effectiveDate)}</span>
            <span className="text-line">·</span>
            <SourceHint source={source} />
          </>
        ) : (
          <SourceHint source={source} />
        )}
      </div>

      {/* P1 benchmark flag: booked appointment that drifts from the usual offset. */}
      {drift != null && drift !== 0 && (
        <p className="mt-2 rounded-md bg-accent-soft/40 px-2.5 py-1.5 text-[13px] text-accent">
          {drift < 0
            ? `Booked ${Math.abs(drift)} day${Math.abs(drift) === 1 ? "" : "s"} earlier than your usual ${task.offsetDays}-day window.`
            : `Booked ${drift} day${drift === 1 ? "" : "s"} later than your usual ${task.offsetDays}-day window.`}
        </p>
      )}

      <div className="mt-3 flex items-center gap-4 text-[13px]">
        {effectiveDate && (
          <a
            href={`/api/ics/${task.id}`}
            className="text-ink underline decoration-line underline-offset-4 hover:decoration-accent"
          >
            Add to calendar
          </a>
        )}
        {task.link && (
          <a
            href={task.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink underline decoration-line underline-offset-4 hover:decoration-accent"
          >
            Open link
          </a>
        )}
        <TaskStatusControl
          taskId={task.id}
          eventId={eventId}
          eventDate={eventDate}
          type={task.type}
          status={task.status}
          offsetDays={task.offsetDays ?? null}
          scheduledAt={task.scheduledAt ?? null}
        />
      </div>
    </div>
  );
}
