import type {
  PrepEvent,
  Profile,
  Provider,
  Task,
  TaskStatus,
  TaskType,
} from "@/types";
import { store, newId } from "./store";
import { buildJapanDemoSeed } from "./demo-seed";
import { db } from "./db";
import { events, profiles, providers, tasks } from "./db/schema";
import { asc, count, eq } from "drizzle-orm";

// ── Data access layer ───────────────────────────────────────────────────
// One seam, two backends. With no DATABASE_URL set, `db` is null and every
// function falls back to the in-memory `store` (seeded from mock.ts) so the
// app boots with zero setup. When DATABASE_URL is present, the same functions
// run real Drizzle queries — signatures are identical, so no screen,
// component, or action changes.
//
// Single-user note: auth is still the hardcoded profile this round. The DB
// path lazily get-or-creates that one profile (+ its saved providers) via
// `ensureProfile`, because events.profile_id is NOT NULL and there is no
// profile-management UI yet. Nothing is pre-seeded; the profile materializes
// on first read/write, and events/tasks stay empty until you create them.

// ── Row → domain mappers ────────────────────────────────────────────────
// The DB returns snake_case rows with Date objects for timestamps; the domain
// types are camelCase with ISO strings. These bridge the two.

type ProviderRow = typeof providers.$inferSelect;
type ProfileRow = typeof profiles.$inferSelect & { providers: ProviderRow[] };
type EventRow = typeof events.$inferSelect;
type TaskRow = typeof tasks.$inferSelect;

function mapProvider(r: ProviderRow): Provider {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    location: r.location,
    notes: r.notes,
  };
}

function mapProfile(r: ProfileRow): Profile {
  return {
    id: r.id,
    displayName: r.displayName,
    shoeSize: r.shoeSize,
    clothingSize: r.clothingSize,
    providers: r.providers.map(mapProvider),
    timingDefaults: r.timingDefaults,
  };
}

function mapEvent(r: EventRow): PrepEvent {
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    eventDate: r.eventDate,
    location: r.location,
    notes: r.notes,
  };
}

function mapTask(r: TaskRow): Task {
  return {
    id: r.id,
    eventId: r.eventId,
    type: r.type,
    title: r.title,
    offsetDays: r.offsetDays,
    hardDate: r.hardDate,
    // timestamptz → ISO string; the rest of the app speaks ISO.
    scheduledAt: r.scheduledAt ? r.scheduledAt.toISOString() : null,
    status: r.status,
    providerId: r.providerId,
    link: r.link,
    notes: r.notes,
  };
}

// ── Profile bootstrap (DB only) ─────────────────────────────────────────
// Returns the one profile, creating it from the hardcoded seed on first call.
// Used by getProfile and by every write that needs a profile_id.
async function ensureProfile(): Promise<Profile> {
  const existing = await db!.query.profiles.findFirst({
    with: { providers: true },
  });
  if (existing) return mapProfile(existing);

  const seed = store.profile; // the single hardcoded user (from mock seed)
  const [created] = await db!
    .insert(profiles)
    .values({
      displayName: seed.displayName,
      shoeSize: seed.shoeSize ?? null,
      clothingSize: seed.clothingSize ?? null,
      timingDefaults: seed.timingDefaults,
    })
    .returning();

  const createdProviders = seed.providers.length
    ? await db!
        .insert(providers)
        .values(
          seed.providers.map((p) => ({
            profileId: created.id,
            name: p.name,
            category: p.category ?? null,
            location: p.location ?? null,
            notes: p.notes ?? null,
          })),
        )
        .returning()
    : [];

  return mapProfile({ ...created, providers: createdProviders });
}

// ── Demo seed (DB only) ───────────────────────────────────────────────────
// When DATABASE_URL is set but the DB is empty, seed the Japan traveler demo
// so a deployed URL lands on a rich runway instead of a blank home page.
async function ensureDemoData(profile: Profile): Promise<void> {
  const [{ value: eventCount }] = await db!
    .select({ value: count() })
    .from(events)
    .where(eq(events.profileId, profile.id));
  if (eventCount > 0) return;

  const seed = buildJapanDemoSeed();
  const providerByCategory = Object.fromEntries(
    profile.providers
      .filter((p) => p.category)
      .map((p) => [p.category!, p.id]),
  );

  const [eventRow] = await db!
    .insert(events)
    .values({
      profileId: profile.id,
      title: seed.event.title,
      type: seed.event.type,
      eventDate: seed.event.eventDate,
      location: seed.event.location ?? null,
      notes: seed.event.notes ?? null,
    })
    .returning();

  if (seed.tasks.length) {
    await db!.insert(tasks).values(
      seed.tasks.map((t) => ({
        eventId: eventRow.id,
        type: t.type,
        title: t.title,
        offsetDays: t.offsetDays ?? null,
        hardDate: t.hardDate ?? null,
        scheduledAt: t.scheduledAt ? new Date(t.scheduledAt) : null,
        status: t.status,
        providerId: t.providerCategory
          ? (providerByCategory[t.providerCategory] ?? null)
          : null,
        link: t.link ?? null,
        notes: t.notes ?? null,
      })),
    );
  }
}

// ── Reads ───────────────────────────────────────────────────────────────

export async function getProfile(): Promise<Profile> {
  if (!db) return store.profile;
  const profile = await ensureProfile();
  await ensureDemoData(profile);
  return profile;
}

export async function listEvents(): Promise<PrepEvent[]> {
  if (!db) return store.events;
  const profile = await ensureProfile();
  await ensureDemoData(profile);
  const rows = await db.select().from(events).orderBy(asc(events.eventDate));
  return rows.map(mapEvent);
}

export async function getEvent(id: string): Promise<PrepEvent | null> {
  if (!db) return store.events.find((e) => e.id === id) ?? null;
  const [row] = await db.select().from(events).where(eq(events.id, id));
  return row ? mapEvent(row) : null;
}

export async function getTasksForEvent(eventId: string): Promise<Task[]> {
  if (!db) return store.tasks.filter((t) => t.eventId === eventId);
  const rows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.eventId, eventId))
    .orderBy(asc(tasks.createdAt));
  return rows.map(mapTask);
}

export async function getTask(id: string): Promise<Task | null> {
  if (!db) return store.tasks.find((t) => t.id === id) ?? null;
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id));
  return row ? mapTask(row) : null;
}

// ── Writes ──────────────────────────────────────────────────────────────
// Input shapes intentionally omit id/createdAt (the DB defaults those) and use
// the same field names as the Drizzle schema, so the two backends stay 1:1.

export interface CreateEventInput {
  title: string;
  type: PrepEvent["type"];
  eventDate: string; // "YYYY-MM-DD"
  location?: string | null;
  notes?: string | null;
}

export async function createEvent(input: CreateEventInput): Promise<PrepEvent> {
  if (!db) {
    const event: PrepEvent = {
      id: newId("evt"),
      title: input.title.trim(),
      type: input.type,
      eventDate: input.eventDate,
      location: input.location?.trim() || null,
      notes: input.notes?.trim() || null,
    };
    store.events.push(event);
    return event;
  }

  const profile = await ensureProfile();
  const [row] = await db
    .insert(events)
    .values({
      profileId: profile.id,
      title: input.title.trim(),
      type: input.type,
      eventDate: input.eventDate,
      location: input.location?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .returning();
  return mapEvent(row);
}

// The prepie magic: create an event AND seed it with the user's usual prep,
// pulled from profile memory (timingDefaults + saved providers).
export async function createEventWithPrefill(
  input: CreateEventInput,
): Promise<{ event: PrepEvent; tasks: Task[] }> {
  if (!db) {
    const event = await createEvent(input);
    const seeded = buildPrefillTasks(store.profile).map((seed) => ({
      id: newId("t"),
      eventId: event.id,
      ...seed,
    }));
    store.tasks.push(...seeded);
    return { event, tasks: seeded };
  }

  const profile = await ensureProfile();
  const [eventRow] = await db
    .insert(events)
    .values({
      profileId: profile.id,
      title: input.title.trim(),
      type: input.type,
      eventDate: input.eventDate,
      location: input.location?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .returning();

  const seeds = buildPrefillTasks(profile);
  const taskRows = seeds.length
    ? await db
        .insert(tasks)
        .values(seeds.map((seed) => ({ eventId: eventRow.id, ...seed })))
        .returning()
    : [];

  return { event: mapEvent(eventRow), tasks: taskRows.map(mapTask) };
}

export interface CreateTaskInput {
  eventId: string;
  type: TaskType;
  title: string;
  offsetDays?: number | null;
  hardDate?: string | null;
  scheduledAt?: string | null;
  providerId?: string | null;
  link?: string | null;
  notes?: string | null;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  // "Already booked" is a first-class entry state: an appointment created
  // with a real slot starts life as booked (reality wins from the start).
  const status: TaskStatus =
    input.type === "appointment"
      ? input.scheduledAt
        ? "booked"
        : "needs_booking"
      : "to_get";

  if (!db) {
    const task: Task = {
      id: newId("t"),
      eventId: input.eventId,
      type: input.type,
      title: input.title.trim(),
      offsetDays: input.offsetDays ?? null,
      hardDate: input.hardDate ?? null,
      scheduledAt: input.scheduledAt ?? null,
      status,
      providerId: input.providerId ?? null,
      link: input.link?.trim() || null,
      notes: input.notes?.trim() || null,
    };
    store.tasks.push(task);
    return task;
  }

  const [row] = await db
    .insert(tasks)
    .values({
      eventId: input.eventId,
      type: input.type,
      title: input.title.trim(),
      offsetDays: input.offsetDays ?? null,
      hardDate: input.hardDate ?? null,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      status,
      providerId: input.providerId ?? null,
      link: input.link?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .returning();
  return mapTask(row);
}

export interface UpdateTaskInput {
  status?: TaskStatus;
  scheduledAt?: string | null; // the real booked slot — "reality wins"
}

export interface UpdateEventInput {
  eventDate?: string;
  title?: string;
  location?: string | null;
  notes?: string | null;
}

// Status update with the precedence rule baked in: moving an appointment to
// "booked" can carry a scheduledAt, which then outranks the advisory offset.
export async function updateTask(
  id: string,
  patch: UpdateTaskInput,
): Promise<Task | null> {
  if (!db) {
    const task = store.tasks.find((t) => t.id === id);
    if (!task) return null;
    if (patch.status !== undefined) task.status = patch.status;
    if (patch.scheduledAt !== undefined) task.scheduledAt = patch.scheduledAt;
    return task;
  }

  const set: Partial<typeof tasks.$inferInsert> = {};
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.scheduledAt !== undefined) {
    set.scheduledAt = patch.scheduledAt ? new Date(patch.scheduledAt) : null;
  }

  const [row] = await db
    .update(tasks)
    .set(set)
    .where(eq(tasks.id, id))
    .returning();
  return row ? mapTask(row) : null;
}

export async function updateEvent(
  id: string,
  patch: UpdateEventInput,
): Promise<PrepEvent | null> {
  if (!db) {
    const event = store.events.find((e) => e.id === id);
    if (!event) return null;
    if (patch.eventDate !== undefined) event.eventDate = patch.eventDate;
    if (patch.title !== undefined) event.title = patch.title.trim();
    if (patch.location !== undefined) event.location = patch.location?.trim() || null;
    if (patch.notes !== undefined) event.notes = patch.notes?.trim() || null;
    return event;
  }

  const set: Partial<typeof events.$inferInsert> = {};
  if (patch.eventDate !== undefined) set.eventDate = patch.eventDate;
  if (patch.title !== undefined) set.title = patch.title.trim();
  if (patch.location !== undefined) set.location = patch.location?.trim() || null;
  if (patch.notes !== undefined) set.notes = patch.notes?.trim() || null;

  const [row] = await db
    .update(events)
    .set(set)
    .where(eq(events.id, id))
    .returning();
  return row ? mapEvent(row) : null;
}

// ── Profile editing ─────────────────────────────────────────────────────
// The memory layer is finally editable. Same dual-backend contract: mock
// mutates the pinned store, DB path updates the single ensureProfile row.

export interface UpdateProfileInput {
  displayName?: string;
  shoeSize?: string | null;
  clothingSize?: string | null;
  timingDefaults?: Record<string, number>;
}

export async function updateProfile(
  patch: UpdateProfileInput,
): Promise<Profile> {
  if (!db) {
    const p = store.profile;
    if (patch.displayName !== undefined) p.displayName = patch.displayName.trim();
    if (patch.shoeSize !== undefined) p.shoeSize = patch.shoeSize?.trim() || null;
    if (patch.clothingSize !== undefined)
      p.clothingSize = patch.clothingSize?.trim() || null;
    if (patch.timingDefaults !== undefined)
      p.timingDefaults = patch.timingDefaults;
    return p;
  }

  const profile = await ensureProfile();
  const set: Partial<typeof profiles.$inferInsert> = {};
  if (patch.displayName !== undefined) set.displayName = patch.displayName.trim();
  if (patch.shoeSize !== undefined) set.shoeSize = patch.shoeSize?.trim() || null;
  if (patch.clothingSize !== undefined)
    set.clothingSize = patch.clothingSize?.trim() || null;
  if (patch.timingDefaults !== undefined)
    set.timingDefaults = patch.timingDefaults;

  await db.update(profiles).set(set).where(eq(profiles.id, profile.id));
  return getProfile();
}

export interface CreateProviderInput {
  name: string;
  category?: string | null;
  location?: string | null;
  notes?: string | null;
}

export async function addProvider(
  input: CreateProviderInput,
): Promise<Provider> {
  const values = {
    name: input.name.trim(),
    category: input.category?.trim() || null,
    location: input.location?.trim() || null,
    notes: input.notes?.trim() || null,
  };

  if (!db) {
    const provider: Provider = { id: newId("p"), ...values };
    store.profile.providers.push(provider);
    return provider;
  }

  const profile = await ensureProfile();
  const [row] = await db
    .insert(providers)
    .values({ profileId: profile.id, ...values })
    .returning();
  return mapProvider(row);
}

export async function deleteProvider(id: string): Promise<void> {
  if (!db) {
    store.profile.providers = store.profile.providers.filter(
      (p) => p.id !== id,
    );
    // Mirror the DB's ON DELETE SET NULL on tasks.provider_id.
    for (const t of store.tasks) {
      if (t.providerId === id) t.providerId = null;
    }
    return;
  }
  await db.delete(providers).where(eq(providers.id, id));
}

// ── Pre-fill ────────────────────────────────────────────────────────────
// Turn profile memory into a seeded prep list. Each timingDefaults entry
// (e.g. hair: 4) becomes an unbooked appointment at that offset, attached to
// the saved provider for that category when one exists. Returns insert-ready
// seeds (no id/eventId) so both backends can consume them. The one-tap
// "already booked" path lives on the task card's status control, not here.

const CATEGORY_LABELS: Record<string, string> = {
  hair: "Hair",
  nails: "Nails",
  brows: "Brows",
};

function labelFor(category: string): string {
  return (
    CATEGORY_LABELS[category] ??
    category.charAt(0).toUpperCase() + category.slice(1)
  );
}

interface PrefillSeed {
  type: "appointment";
  title: string;
  offsetDays: number;
  hardDate: null;
  scheduledAt: null;
  status: "needs_booking";
  providerId: string | null;
  link: null;
  notes: null;
}

function buildPrefillTasks(profile: Profile): PrefillSeed[] {
  return Object.entries(profile.timingDefaults).map(
    ([category, offsetDays]) => {
      const provider = profile.providers.find((p) => p.category === category);
      return {
        type: "appointment" as const,
        title: labelFor(category),
        offsetDays,
        hardDate: null,
        scheduledAt: null,
        status: "needs_booking" as const,
        providerId: provider?.id ?? null,
        link: null,
        notes: null,
      };
    },
  );
}
