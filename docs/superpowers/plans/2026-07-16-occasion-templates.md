# Occasion Qualifiers + Editable Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tag events with qualifiers (beach, formal, work trip…) whose templates seed both suggested appointments and shopping/packing/errand items at event creation — shipped as a built-in starter set, editable on `/profile`.

**Architecture:** A new pure module `src/lib/templates.ts` owns the starter set and all merge/seed logic (fully unit-tested). Storage rides the existing jsonb-on-profile pattern: `profiles.templates` holds user overrides only (override key wins wholesale; empty list = tombstone), `events.qualifiers` holds the event's tags. Seeding extends `createEventWithPrefill` through the dual-backend seam. UI is plain server-component forms, matching the profile page idiom.

**Tech Stack:** Next.js 14 App Router, Drizzle jsonb columns, Vitest, no new dependencies.

## Global Constraints

- App lives in `prepie/`; run all `npm` commands from `"/Users/Shared/Dev/prepie project/prepie"`.
- Dual-backend seam: every `data.ts` function keeps `if (!db)` → in-memory store, else Drizzle — identical signatures and semantics.
- Any page that reads via `@/lib/data` MUST carry `export const dynamic = "force-dynamic"` (build-time DB queries previously broke prod builds).
- `src/lib/timing.ts` must not change — template items only produce `offsetDays`.
- Tests must pass with no env vars set (mock backend). Current suite: 19 green.
- No new dependencies. Match existing Tailwind token classes (`bg-paper`, `bg-surface`, `rounded-card`, `font-display`, `text-muted`, `border-accent`, `accent-soft`).
- **Do NOT run `db:push` in any task** (prod `DATABASE_URL` is broken; local is empty — push happens via the user's `setup:db`). `db:generate` only, best-effort.
- Qualifier keys are normalized lowercase-trimmed strings everywhere.
- Commit messages: imperative subject + body; end with trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Use `git commit -F <file>` with a message file under `.superpowers/sdd/` if heredocs misbehave.

---

### Task 1: Pure template layer (types + `templates.ts`, TDD)

New domain types and a pure module: the starter set, `normalizeTitle`, `effectiveTemplates` (merge with tombstones), `buildTemplateTasks` (dedup + provider linking). New fields on `Profile`/`PrepEvent` are **optional** so no other file needs edits in this task.

**Files:**
- Modify: `prepie/src/types/index.ts`
- Create: `prepie/src/lib/templates.ts`
- Test: `prepie/src/lib/templates.test.ts`

**Interfaces:**
- Consumes: existing `TaskType`, `Profile`, `Provider` types.
- Produces (used by Tasks 2–4):
  - Types: `TemplateCategory`, `TemplateItem`, `TemplateMap`; `Profile.templates?: TemplateMap`; `PrepEvent.qualifiers?: string[]`.
  - `STARTER_TEMPLATES: TemplateMap` (8 qualifiers).
  - `normalizeTitle(title: string): string`
  - `effectiveTemplates(starter: TemplateMap, overrides: TemplateMap): TemplateMap`
  - `interface SeededDescriptor { type: TaskType; title: string; providerCategory?: string | null }`
  - `interface TaskSeed { type: TaskType; title: string; offsetDays: number | null; hardDate: null; scheduledAt: null; status: "needs_booking" | "to_get"; providerId: string | null; link: null; notes: string | null }`
  - `buildTemplateTasks(qualifiers: string[], templates: TemplateMap, profile: Pick<Profile, "providers" | "timingDefaults">, alreadySeeded?: ReadonlyArray<SeededDescriptor>): TaskSeed[]`

- [ ] **Step 1: Add the types**

In `prepie/src/types/index.ts`, append after the `Task` interface:

```ts
// ── Occasion templates ──────────────────────────────────────────────────
// A qualifier ("beach", "formal", …) maps to template items that seed a new
// event's runway: appointments (linked to saved providers by category) and
// acquisitions (grouped by a shopping/packing/errands/prep label).

export type TemplateCategory = "shopping" | "packing" | "errands" | "prep";

export interface TemplateItem {
  type: TaskType;
  title: string;
  offsetDays?: number | null; // days before the event (advisory)
  providerCategory?: string | null; // appointments: link saved provider by category
  category?: TemplateCategory | null; // acquisitions: list grouping label
  notes?: string | null;
}

// Keyed by normalized qualifier name. On the profile this stores USER
// OVERRIDES only; the effective view merges the built-in starter set
// (see lib/templates.ts). An empty list is a tombstone that hides a
// starter qualifier.
export type TemplateMap = Record<string, TemplateItem[]>;
```

And extend the two interfaces (add one line each):
- In `Profile`, after `timingDefaults`: `templates?: TemplateMap;`
- In `PrepEvent`, after `location`: `qualifiers?: string[];`

- [ ] **Step 2: Write the failing tests**

Create `prepie/src/lib/templates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Profile, TemplateMap } from "@/types";
import {
  STARTER_TEMPLATES,
  buildTemplateTasks,
  effectiveTemplates,
  normalizeTitle,
} from "./templates";

const profile: Pick<Profile, "providers" | "timingDefaults"> = {
  providers: [
    { id: "prov-nails", name: "Olive & June", category: "nails" },
    { id: "prov-tailor", name: "Stitch House", category: "tailor" },
  ],
  timingDefaults: { hair: 4, nails: 3 },
};

describe("normalizeTitle", () => {
  it("trims, lowercases, collapses whitespace", () => {
    expect(normalizeTitle("  Buy   Sunscreen ")).toBe("buy sunscreen");
  });
});

describe("STARTER_TEMPLATES", () => {
  it("ships the eight agreed qualifiers", () => {
    expect(Object.keys(STARTER_TEMPLATES).sort()).toEqual(
      [
        "adventure",
        "beach",
        "casual",
        "city trip",
        "formal",
        "staycation",
        "winter",
        "work trip",
      ].sort(),
    );
  });
});

describe("effectiveTemplates", () => {
  it("passes the starter set through untouched", () => {
    const eff = effectiveTemplates(STARTER_TEMPLATES, {});
    expect(eff.beach).toEqual(STARTER_TEMPLATES.beach);
  });

  it("replaces a starter key wholesale with the override", () => {
    const overrides: TemplateMap = {
      beach: [{ type: "acquisition", title: "Only this" }],
    };
    const eff = effectiveTemplates(STARTER_TEMPLATES, overrides);
    expect(eff.beach).toEqual(overrides.beach);
  });

  it("drops tombstoned (empty) keys", () => {
    const eff = effectiveTemplates(STARTER_TEMPLATES, { beach: [] });
    expect(eff.beach).toBeUndefined();
  });

  it("includes user-created qualifiers", () => {
    const eff = effectiveTemplates(STARTER_TEMPLATES, {
      "dj gig": [{ type: "acquisition", title: "USB sticks" }],
    });
    expect(eff["dj gig"]).toHaveLength(1);
  });

  it("never mutates the starter constant", () => {
    const before = JSON.stringify(STARTER_TEMPLATES);
    const eff = effectiveTemplates(STARTER_TEMPLATES, { beach: [] });
    eff["city trip"]?.push({ type: "acquisition", title: "mutation" });
    expect(JSON.stringify(STARTER_TEMPLATES)).toBe(before);
  });
});

describe("buildTemplateTasks", () => {
  it("returns [] for no qualifiers or unknown qualifiers", () => {
    const eff = effectiveTemplates(STARTER_TEMPLATES, {});
    expect(buildTemplateTasks([], eff, profile)).toEqual([]);
    expect(buildTemplateTasks(["spelunking"], eff, profile)).toEqual([]);
  });

  it("derives status by type and carries category into notes", () => {
    const templates: TemplateMap = {
      beach: [
        { type: "acquisition", title: "Sunscreen", offsetDays: 7, category: "shopping" },
        { type: "appointment", title: "Massage", offsetDays: 2, providerCategory: "massage" },
      ],
    };
    const seeds = buildTemplateTasks(["beach"], templates, profile);
    expect(seeds).toHaveLength(2);
    expect(seeds[0]).toMatchObject({ status: "to_get", notes: "shopping", offsetDays: 7 });
    expect(seeds[1]).toMatchObject({ status: "needs_booking", providerId: null });
  });

  it("links providers by category", () => {
    const templates: TemplateMap = {
      formal: [{ type: "appointment", title: "Alterations", providerCategory: "tailor" }],
    };
    const seeds = buildTemplateTasks(["formal"], templates, profile);
    expect(seeds[0].providerId).toBe("prov-tailor");
  });

  it("dedupes by normalized title across qualifiers", () => {
    const templates: TemplateMap = {
      a: [{ type: "acquisition", title: "Sunscreen" }],
      b: [{ type: "acquisition", title: "  sunscreen " }],
    };
    expect(buildTemplateTasks(["a", "b"], templates, profile)).toHaveLength(1);
  });

  it("skips appointments whose providerCategory the user already covers", () => {
    const templates: TemplateMap = {
      formal: [
        { type: "appointment", title: "Blowout", providerCategory: "hair" }, // in timingDefaults
        { type: "appointment", title: "Pedicure", providerCategory: "nails" }, // in timingDefaults
        { type: "appointment", title: "Alterations", providerCategory: "tailor" }, // not covered
      ],
    };
    const seeds = buildTemplateTasks(["formal"], templates, profile);
    expect(seeds.map((s) => s.title)).toEqual(["Alterations"]);
  });

  it("respects alreadySeeded titles and categories", () => {
    const templates: TemplateMap = {
      beach: [
        { type: "acquisition", title: "Sunscreen" },
        { type: "appointment", title: "Wax", providerCategory: "wax" },
      ],
    };
    const seeds = buildTemplateTasks(["beach"], templates, profile, [
      { type: "acquisition", title: "SUNSCREEN" },
      { type: "appointment", title: "Waxing", providerCategory: "wax" },
    ]);
    expect(seeds).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./templates`. (The 19 existing tests stay green.)

- [ ] **Step 4: Implement `templates.ts`**

Create `prepie/src/lib/templates.ts`:

```ts
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — new templates suite + all 19 existing.

- [ ] **Step 6: Commit**

```bash
cd "/Users/Shared/Dev/prepie project" && git add prepie/src/types/index.ts prepie/src/lib/templates.ts prepie/src/lib/templates.test.ts
git commit -m "Add the pure occasion-template layer

Starter set for eight qualifiers, override merge with empty-list
tombstones, and the dedup/provider-linking seed builder. Profile and
PrepEvent gain optional templates/qualifiers fields."
```

---

### Task 2: Schema + data seam (TDD)

Two jsonb columns and the wiring: events persist qualifiers, `createEventWithPrefill` appends template seeds, `updateProfile` accepts template overrides.

**Files:**
- Modify: `prepie/src/lib/db/schema.ts`
- Modify: `prepie/src/lib/data.ts`
- Test: `prepie/src/lib/data.test.ts` (additions)

**Interfaces:**
- Consumes (Task 1): `STARTER_TEMPLATES`, `effectiveTemplates`, `buildTemplateTasks`, `labelFor` (already in data.ts), types `TemplateMap`.
- Produces (used by Tasks 3–4): `CreateEventInput.qualifiers?: string[]` honored by `createEvent`/`createEventWithPrefill` (normalized lowercase, trimmed, deduped; stored on the event; template items seeded after profile prefill); `UpdateProfileInput.templates?: TemplateMap` honored by `updateProfile`; `mapProfile`/`mapEvent` populate the new fields.

- [ ] **Step 1: Write the failing tests**

Append to `prepie/src/lib/data.test.ts` (and merge `createEventWithPrefill` into the existing `./data` import statement):

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `event.qualifiers` is `undefined`, template titles missing.

- [ ] **Step 3: Schema columns**

In `prepie/src/lib/db/schema.ts`: add to the imports `import type { TemplateItem } from "@/types";` then add one column to each table:

In `profiles`, after `timingDefaults`:

```ts
  // User overrides for occasion templates; starter set merges in at read
  // time (lib/templates.ts). Empty list = tombstone hiding a starter key.
  templates: jsonb("templates")
    .$type<Record<string, TemplateItem[]>>()
    .default({})
    .notNull(),
```

In `events`, after `location`:

```ts
  qualifiers: jsonb("qualifiers").$type<string[]>().default([]).notNull(),
```

- [ ] **Step 4: Wire the data seam**

In `prepie/src/lib/data.ts`:

4a. Extend imports:

```ts
import {
  STARTER_TEMPLATES,
  buildTemplateTasks,
  effectiveTemplates,
} from "./templates";
import type { TemplateMap } from "@/types";
```

4b. `mapProfile` gains `templates: r.templates,` (after `timingDefaults`); `mapEvent` gains `qualifiers: r.qualifiers,` (after `location`).

4c. `ensureProfile`'s insert values gain `templates: seed.templates ?? {},`.

4d. Add a local helper above `createEvent`:

```ts
function normalizeQualifiers(qualifiers: string[] | undefined): string[] {
  return [
    ...new Set(
      (qualifiers ?? []).map((q) => q.trim().toLowerCase()).filter(Boolean),
    ),
  ];
}
```

4e. `CreateEventInput` gains `qualifiers?: string[];`. In `createEvent`, compute `const qualifiers = normalizeQualifiers(input.qualifiers);` and include `qualifiers` in BOTH the mock object literal and the db `.values({...})`.

4f. `createEventWithPrefill`, both branches: compute `qualifiers` the same way and persist it on the event; after `buildPrefillTasks(profile)` (or the `seeds` const in the DB branch), append template seeds:

```ts
  const prefillSeeds = buildPrefillTasks(profile);
  const templateSeeds = buildTemplateTasks(
    qualifiers,
    effectiveTemplates(STARTER_TEMPLATES, profile.templates ?? {}),
    profile,
    Object.keys(profile.timingDefaults).map((category) => ({
      type: "appointment" as const,
      title: labelFor(category),
      providerCategory: category,
    })),
  );
  const seeds = [...prefillSeeds, ...templateSeeds];
```

(`labelFor` already exists at the bottom of data.ts; move nothing — the helper is file-local and hoisted via function declaration.) In the MOCK branch the profile variable is `store.profile` (there is no `profile` const — adapt the snippet accordingly); the DB branch already has `const profile = await ensureProfile()`. The mock branch maps `seeds` into store tasks exactly as it maps prefill today; the DB branch inserts `seeds` exactly as it inserts prefill today.

4g. `UpdateProfileInput` gains `templates?: TemplateMap;` and `updateProfile` handles it in both branches exactly like `timingDefaults`:

- mock: `if (patch.templates !== undefined) p.templates = patch.templates;`
- DB: `if (patch.templates !== undefined) set.templates = patch.templates;`

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test` → Expected: PASS (all suites). Then `npm run build` → Expected: succeeds.

- [ ] **Step 6: Generate the migration (best-effort, no DB needed)**

Run: `npm run db:generate`
Expected: a new SQL file under `prepie/drizzle/` adding both columns. If drizzle-kit demands a `DATABASE_URL` and fails, skip and note it in your report — `db:push` (run later by the user's `setup:db`) derives from the schema directly. **Never run `db:push` in this task.**

- [ ] **Step 7: Commit**

```bash
cd "/Users/Shared/Dev/prepie project" && git add prepie/src/lib/db/schema.ts prepie/src/lib/data.ts prepie/src/lib/data.test.ts prepie/drizzle
git commit -m "Persist event qualifiers and seed template items on create

profiles.templates and events.qualifiers jsonb columns; createEvent and
createEventWithPrefill store normalized qualifiers and append deduped
template seeds after the profile prefill, both backends identically."
```

---

### Task 3: Profile "Occasion templates" section

Editable templates on `/profile`: per-qualifier cards with item rows, copy-on-write edits, tombstone deletes, and an add-qualifier form that requires the first item.

**Files:**
- Modify: `prepie/src/app/actions.ts`
- Modify: `prepie/src/app/profile/page.tsx`

**Interfaces:**
- Consumes: `updateProfile`, `getProfile` (data seam); `STARTER_TEMPLATES`, `effectiveTemplates` from `@/lib/templates`; `TemplateItem` type.
- Produces: server actions `saveTemplateItemAction(qualifier: string, formData: FormData)`, `removeTemplateItemAction(qualifier: string, index: number)`, `addQualifierAction(formData: FormData)`, `deleteQualifierAction(qualifier: string)`.

- [ ] **Step 1: Add the server actions**

In `prepie/src/app/actions.ts`, add to the imports:

```ts
import { STARTER_TEMPLATES, effectiveTemplates } from "@/lib/templates";
import type { EventType, TaskStatus, TaskType, TemplateItem } from "@/types";
```

(The second line REPLACES the existing `@/types` import line, adding `TemplateItem`.) Append at the end of the file:

```ts
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
```

- [ ] **Step 2: Add the page section**

In `prepie/src/app/profile/page.tsx`:

2a. Extend imports:

```tsx
import { STARTER_TEMPLATES, effectiveTemplates } from "@/lib/templates";
import {
  addProviderAction,
  addQualifierAction,
  deleteProviderAction,
  deleteQualifierAction,
  removeTemplateItemAction,
  removeTimingDefaultAction,
  saveTemplateItemAction,
  saveTimingDefaultAction,
  updateProfileAction,
} from "@/app/actions";
```

2b. Inside the component, after the `defaults` const:

```tsx
  const templates = Object.entries(
    effectiveTemplates(STARTER_TEMPLATES, profile.templates ?? {}),
  ).sort(([a], [b]) => a.localeCompare(b));
```

2c. Append a new section before `</main>` (after the Providers section):

```tsx
      {/* ── Occasion templates ── */}
      <section className="mt-6 rounded-card border bg-surface p-5">
        <h2 className="font-display text-lg">Occasion templates</h2>
        <p className="mt-1 text-sm text-muted">
          Tag a new event with these and prepie seeds the runway with each
          template&rsquo;s items — appointments and things to get.
        </p>

        <div className="mt-4 space-y-4">
          {templates.map(([qualifier, items]) => (
            <div key={qualifier} className="rounded-md border bg-paper p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium capitalize">{qualifier}</h3>
                <form action={deleteQualifierAction.bind(null, qualifier)}>
                  <button
                    type="submit"
                    aria-label={`Delete ${qualifier} template`}
                    className="text-[13px] text-muted underline decoration-line underline-offset-4 hover:decoration-accent"
                  >
                    Delete template
                  </button>
                </form>
              </div>

              <ul className="mt-3 space-y-1.5">
                {items.map((item, index) => (
                  <li
                    key={`${item.type}-${item.title}-${index}`}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted">
                      {item.type === "appointment"
                        ? "appointment"
                        : (item.category ?? "to get")}
                    </span>
                    <span>{item.title}</span>
                    <span className="text-muted">
                      {item.offsetDays != null ? `−${item.offsetDays}d` : ""}
                      {item.providerCategory ? ` · ${item.providerCategory}` : ""}
                    </span>
                    <form
                      action={removeTemplateItemAction.bind(null, qualifier, index)}
                      className="ml-auto"
                    >
                      <button
                        type="submit"
                        aria-label={`Remove ${item.title} from ${qualifier}`}
                        className="text-[13px] text-muted underline decoration-line underline-offset-4 hover:decoration-accent"
                      >
                        Remove
                      </button>
                    </form>
                  </li>
                ))}
              </ul>

              <form
                action={saveTemplateItemAction.bind(null, qualifier)}
                className="mt-3 flex flex-wrap items-end gap-2"
              >
                <TemplateItemFields />
                <button
                  type="submit"
                  className="rounded-full bg-ink px-3 py-1.5 text-[13px] text-paper transition hover:bg-accent"
                >
                  Add item
                </button>
              </form>
            </div>
          ))}
        </div>

        <form action={addQualifierAction} className="mt-5 space-y-3 rounded-md border border-dashed p-4">
          <h3 className="text-sm font-medium">New template</h3>
          <label className="block max-w-56">
            <span className="mb-1.5 block text-sm font-medium">Occasion</span>
            <input name="qualifier" required placeholder="dj gig" className={inputClass} />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <TemplateItemFields />
            <button
              type="submit"
              className="rounded-full bg-ink px-3 py-1.5 text-[13px] text-paper transition hover:bg-accent"
            >
              Add template
            </button>
          </div>
          <p className="text-[13px] text-muted">
            Starts with its first item — add more once it exists.
          </p>
        </form>
      </section>
```

2d. Add this server-side helper component at the bottom of the file (after the default export):

```tsx
// Shared inputs for a template item; used by both the per-qualifier
// add-item form and the new-template form.
function TemplateItemFields() {
  return (
    <>
      <label className="block w-36">
        <span className="mb-1.5 block text-[13px] font-medium">Type</span>
        <select name="itemType" defaultValue="acquisition" className={inputClass}>
          <option value="acquisition">Acquire</option>
          <option value="appointment">Appointment</option>
        </select>
      </label>
      <label className="block flex-1 min-w-40">
        <span className="mb-1.5 block text-[13px] font-medium">Item</span>
        <input name="itemTitle" required placeholder="Sunscreen" className={inputClass} />
      </label>
      <label className="block w-28">
        <span className="mb-1.5 block text-[13px] font-medium">Days before</span>
        <input name="offsetDays" type="number" min={0} placeholder="7" className={inputClass} />
      </label>
      <label className="block w-36">
        <span className="mb-1.5 block text-[13px] font-medium">Category</span>
        <select name="category" defaultValue="" className={inputClass}>
          <option value="">—</option>
          <option value="shopping">Shopping</option>
          <option value="packing">Packing</option>
          <option value="errands">Errands</option>
          <option value="prep">Prep</option>
        </select>
      </label>
      <label className="block w-36">
        <span className="mb-1.5 block text-[13px] font-medium">Provider cat.</span>
        <input name="providerCategory" placeholder="hair" className={inputClass} />
      </label>
    </>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm test` (all green) and `npm run build` (clean; `/profile` still ƒ Dynamic).
Manual (mock mode, `npm run dev`): /profile shows 8 starter cards; add an item to `beach` (copy-on-write), remove it; Delete template on `beach` hides the card; create a new template ("dj gig" + first item) and see its card. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
cd "/Users/Shared/Dev/prepie project" && git add prepie/src/app/actions.ts prepie/src/app/profile/page.tsx
git commit -m "Add the occasion-templates editor to the profile page

Per-qualifier cards over the effective (starter + overrides) view with
copy-on-write edits, tombstone deletes for starter qualifiers, and an
add-template form that requires the first item."
```

---

### Task 4: Create-event chips + event-page chips

Qualifier selection at event creation (CSS-only checkbox chips, zero client JS) and display chips on the runway page.

**Files:**
- Modify: `prepie/src/app/actions.ts` (createEventAction reads qualifiers, ~line 17)
- Modify: `prepie/src/app/events/new/page.tsx`
- Modify: `prepie/src/app/events/[id]/page.tsx`

**Interfaces:**
- Consumes: `CreateEventInput.qualifiers` (Task 2); `getProfile`, `effectiveTemplates`, `STARTER_TEMPLATES`.
- Produces: no new exports.

- [ ] **Step 1: Forward qualifiers through `createEventAction`**

In `prepie/src/app/actions.ts`, inside `createEventAction`, after the `type` const add:

```ts
  const qualifiers = formData
    .getAll("qualifiers")
    .map((q) => String(q).trim().toLowerCase())
    .filter(Boolean);
```

and extend the `createEventWithPrefill` argument with `qualifiers,` (after `location`).

- [ ] **Step 2: Chips on the create form**

In `prepie/src/app/events/new/page.tsx`:

2a. Replace the top of the file (imports + component signature) so the page reads the profile and never prerenders:

```tsx
import Link from "next/link";
import { createEventAction } from "@/app/actions";
import { getProfile } from "@/lib/data";
import { STARTER_TEMPLATES, effectiveTemplates } from "@/lib/templates";

// Data lives in the DB (or the process-local mock) — never prerender at
// build time, where DATABASE_URL may be set and queried from the builder.
export const dynamic = "force-dynamic";

// On submit this calls createEventAction, which seeds the new event with your
// usual prep (from profile.timingDefaults + saved providers) plus the items
// from any occasion templates you tag it with. The one-tap "already booked"
// path lives on each seeded card's status control.
export default async function NewEventPage() {
  const profile = await getProfile();
  const qualifiers = Object.keys(
    effectiveTemplates(STARTER_TEMPLATES, profile.templates ?? {}),
  ).sort();
```

(The old top comment and `export default function NewEventPage() {` line are replaced; the `return (` and everything inside stays until the edits below.)

2b. After the `Type` select label's closing `</label>` and before the accent info `<div>`, insert the chips group:

```tsx
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium">
            Occasion templates
          </legend>
          <p className="mb-2 text-[13px] text-muted">
            Tag the event and prepie seeds each template&rsquo;s prep. Edit
            them on your profile.
          </p>
          <div className="flex flex-wrap gap-2">
            {qualifiers.map((q) => (
              <label key={q} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="qualifiers"
                  value={q}
                  className="peer sr-only"
                />
                <span className="inline-block rounded-full border px-3 py-1 text-[13px] capitalize text-muted transition peer-checked:border-accent peer-checked:bg-accent-soft/40 peer-checked:text-accent">
                  {q}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
```

- [ ] **Step 3: Chips on the event page**

In `prepie/src/app/events/[id]/page.tsx`, inside the `<header>`, replace the single type `<span>` block:

```tsx
        <span className="text-[11px] uppercase tracking-wider text-muted">
          {event.type.replace("_", " ")}
        </span>
```

with:

```tsx
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-muted">
            {event.type.replace("_", " ")}
          </span>
          {(event.qualifiers ?? []).map((q) => (
            <span
              key={q}
              className="rounded-full border bg-paper px-2 py-0.5 text-[11px] capitalize text-muted"
            >
              {q}
            </span>
          ))}
        </div>
```

- [ ] **Step 4: Verify**

Run: `npm test` (green) and `npm run build` — Expected: clean, AND the route list now shows `/events/new` as **ƒ (Dynamic)**.
Manual (mock mode): create an event tagged `beach` + `formal` → runway shows prefill + template union with no duplicate titles; Sunscreen card shows "shopping" in its notes line; event header shows both chips. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
cd "/Users/Shared/Dev/prepie project" && git add prepie/src/app/actions.ts prepie/src/app/events/new/page.tsx "prepie/src/app/events/[id]/page.tsx"
git commit -m "Select occasion templates at event creation, show chips

CSS-only checkbox chips on the create form (page goes force-dynamic —
it now reads the profile) and qualifier chips in the event header."
```

---

### Task 5: Docs + final verification

**Files:**
- Modify: `docs/SPRINT_STATE.md` (repo root)
- Modify: `README.md` (repo root), `prepie/README.md`

**Interfaces:** none — docs only.

- [ ] **Step 1: SPRINT_STATE.md**

- In §4 "What's built", add: `occasion templates (qualifier chips → seeded appointments + shopping/packing items, editable on /profile)` and REMOVE "occasion templates" from the "Not built" list.
- In the idea-backlog block (§5.5), mark both ideas as shipped in v1 form, and add a follow-up line: `Follow-up: "apply a template to an existing event" (needs idempotent re-seed against live tasks).`
- Add to §2 or a new note: `Schema delta pending on prod: profiles.templates + events.qualifiers land with the next db:push (setup:db runs it).`

- [ ] **Step 2: READMEs**

Root `README.md`: in "What's built", add `Occasion templates: tag an event (beach, formal, work trip…) → runway seeds that template's appointments and to-gets; starter set editable on /profile.` Remove "occasion templates" from the "Still P1" line. In `prepie/README.md`, mirror the same one-liner under scope/what's-built and note `lib/templates.ts` in the code map.

- [ ] **Step 3: Final verification + commit + push**

```bash
cd "/Users/Shared/Dev/prepie project/prepie" && npm test && npm run build
cd "/Users/Shared/Dev/prepie project" && git add docs/SPRINT_STATE.md README.md prepie/README.md
git commit -m "Document occasion templates in sprint doc and READMEs"
git push origin main
```

Expected: all tests green, clean build, push succeeds.

**Deploy note (controller):** do NOT deploy to a DB-mode environment until `db:push` has added the two columns — the user's pending `npm run setup:db` run does exactly that and then redeploys.
