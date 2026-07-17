"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addProvider,
  createEventWithPrefill,
  createTask,
  deleteProvider,
  getProfile,
  updateEvent,
  updateProfile,
  updateTask,
  type CreateTaskInput,
} from "@/lib/data";
import { STARTER_TEMPLATES, effectiveTemplates } from "@/lib/templates";
import type { EventType, TaskStatus, TaskType, TemplateItem } from "@/types";

// ── Create event (+ prefill) ────────────────────────────────────────────
// Used directly as a <form action>. Seeds the new event with the usual prep
// from profile memory, then drops the user onto the freshly built runway.
export async function createEventAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const eventDate = String(formData.get("eventDate") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const type = (String(formData.get("type") ?? "other") || "other") as EventType;

  if (!title || !eventDate) {
    throw new Error("An occasion and a date are required.");
  }

  const { event } = await createEventWithPrefill({
    title,
    type,
    eventDate,
    location: location || null,
  });

  revalidatePath("/");
  revalidatePath(`/events/${event.id}`);
  redirect(`/events/${event.id}`);
}

// ── Add a single task ───────────────────────────────────────────────────
// Bound with eventId on the form: addTaskAction.bind(null, eventId).
export async function addTaskAction(eventId: string, formData: FormData) {
  const type = (String(formData.get("type") ?? "appointment")) as TaskType;
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Give the task a name.");

  const offsetRaw = String(formData.get("offsetDays") ?? "").trim();
  const hardDate = String(formData.get("hardDate") ?? "").trim();
  const providerId = String(formData.get("providerId") ?? "").trim();
  const link = String(formData.get("link") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  // Full ISO datetime, converted from the datetime-local value client-side
  // (the browser knows the user's zone; the server does not).
  const scheduledAt = String(formData.get("scheduledAt") ?? "").trim();

  const input: CreateTaskInput = {
    eventId,
    type,
    title,
    offsetDays: offsetRaw ? Number(offsetRaw) : null,
    hardDate: hardDate || null,
    scheduledAt: scheduledAt || null,
    providerId: providerId || null,
    link: link || null,
    notes: notes || null,
  };

  await createTask(input);
  revalidatePath(`/events/${eventId}`);
}

// ── Update status (one-tap "already booked" path) ───────────────────────
// Called from the client status control. When an appointment is marked booked,
// the control passes the real slot (noon on the offset date) so "reality wins"
// and the card shows a booked slot + a timed .ics. Clearing back to an unbooked
// status drops the slot so the advisory offset takes over again.
export async function setTaskStatusAction(
  taskId: string,
  eventId: string,
  status: TaskStatus,
  scheduledAt: string | null = null,
) {
  await updateTask(taskId, { status, scheduledAt });
  revalidatePath(`/events/${eventId}`);
}

export async function updateEventDateAction(eventId: string, eventDate: string) {
  if (!eventDate) throw new Error("Event date is required.");
  await updateEvent(eventId, { eventDate });
  revalidatePath("/");
  revalidatePath(`/events/${eventId}`);
}

// ── Profile editing ─────────────────────────────────────────────────────

export async function updateProfileAction(formData: FormData) {
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!displayName) throw new Error("A display name is required.");
  await updateProfile({
    displayName,
    shoeSize: String(formData.get("shoeSize") ?? "").trim() || null,
    clothingSize: String(formData.get("clothingSize") ?? "").trim() || null,
  });
  revalidatePath("/profile");
}

// Upserts one timing default (e.g. hair → 4 days before the event).
export async function saveTimingDefaultAction(formData: FormData) {
  const category = String(formData.get("category") ?? "")
    .trim()
    .toLowerCase();
  const days = Number(String(formData.get("days") ?? "").trim());
  if (!category || !Number.isInteger(days) || days < 0) {
    throw new Error("A category and a non-negative whole number of days are required.");
  }
  const profile = await getProfile();
  await updateProfile({
    timingDefaults: { ...profile.timingDefaults, [category]: days },
  });
  revalidatePath("/profile");
}

export async function removeTimingDefaultAction(category: string) {
  const profile = await getProfile();
  const { [category]: _removed, ...rest } = profile.timingDefaults;
  await updateProfile({ timingDefaults: rest });
  revalidatePath("/profile");
}

export async function addProviderAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("A provider name is required.");
  await addProvider({
    name,
    category:
      String(formData.get("category") ?? "").trim().toLowerCase() || null,
    location: String(formData.get("location") ?? "").trim() || null,
  });
  revalidatePath("/profile");
}

export async function deleteProviderAction(id: string) {
  await deleteProvider(id);
  revalidatePath("/profile");
}

// ── Occasion templates ──────────────────────────────────────────────────
// Edits are copy-on-write against the EFFECTIVE view: the first edit to a
// starter qualifier copies its list into profile overrides, then mutates
// the copy. Deleting a starter qualifier writes an empty-list tombstone.

function parseTemplateItem(formData: FormData): TemplateItem {
  const type = String(formData.get("itemType") ?? "acquisition") as TaskType;
  const title = String(formData.get("itemTitle") ?? "").trim();
  if (!title) throw new Error("Give the item a title.");
  const offsetRaw = String(formData.get("offsetDays") ?? "").trim();
  const offsetDays = offsetRaw ? Number(offsetRaw) : null;
  if (offsetDays !== null && (!Number.isInteger(offsetDays) || offsetDays < 0)) {
    throw new Error("Days before must be a non-negative whole number.");
  }
  const providerCategory =
    String(formData.get("providerCategory") ?? "").trim().toLowerCase() || null;
  const category =
    (String(formData.get("category") ?? "").trim().toLowerCase() ||
      null) as TemplateItem["category"];
  return {
    type,
    title,
    offsetDays,
    providerCategory: type === "appointment" ? providerCategory : null,
    category: type === "acquisition" ? category : null,
    notes: null,
  };
}

async function writeTemplateList(qualifier: string, items: TemplateItem[]) {
  const profile = await getProfile();
  await updateProfile({
    templates: { ...(profile.templates ?? {}), [qualifier]: items },
  });
  revalidatePath("/profile");
}

export async function saveTemplateItemAction(
  qualifier: string,
  formData: FormData,
) {
  const item = parseTemplateItem(formData);
  const profile = await getProfile();
  const effective = effectiveTemplates(STARTER_TEMPLATES, profile.templates ?? {});
  await writeTemplateList(qualifier, [...(effective[qualifier] ?? []), item]);
}

export async function removeTemplateItemAction(
  qualifier: string,
  index: number,
) {
  const profile = await getProfile();
  const effective = effectiveTemplates(STARTER_TEMPLATES, profile.templates ?? {});
  const current = effective[qualifier] ?? [];
  if (index < 0 || index >= current.length) return; // stale index — ignore
  await writeTemplateList(qualifier, current.filter((_, i) => i !== index));
}

// New qualifiers require their first item in the same form — the merge
// drops empty lists (tombstones), so an empty-but-alive user qualifier
// cannot exist.
export async function addQualifierAction(formData: FormData) {
  const name = String(formData.get("qualifier") ?? "").trim().toLowerCase();
  if (!name) throw new Error("Name the occasion.");
  const item = parseTemplateItem(formData);
  const profile = await getProfile();
  const effective = effectiveTemplates(STARTER_TEMPLATES, profile.templates ?? {});
  await writeTemplateList(name, [...(effective[name] ?? []), item]);
}

export async function deleteQualifierAction(qualifier: string) {
  const profile = await getProfile();
  const overrides = { ...(profile.templates ?? {}) };
  if (qualifier in STARTER_TEMPLATES) {
    overrides[qualifier] = []; // tombstone hides the starter
  } else {
    delete overrides[qualifier];
  }
  await updateProfile({ templates: overrides });
  revalidatePath("/profile");
}
