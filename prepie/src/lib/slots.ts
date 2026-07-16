import { format, set, subDays } from "date-fns";

// Helpers for the "booked" path. The app stores full ISO datetimes
// (scheduledAt — reality); datetime-local inputs speak "yyyy-MM-ddTHH:mm"
// in the browser's local zone. Conversions live here so components stay
// logic-free and both entry points (status control, add-task form) agree.

// Propose a concrete slot for an appointment with no real booking yet:
// local noon on the offset-derived day, or on the event day itself when
// there is no offset. Same convention the status control has always used —
// noon is a visible placeholder, not a claim about the actual time.
export function suggestedSlotISO(
  eventDate: string,
  offsetDays: number | null,
): string {
  const day = subDays(new Date(eventDate), offsetDays ?? 0);
  return set(day, {
    hours: 12,
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
  }).toISOString();
}

export function toDatetimeLocalValue(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd'T'HH:mm");
}

export function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}
