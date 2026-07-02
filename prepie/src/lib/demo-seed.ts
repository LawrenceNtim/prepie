import { addDays, format } from "date-fns";
import type { PrepEvent, Profile, Task, TaskStatus, TaskType } from "@/types";

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const isoT = (d: Date) => d.toISOString();

export interface DemoSeed {
  profile: Omit<Profile, "id"> & { id?: string };
  event: Omit<PrepEvent, "id">;
  tasks: Array<{
    type: TaskType;
    title: string;
    offsetDays?: number | null;
    hardDate?: string | null;
    scheduledAt?: string | null;
    status: TaskStatus;
    providerCategory?: string | null;
    link?: string | null;
    notes?: string | null;
  }>;
}

/** Japan traveler scenario — dates relative to today so the countdown stays alive. */
export function buildJapanDemoSeed(baseDate: Date = new Date()): DemoSeed {
  const eventDate = addDays(baseDate, 31);

  return {
    profile: {
      displayName: "You",
      shoeSize: "8",
      clothingSize: "M",
      providers: [
        {
          id: "prov-hair",
          name: "Sola Salon",
          category: "hair",
          location: "Echo Park",
        },
        {
          id: "prov-nails",
          name: "Olive & June",
          category: "nails",
          location: "Silver Lake",
        },
        { id: "prov-brows", name: "Threading Bar", category: "brows" },
      ],
      timingDefaults: { hair: 4, nails: 3, brows: 7 },
    },
    event: {
      title: "Japan — concert trip",
      type: "vacation",
      eventDate: iso(eventDate),
      location: "Tokyo & Osaka",
      notes: "Concert with the girls. Show up best self.",
    },
    tasks: [
      {
        type: "acquisition",
        title: "Buy concert tickets",
        hardDate: iso(addDays(baseDate, 2)),
        status: "to_get",
        link: "https://example.com/tickets",
        notes: "On-sale just opened — grab before they go.",
      },
      {
        type: "acquisition",
        title: "Buy hiking boots",
        offsetDays: 21,
        status: "got",
        notes: "Never day-one boots. Break them in.",
      },
      {
        type: "acquisition",
        title: "Buy walking shoes",
        offsetDays: 21,
        status: "to_get",
      },
      {
        type: "acquisition",
        title: "Reserve JR / shinkansen passes",
        offsetDays: 14,
        status: "to_get",
        link: "https://example.com/jr",
      },
      {
        type: "appointment",
        title: "Nails",
        offsetDays: 3,
        scheduledAt: isoT(addDays(eventDate, -7)),
        status: "booked",
        providerCategory: "nails",
      },
      {
        type: "appointment",
        title: "Brows threaded",
        offsetDays: 7,
        status: "needs_booking",
        providerCategory: "brows",
      },
      {
        type: "appointment",
        title: "Hair",
        offsetDays: 4,
        status: "needs_booking",
        providerCategory: "hair",
        notes: "Closer to the trip so it's still fresh.",
      },
    ],
  };
}

/** Materialize demo seed into domain objects with stable mock IDs. */
export function materializeJapanMock(
  eventId = "evt-japan",
  baseDate: Date = new Date(),
): { profile: Profile; events: PrepEvent[]; tasks: Task[] } {
  const seed = buildJapanDemoSeed(baseDate);
  const profile: Profile = {
    id: "profile-1",
    ...seed.profile,
    providers: seed.profile.providers.map((p) => ({ ...p })),
  };

  const providerByCategory = Object.fromEntries(
    profile.providers
      .filter((p) => p.category)
      .map((p) => [p.category!, p.id]),
  );

  const event: PrepEvent = { id: eventId, ...seed.event };

  const tasks: Task[] = seed.tasks.map((t, i) => ({
    id: `t-${["tickets", "boots", "shoes", "jr", "nails", "brows", "hair"][i]}`,
    eventId,
    type: t.type,
    title: t.title,
    offsetDays: t.offsetDays ?? null,
    hardDate: t.hardDate ?? null,
    scheduledAt: t.scheduledAt ?? null,
    status: t.status,
    providerId: t.providerCategory
      ? (providerByCategory[t.providerCategory] ?? null)
      : null,
    link: t.link ?? null,
    notes: t.notes ?? null,
  }));

  return { profile, events: [event], tasks };
}
