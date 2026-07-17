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

**Parked at P1:** occasion templates · LLM timing suggestions · Gmail import ·
two-way calendar sync. The stack below doesn't block any of these — they're
additive.

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
cd prepie
npm install
npm run dev
```

**Mock mode (default):** no env vars needed. Boots on the Japan concert trip seed.

**Database mode:** get the transaction pooler URI from Supabase → **Prepi** → **Connect** → Transaction pooler (port **6543**). For this project the host is `aws-0-us-east-1.pooler.supabase.com` — copy the full URI from the dashboard; do not hand-edit the host.

```bash
npm run setup:db -- '<paste-full-uri-from-connect>'
```

That writes `.env.local`, verifies the connection, runs `db:push`, updates Vercel `DATABASE_URL`, and redeploys. On first load with an empty database, prepie auto-seeds the Japan demo event.

To verify an existing `.env.local` without deploying:

```bash
npm run verify:db
```

---

## Deploy (Vercel)

Live: **https://prepie-lovat.vercel.app** (GitHub: `LawrenceNtim/prepie`)

1. Vercel **Root Directory** = `prepie`; deploy from repo root.
2. After rotating your Supabase DB password, re-run from `prepie/`:

```bash
npm run setup:db -- '<fresh-uri-from-supabase-connect>'
```

3. Schema is already on project **Prepi** (`beznhteumkduzxpqyfci`). `db:push` is idempotent.

**Single-user mode:** prepie currently serves one person. The deployed URL is
locked with HTTP Basic Auth — set `SITE_PASSWORD` on Vercel (`vercel env add
SITE_PASSWORD production`); unset means the lock is off (local dev). Auth +
RLS are deferred until there's a second user; all database access is
server-side Drizzle, so no anon key is exposed.

---

## What's built

- Event list, runway timeline, create event with profile pre-fill
- Task status lifecycle, add tasks, per-task `.ics` export
- Event date editing (runway recomputes from new date)
- Dual backend in [`prepie/src/lib/data.ts`](prepie/src/lib/data.ts) (in-memory mock ↔ Drizzle/Postgres)

**Still P1:** occasion templates · LLM timing · Gmail import · two-way calendar sync · profile UI · auth

### Map of the code
```
prepie/src/
  app/
    page.tsx                 event list (home)
    events/[id]/page.tsx     the runway (hero screen)
    events/new/page.tsx      create event
    actions.ts               Server Actions (mutations)
    api/ics/[taskId]/route.ts  .ics download
  lib/
    timing.ts                ★ precedence rule + drift (the brain)
    data.ts                  data access seam (mock ↔ Drizzle)
    demo-seed.ts             shared Japan demo seed builder
    ics.ts                   calendar generation
    mock.ts                  mock materialization
    db/{schema,index}.ts     Drizzle schema + client
  components/
    runway.tsx               the timeline
    task-card.tsx  countdown.tsx  event-date-editor.tsx
```
