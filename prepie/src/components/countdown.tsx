import { daysUntil } from "@/lib/timing";
import { formatDate } from "@/lib/format";

export function Countdown({ eventDate }: { eventDate: Date }) {
  const n = daysUntil(eventDate);
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-display text-5xl leading-none text-accent">
        {n}
      </span>
      <span className="text-sm text-muted">
        {n === 1 ? "day" : "days"} to go
        <span className="mx-1.5 text-line">·</span>
        {formatDate(eventDate)}
      </span>
    </div>
  );
}
