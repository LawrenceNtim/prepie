import { describe, expect, it } from "vitest";
import {
  addProvider,
  createEvent,
  createEventWithPrefill,
  createTask,
  deleteProvider,
  getProfile,
  updateProfile,
} from "./data";

// These run against the in-memory mock backend (no DATABASE_URL in the test
// env, so `db` is null). The globalThis-pinned store is shared across tests
// in this process — assert on returned objects, never on store totals.

describe("createTask status derivation", () => {
  it("books an appointment created with a real slot", async () => {
    const event = await createEvent({
      title: "Test event",
      type: "other",
      eventDate: "2026-08-01",
    });
    const task = await createTask({
      eventId: event.id,
      type: "appointment",
      title: "Hair",
      scheduledAt: "2026-07-28T14:30:00.000Z",
    });
    expect(task.status).toBe("booked");
    expect(task.scheduledAt).toBe("2026-07-28T14:30:00.000Z");
  });

  it("still defaults appointments without a slot to needs_booking", async () => {
    const event = await createEvent({
      title: "Test event 2",
      type: "other",
      eventDate: "2026-08-01",
    });
    const task = await createTask({
      eventId: event.id,
      type: "appointment",
      title: "Nails",
      offsetDays: 3,
    });
    expect(task.status).toBe("needs_booking");
  });

  it("ignores scheduledAt for acquisitions", async () => {
    const event = await createEvent({
      title: "Test event 3",
      type: "other",
      eventDate: "2026-08-01",
    });
    const task = await createTask({
      eventId: event.id,
      type: "acquisition",
      title: "Shoes",
      scheduledAt: "2026-07-28T14:30:00.000Z",
    });
    expect(task.status).toBe("to_get");
  });
});

describe("profile editing", () => {
  it("updates timing defaults", async () => {
    const before = await getProfile();
    const updated = await updateProfile({
      timingDefaults: { ...before.timingDefaults, massage: 2 },
    });
    expect(updated.timingDefaults.massage).toBe(2);
  });

  it("updates sizes and display name, trimming and nulling blanks", async () => {
    const updated = await updateProfile({
      displayName: "  Lawrence  ",
      shoeSize: "  ",
    });
    expect(updated.displayName).toBe("Lawrence");
    expect(updated.shoeSize).toBeNull();
  });

  it("adds and deletes a provider", async () => {
    const provider = await addProvider({
      name: "Test Salon",
      category: "massage",
    });
    expect(provider.id).toBeTruthy();
    expect((await getProfile()).providers.map((p) => p.id)).toContain(
      provider.id,
    );

    await deleteProvider(provider.id);
    expect((await getProfile()).providers.map((p) => p.id)).not.toContain(
      provider.id,
    );
  });
});

describe("occasion qualifiers", () => {
  it("stores normalized qualifiers and seeds template items after prefill", async () => {
    const { event, tasks } = await createEventWithPrefill({
      title: "Cabo",
      type: "vacation",
      eventDate: "2026-09-01",
      qualifiers: [" Beach ", "beach"],
    });
    expect(event.qualifiers).toEqual(["beach"]);

    const titles = tasks.map((t) => t.title);
    // profile prefill still present (mock profile: hair/nails/brows)
    expect(titles).toContain("Hair");
    // beach template acquisitions arrive
    expect(titles).toContain("Sunscreen");
    // beach's Pedicure appointment is SKIPPED: providerCategory "nails" is
    // already covered by the profile's timingDefaults
    expect(titles).not.toContain("Pedicure");
    // no duplicate normalized titles
    const norm = titles.map((t) => t.trim().toLowerCase());
    expect(new Set(norm).size).toBe(norm.length);
    // category label lands in notes for v1
    expect(tasks.find((t) => t.title === "Sunscreen")?.notes).toBe("shopping");
  });

  it("tombstoned template seeds nothing beyond prefill", async () => {
    await updateProfile({ templates: { beach: [] } });
    const { tasks } = await createEventWithPrefill({
      title: "Cabo 2",
      type: "vacation",
      eventDate: "2026-09-02",
      qualifiers: ["beach"],
    });
    expect(tasks.map((t) => t.title)).not.toContain("Sunscreen");
    // clean up the override so other tests see the starter set
    await updateProfile({ templates: {} });
  });

  it("events created without qualifiers get an empty list", async () => {
    const event = await createEvent({
      title: "Plain",
      type: "other",
      eventDate: "2026-09-03",
    });
    expect(event.qualifiers).toEqual([]);
  });
});
