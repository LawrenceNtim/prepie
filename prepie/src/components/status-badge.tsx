import type { TaskStatus } from "@/types";
import { statusLabel } from "@/lib/format";

const styles: Record<TaskStatus, string> = {
  needs_booking: "border-accent/40 text-accent bg-accent-soft/50",
  to_get: "border-accent/40 text-accent bg-accent-soft/50",
  booked: "border-ink/15 text-ink bg-surface",
  done: "border-sage/40 text-sage bg-sage/10",
  got: "border-sage/40 text-sage bg-sage/10",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${styles[status]}`}
    >
      {statusLabel(status)}
    </span>
  );
}
