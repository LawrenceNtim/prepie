import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  date,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Enums ──────────────────────────────────────────────────────────────
export const eventTypeEnum = pgEnum("event_type", [
  "vacation",
  "wedding_guest",
  "work_trip",
  "other",
]);

export const taskTypeEnum = pgEnum("task_type", ["appointment", "acquisition"]);

export const taskStatusEnum = pgEnum("task_status", [
  "needs_booking",
  "booked",
  "done",
  "to_get",
  "got",
]);

// ── Tables ─────────────────────────────────────────────────────────────

// Profile = the memory layer that sits above all events.
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(),
  shoeSize: text("shoe_size"),
  clothingSize: text("clothing_size"),
  // Usual lead times in days, e.g. { hair: 4, nails: 3 }.
  timingDefaults: jsonb("timing_defaults")
    .$type<Record<string, number>>()
    .default({})
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const providers = pgTable("providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .references(() => profiles.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  category: text("category"),
  location: text("location"),
  notes: text("notes"),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .references(() => profiles.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  type: eventTypeEnum("type").default("other").notNull(),
  eventDate: date("event_date").notNull(),
  location: text("location"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .references(() => events.id, { onDelete: "cascade" })
    .notNull(),
  type: taskTypeEnum("type").notNull(),
  title: text("title").notNull(),

  // Timing — precedence resolved in lib/timing.ts (scheduledAt → hardDate → offsetDays).
  offsetDays: integer("offset_days"),
  hardDate: date("hard_date"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),

  status: taskStatusEnum("status").default("needs_booking").notNull(),
  providerId: uuid("provider_id").references(() => providers.id, {
    onDelete: "set null",
  }),
  link: text("link"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Relations ──────────────────────────────────────────────────────────
export const profilesRelations = relations(profiles, ({ many }) => ({
  events: many(events),
  providers: many(providers),
}));

// The one() side is required for db.query.profiles.findFirst({ with:
// { providers: true } }) — without it Drizzle cannot infer the join and
// throws at runtime ("not enough information to infer relation").
export const providersRelations = relations(providers, ({ one }) => ({
  profile: one(profiles, {
    fields: [providers.profileId],
    references: [profiles.id],
  }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [events.profileId],
    references: [profiles.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  event: one(events, { fields: [tasks.eventId], references: [events.id] }),
  provider: one(providers, {
    fields: [tasks.providerId],
    references: [providers.id],
  }),
}));
