# prepie

**Calm prep for the moments that count.**

prepie fights one specific enemy: the *appointment-and-shopping olympics* in the
weeks before a trip, a wedding you're a guest at, or a work event. It isn't a
to-do app (infinite backlog). It's a **pre-event prep companion** — the unit is
the *occasion*, and everything hangs off its date.

---

## The model — three objects, one rule

- **Profile** — the memory layer, *above* events. Saved providers, sizes, and
  your usual timing offsets (`hair: 4, nails: 3, brows: 7`). Pre-fills the next
  event so you never start from blank.
- **PrepEvent** — the container. Has a date; owns tasks. Self-contained, so
  wedding-hair and vacation-hair in the same month never collide.
- **Task** — `type: "appointment" | "acquisition"`. Appointments have a
  lifecycle (`needs_booking → booked → done`); acquisitions are
  (`to_get → got`).

**The one rule (the heart of the app):** a task's effective date resolves in
strict priority —

```
scheduledAt  →  hardDate  →  offsetDays
 (reality)      (external)    (advisory)
```

A task never stores a date you typed; it stores an **offset** and the date is
*computed* from the event date. Move the trip and the whole runway recomputes.
Once a real `scheduledAt` exists, **reality wins** — the offset retires from
scheduling but stays stored as a *benchmark* (the P1 flag: "booked earlier than
your usual −4"). "Already booked" is a first-class entry state, not an
afterthought.

See [`src/lib/timing.ts`](src/lib/timing.ts) — that file is the brain.

---

## Scope

**v1 (this skeleton):** create events, add tasks with offsets, computed dates,
status lifecycle, per-task "Add to calendar" (.ics), profile memory pre-fill,
the runway view.

**Shipped since:** occasion templates — tag an event (beach, formal, work
trip…) and the runway seeds that template's appointments and to-gets; starter
set of 8, editable on `/profile` (`src/lib/templates.ts`).
**Parked at P1:** LLM timing suggestions · Gmail import · two-way calendar
sync. The stack below doesn't block any of these — they're additive.

---

## Stack

Boring on purpose — novelty budget goes into the runway and memory, not plumbing.

- **Next.js 14** (App Router) — UI + API routes + .ics in one codebase
- **Supabase** — Postgres + magic-link auth (not yet wired)
- **Drizzle** — schema in [`src/lib/db/schema.ts`](src/lib/db/schema.ts)
- **Tailwind** — calm editorial system (Fraunces + Hanken Grotesk, warm paper,
  one terracotta accent)
- **`ics`** — calendar files generated server-side, no OAuth in v1

---

## Run it

```bash
npm install
npm run dev
```

Opens with **zero setup** — it runs on a seeded mock (`src/lib/mock.ts`): a
Japan concert trip that deliberately exercises all three date sources, both task
types, every status, and the drift flag. No `DATABASE_URL` needed yet.

---

## Where to go next (in Claude Code)

The architecture is laid out so these are fill-in-the-blanks, not rewrites:

1. **Wire the DB.** Set `DATABASE_URL` (Supabase pooler URI), run
   `npm run db:push`, then swap the mock bodies in
   [`src/lib/data.ts`](src/lib/data.ts) for Drizzle queries. Screens don't change.
2. **Mutations.** `POST /api/events`, `POST /api/tasks`, `PATCH /api/tasks/[id]`
   for status changes. The seams are marked `SKELETON:` in the code.
3. **Create-event pre-fill.** The magic: seed a new event from
   `profile.timingDefaults` + saved providers, each item with a one-tap
   "already booked" path.
4. **Auth.** Supabase magic link → a real `profileId` instead of the mock one.

### Map of the code
```
src/
  app/
    page.tsx                 event list (home)
    events/[id]/page.tsx     the runway (hero screen)
    events/new/page.tsx      create-event stub
    api/ics/[taskId]/route.ts  .ics download
  lib/
    timing.ts                ★ precedence rule + drift (the brain)
    data.ts                  data access seam (mock ↔ Drizzle)
    templates.ts             occasion templates: starter set + merge + seeds
    ics.ts                   calendar generation
    mock.ts                  the Japan seed
    db/{schema,index}.ts     Drizzle schema + client
  components/
    runway.tsx               the timeline
    task-card.tsx  countdown.tsx  status-badge.tsx
```
