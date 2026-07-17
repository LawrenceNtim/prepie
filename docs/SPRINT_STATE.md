# prepie — Sprint State

**As of:** 2026-07-16 · **Branch:** `main` · **Live:** https://prepie-lovat.vercel.app · **Repo:** `LawrenceNtim/prepie`

This document is the single source of truth for where the project stands, what
ships next, and how we work. Update it at the end of every sprint.

---

## 1. TL;DR

prepie (the pre-event prep companion) has a complete v1 feature skeleton
deployed to Vercel with a dual-backend data layer: it runs on an in-memory
Japan-trip mock when `DATABASE_URL` is absent, and on Drizzle → Supabase
Postgres when it is set. The Supabase schema is applied and production has a
`DATABASE_URL`, but the database is still **empty (0 rows in all four
tables)** and **RLS is disabled** — the app is demo-safe for a trusted
audience only.

**Pivot (2026-07-16): Prepie is intentionally single-user for now.** Auth +
RLS (§5.2 below) are deferred until there is a second user; privacy comes
from an HTTP Basic Auth site lock (`SITE_PASSWORD`) instead. The active plan
is `docs/superpowers/plans/2026-07-16-prepie-single-user-pivot.md`.

## 2. State verified on 2026-07-16

| Area | State | Evidence |
|---|---|---|
| Local dev | **Mock mode** | `prepie/.env.local` exists but `DATABASE_URL` is empty; `npm run verify:db` exits with "DATABASE_URL is empty" |
| Vercel production | `DATABASE_URL` **set** (Production, ~Jul 1) | `vercel env ls production` |
| Supabase (`Prepi`, ref `beznhteumkduzxpqyfci`, us-east-1, PG 17) | Schema applied; `profiles`, `providers`, `events`, `tasks` all **0 rows** | Supabase MCP `list_tables` |
| RLS | **Disabled on all 4 tables** — critical advisory | Supabase security advisor |
| Git | Local `main` was 1 commit ahead of origin (`a20aa91`) until this doc's push | `git status -sb` |

Two readings of the empty database:

- Production may never have taken a DB-mode request since the env var was set
  (the first empty-DB read auto-seeds the Japan demo via
  `prepie/src/lib/demo-seed.ts`), **or**
- the deployment predates the env var and needs a redeploy to pick it up.

Either way, "visit the live URL and confirm the demo seed lands in Supabase"
is the first checkbox of the next sprint.

## 3. What shipped last sprint (Jul 1 – Jul 3)

| Commit | Summary |
|---|---|
| `5eba839` | Deployed-demo readiness: first-run Japan demo seed for an empty Postgres, shared `demo-seed.ts` module, event date editing (runway recomputes), empty home state, Vercel deploy docs. This commit also brought the full app skeleton into the repo. |
| `d8fe936` | `scripts/setup-db.sh`: one command to push schema, set Vercel `DATABASE_URL`, and redeploy. |
| `6ac0621` | Ignore Vercel link metadata at repo root. |
| `a20aa91` | `scripts/verify-db.sh` (connectivity check that reads `.env.local` as dotenv text — no shell expansion of URI metacharacters); `setup-db.sh` now syncs `DATABASE_URL` to Vercel production; `setup:db` / `verify:db` documented in README and `.env.example`. |

Carried over from the June DB-wiring round: the `data.ts` seam is dual-backend
(every function guards `if (!db)` → in-memory store), schema was applied via
migration `0000_salty_agent_brand`, and `ensureProfile()` lazily bootstraps the
single hardcoded profile + saved providers on first DB touch.

## 4. Product recap (context for anyone landing here)

Three objects, one rule. **Profile** (memory: saved providers, timing offsets)
→ **PrepEvent** (the container; owns a date) → **Task** (`appointment` with
lifecycle `needs_booking → booked → done`, or `acquisition` with
`to_get → got`). A task's effective date resolves in strict priority
`scheduledAt → hardDate → offsetDays`; dates are computed from the event date,
so moving the event recomputes the whole runway. `prepie/src/lib/timing.ts` is
the brain. See the root `README.md` for the full model and code map.

**Built:** event list · runway timeline · create event with profile pre-fill ·
task lifecycle · add tasks · per-task `.ics` export · event date editing ·
dual-backend data seam · demo seed · setup/verify DB scripts · site lock
(`SITE_PASSWORD`) · booked-slot datetime picker · "already booked" entry
state · profile page (`/profile`) · occasion templates (qualifier chips →
seeded appointments + shopping/packing items, starter set editable on
`/profile`).

**Not built:** auth · RLS policies · LLM timing suggestions · Gmail import ·
two-way calendar sync.

**Schema delta pending on prod:** `profiles.templates` + `events.qualifiers`
land with the next `db:push` — the user's pending `npm run setup:db` run
does it. Do not deploy DB-mode until then.

## 5. Implementation plan — next sprint

Ordered by dependency and risk. Each item has a definition of done (DoD).

### 5.1 Close the DB cutover loop *(small, do first)*

1. Visit https://prepie-lovat.vercel.app and confirm it renders the Japan demo.
2. Check Supabase row counts: if still 0, the deployment isn't reading
   `DATABASE_URL` — redeploy (`vercel redeploy` or re-run
   `npm run setup:db -- '<uri>'` from `prepie/`) and re-check.
3. Set the local `DATABASE_URL` in `prepie/.env.local` (transaction pooler URI,
   port 6543, copied from Supabase → Prepi → Connect) and run
   `npm run verify:db`.
4. Exercise one mutation end-to-end against the real DB (create an event, add
   a task, flip a status) and confirm rows in Supabase.

**DoD:** production and local both run DB mode; demo seed present; one
mutation verified in Supabase.

### 5.1b Single-user site lock *(replaces §5.2 for now)*

HTTP Basic Auth middleware gated by `SITE_PASSWORD` (unset = off). One env
var on Vercel; no accounts, no sessions. **DoD:** deployed URL returns 401
without credentials, 200 with; local dev unaffected.

### 5.2 Auth + RLS *(the sprint's main course — ship as one unit)*

> **DEFERRED (single-user pivot, 2026-07-16):** parked until a second user
> exists. The site lock above covers privacy in the meantime. Everything in
> this section remains the plan of record for multi-user, unchanged.

RLS is currently **disabled on all four tables** (critical Supabase advisory).
This is tolerable only while the sole DB client is the server-side
`postgres`-role Drizzle connection; the moment an anon key ships to a browser,
every row is readable and writable by anyone. Auth and RLS land together
because policies need a real `auth.uid()` to scope to.

1. **Supabase magic-link auth** (`@supabase/ssr`): login page, auth callback
   route, middleware/session handling, sign-out.
2. **Profile becomes per-user:** replace the hardcoded single profile with a
   `profiles` row keyed to the Supabase user id; `ensureProfile()` bootstraps
   on first login instead of first read. Migrate `profiles.id` (or add
   `user_id`) to reference `auth.users`.
3. **Enable RLS + policies** on `profiles`, `providers`, `events`, `tasks`:
   owner-only `select/insert/update/delete`, chained through
   `events.profile_id` / `tasks.event_id`. Enable RLS only after policies are
   written (enabling without policies blocks all anon/authenticated access —
   the server-side Drizzle role is unaffected either way).
4. **Gate routes:** unauthenticated visitors see a marketing/login page, not
   the shared demo profile.
5. Re-run the Supabase security advisor; DoD includes a clean RLS report.

**DoD:** two different users see fully disjoint data; advisor reports no
RLS-disabled tables; magic-link round trip works on production.

### 5.3 Booked-slot datetime picker *(small, high daily-use value)*

Replace the noon-default `scheduledAt` with a real date+time picker in the
"already booked" path of `add-task-form.tsx` and in `task-status-control.tsx`
when a task flips to `booked`. Keep the precedence rule untouched — this only
improves how `scheduledAt` is captured.

**DoD:** booking a task stores the chosen time; `.ics` export and the runway
reflect it.

### 5.4 Profile UI *(unlocks the memory moat)*

A `/profile` page to view/edit timing defaults and saved providers — the data
already flows into create-event pre-fill; there's just no way to edit it.

**DoD:** editing a timing default changes the next event's pre-fill.

### 5.5 Parked at P1 (not this sprint)

Occasion templates · LLM timing suggestions (`ANTHROPIC_API_KEY` slot already
in `.env.example`) · Gmail import · two-way calendar sync. All additive; none
blocked by the current stack.

**Idea backlog (Lawrence, 2026-07-16):** both ideas **shipped in v1 form the
same day** as the unified occasion-templates feature (qualifier chips seed
appointments AND categorized shopping/packing/errand/prep items; starter set
of 8 editable on `/profile`; plan:
`docs/superpowers/plans/2026-07-16-occasion-templates.md`).
- **Follow-up:** "apply a template to an existing event" — needs an
  idempotent re-seed against live (possibly mutated) tasks.
- **Follow-up:** category grouping/checklist view on the runway (categories
  currently surface via task notes).

## 6. Process

**Cadence.** Short solo sprints (~1–2 weeks). At sprint end: update this doc
(move shipped items into §3, re-verify §2, reorder §5) and push.

**Branch/commit.** Small, single-purpose commits on `main` (solo project; no
PR ceremony until there's a second contributor). Imperative-mood commit
subjects with a body explaining the why. Push after every working increment —
don't let `main` sit ahead of origin.

**Environment discipline.** Never hand-edit connection strings; always
`npm run setup:db -- '<uri-from-supabase-connect>'` (writes `.env.local`,
verifies, pushes schema, syncs Vercel, redeploys) or `npm run verify:db` to
check. Secrets never enter git; `.env.example` documents shape only.

**Definition of done (any item).** Code + `npm run build` clean → exercised
end-to-end in the running app (not just types) → verified in the real backend
when the item touches data → README/this doc updated if behavior or setup
changed → committed and pushed.

**Deploy.** Vercel, root directory `prepie`, deploy from repo root. Schema
changes go through Drizzle (`npm run db:push`, idempotent) — never hand-run
DDL, except RLS policy migrations which should land as tracked Supabase
migrations.

**Risk log.**

| Risk | Mitigation |
|---|---|
| RLS disabled + anon key exposure | No anon key exists anywhere in the app; all DB access is server-side Drizzle. Revisit RLS only when auth lands (multi-user). |
| Public URL, single shared profile | `SITE_PASSWORD` Basic Auth lock (shipped this sprint). |
| Demo seed may double-fire on races | Acceptable at demo scale; revisit with auth (seed becomes per-user onboarding) |
| Supabase password rotation breaks prod | Re-run `setup:db` with the fresh URI (documented in README) |
