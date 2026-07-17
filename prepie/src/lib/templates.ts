import type { Profile, TaskType, TemplateItem, TemplateMap } from "@/types";

// ── Occasion templates ──────────────────────────────────────────────────
// Pure module: no store, no db. The starter set ships in code;
// profiles.templates stores user OVERRIDES keyed by qualifier — an
// override replaces the starter list wholesale, and an empty list is a
// tombstone that hides a starter qualifier. lib/data.ts consumes
// buildTemplateTasks when seeding a new event's runway.

export const STARTER_TEMPLATES: TemplateMap = {
  "city trip": [
    { type: "acquisition", title: "Comfortable walking shoes", offsetDays: 14, category: "shopping" },
    { type: "acquisition", title: "Book attraction tickets", offsetDays: 7, category: "prep" },
    { type: "acquisition", title: "Day bag", offsetDays: 10, category: "shopping" },
    { type: "acquisition", title: "Pack day-to-night outfits", offsetDays: 2, category: "packing" },
  ],
  winter: [
    { type: "acquisition", title: "Thermal layers", offsetDays: 14, category: "shopping" },
    { type: "acquisition", title: "Gloves and beanie", offsetDays: 10, category: "shopping" },
    { type: "acquisition", title: "Lip balm and heavy moisturizer", offsetDays: 7, category: "shopping" },
    { type: "acquisition", title: "Pack coats and boots", offsetDays: 2, category: "packing" },
  ],
  beach: [
    { type: "appointment", title: "Pedicure", offsetDays: 3, providerCategory: "nails" },
    { type: "appointment", title: "Wax", offsetDays: 5, providerCategory: "wax" },
    { type: "acquisition", title: "Sunscreen", offsetDays: 7, category: "shopping" },
    { type: "acquisition", title: "Swimsuit", offsetDays: 14, category: "shopping" },
    { type: "acquisition", title: "Pack beach bag", offsetDays: 2, category: "packing" },
  ],
  formal: [
    { type: "appointment", title: "Alterations", offsetDays: 10, providerCategory: "tailor" },
    { type: "acquisition", title: "Outfit", offsetDays: 21, category: "shopping" },
    { type: "acquisition", title: "Shoes and accessories", offsetDays: 14, category: "shopping" },
    { type: "acquisition", title: "Steam or press outfit", offsetDays: 1, category: "prep" },
  ],
  casual: [
    { type: "acquisition", title: "Plan outfit", offsetDays: 2, category: "prep" },
    { type: "acquisition", title: "Check the weather", offsetDays: 1, category: "prep" },
  ],
  staycation: [
    { type: "acquisition", title: "Stock snacks and drinks", offsetDays: 1, category: "shopping" },
    { type: "acquisition", title: "Tidy the space", offsetDays: 1, category: "errands" },
    { type: "acquisition", title: "Queue shows and books", offsetDays: 2, category: "prep" },
  ],
  "work trip": [
    { type: "acquisition", title: "Prep materials", offsetDays: 2, category: "prep" },
    { type: "acquisition", title: "Pack business outfits", offsetDays: 2, category: "packing" },
    { type: "acquisition", title: "Chargers and adapters", offsetDays: 3, category: "packing" },
    { type: "acquisition", title: "Confirm travel bookings", offsetDays: 5, category: "errands" },
  ],
  adventure: [
    { type: "acquisition", title: "Gear check", offsetDays: 14, category: "shopping" },
    { type: "acquisition", title: "First-aid basics", offsetDays: 7, category: "shopping" },
    { type: "acquisition", title: "Download offline maps", offsetDays: 2, category: "prep" },
    { type: "acquisition", title: "Pack gear bag", offsetDays: 2, category: "packing" },
  ],
};

export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

// Merge starter + user overrides. Override key wins wholesale (a list is
// replaced, not item-merged). Keys whose merged list is empty are dropped —
// that's the tombstone that hides a starter qualifier. Arrays are copied so
// callers can never mutate STARTER_TEMPLATES through the result.
export function effectiveTemplates(
  starter: TemplateMap,
  overrides: TemplateMap,
): TemplateMap {
  const merged: TemplateMap = {};
  for (const [key, items] of Object.entries(starter)) merged[key] = [...items];
  for (const [key, items] of Object.entries(overrides)) merged[key] = [...items];
  for (const key of Object.keys(merged)) {
    if (merged[key].length === 0) delete merged[key];
  }
  return merged;
}

export interface SeededDescriptor {
  type: TaskType;
  title: string;
  providerCategory?: string | null;
}

// Insert-ready seed, same shape data.ts's PrefillSeed feeds both backends.
export interface TaskSeed {
  type: TaskType;
  title: string;
  offsetDays: number | null;
  hardDate: null;
  scheduledAt: null;
  status: "needs_booking" | "to_get";
  providerId: string | null;
  link: null;
  notes: string | null;
}

// Turn selected qualifiers into task seeds. First-wins dedupe:
//  - by (type, normalized title) against alreadySeeded and prior items;
//  - appointments are also skipped when their providerCategory is already
//    covered by profile.timingDefaults or an earlier seed (the user's own
//    offsets always win over template suggestions).
// Unknown qualifiers are silently ignored (stale chips after a template
// was deleted). Acquisition category labels surface via notes for v1.
export function buildTemplateTasks(
  qualifiers: string[],
  templates: TemplateMap,
  profile: Pick<Profile, "providers" | "timingDefaults">,
  alreadySeeded: ReadonlyArray<SeededDescriptor> = [],
): TaskSeed[] {
  const seeds: TaskSeed[] = [];
  const seenTitles = new Set(
    alreadySeeded.map((s) => `${s.type}:${normalizeTitle(s.title)}`),
  );
  const seenCategories = new Set<string>([
    ...Object.keys(profile.timingDefaults),
    ...alreadySeeded
      .map((s) => s.providerCategory)
      .filter((c): c is string => Boolean(c)),
  ]);

  for (const qualifier of qualifiers) {
    const items = templates[normalizeTitle(qualifier)];
    if (!items) continue;
    for (const item of items) {
      const titleKey = `${item.type}:${normalizeTitle(item.title)}`;
      if (seenTitles.has(titleKey)) continue;
      if (
        item.type === "appointment" &&
        item.providerCategory &&
        seenCategories.has(item.providerCategory)
      ) {
        continue;
      }
      seenTitles.add(titleKey);
      if (item.type === "appointment" && item.providerCategory) {
        seenCategories.add(item.providerCategory);
      }
      const provider = item.providerCategory
        ? profile.providers.find((p) => p.category === item.providerCategory)
        : undefined;
      seeds.push({
        type: item.type,
        title: item.title,
        offsetDays: item.offsetDays ?? null,
        hardDate: null,
        scheduledAt: null,
        status: item.type === "appointment" ? "needs_booking" : "to_get",
        providerId: provider?.id ?? null,
        link: null,
        notes: item.notes ?? item.category ?? null,
      });
    }
  }
  return seeds;
}
