# Prepie Single-User Pivot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Prepie a fully working, private, single-user app on the existing Supabase + Vercel deployment — no auth system, no RLS work — by closing the DB cutover, locking the site behind a shared password, capturing real booked slots, and adding the profile-editing UI.

**Architecture:** Keep Supabase as a dumb Postgres host reached only from server-side Drizzle (the `data.ts` dual-backend seam stays exactly as-is). Privacy comes from an HTTP Basic Auth middleware gated by a `SITE_PASSWORD` env var, not from Supabase auth/RLS — that whole workstream is deferred until there is a second user. New UI work (datetime picker, profile page) goes through the existing seam so mock mode keeps working with zero env vars.

**Tech Stack:** Next.js 14 App Router (server actions, `src/middleware.ts`), Drizzle + `postgres`, date-fns, Tailwind, Vitest (new dev dep, pure-logic tests only — no DOM test renderer).

## Global Constraints

- App lives in `prepie/` inside the repo; all `npm` commands run from `prepie/` unless stated otherwise.
- Repo root: `/Users/Shared/Dev/prepie project`. Deploy: Vercel project `prepie` (root directory `prepie`), live at https://prepie-lovat.vercel.app.
- Every data-layer function MUST keep the dual-backend contract: `if (!db)` → in-memory `store`, else Drizzle. Signatures identical for both.
- Dates: `eventDate`/`hardDate` are ISO dates (`"YYYY-MM-DD"`); `scheduledAt` is a full ISO datetime string in the domain layer (`timestamptz` in Postgres).
- No new runtime dependencies. Vitest is the only new dev dependency.
- Never commit secrets. `DATABASE_URL` and `SITE_PASSWORD` live in `.env.local` / Vercel env only; `.env.example` documents shape.
- Tests must pass with no env vars set (they exercise the mock backend; `db` is null without `DATABASE_URL`).
- Style: match the existing Tailwind token classes (`bg-paper`, `bg-surface`, `text-muted`, `text-ink`, `border-accent`, `rounded-card`, `font-display`).
- Commit messages: imperative subject + body explaining why.

---

### Task 1: Close the DB cutover loop

Production has `DATABASE_URL` (set ~Jul 1) but Supabase shows 0 rows in all four tables, and local `.env.local` has an empty `DATABASE_URL`. This task is verification/ops — no code. It determines whether prod is actually in DB mode and brings local into DB mode.

**Files:** none (ops only). `prepie/.env.local` is written by the script, never by hand.

**Interfaces:**
- Consumes: `npm run setup:db` / `npm run verify:db` (already in `prepie/package.json`), Supabase project `Prepi` ref `beznhteumkduzxpqyfci`.
- Produces: a production deployment verifiably reading/writing Supabase; local dev in DB mode. Later tasks assume nothing from this — they work in mock mode too — so this task can run in parallel with the rest.

- [ ] **Step 1: Check whether prod is serving the demo seed**

Run: `curl -s https://prepie-lovat.vercel.app | grep -c "Japan"`
Expected: `1` or more (the Japan demo event title on the home page). If the page renders but Supabase still shows 0 event rows after this request (check Step 2), prod is running the **mock**, i.e. the deployment predates the env var.

- [ ] **Step 2: Check Supabase row counts**

In the Supabase dashboard (project `Prepi`) → SQL editor, run:

```sql
select
  (select count(*) from profiles)  as profiles,
  (select count(*) from events)    as events,
  (select count(*) from tasks)     as tasks;
```

Expected after Step 1's request hit a DB-mode deployment: `profiles = 1`, `events = 1`, `tasks > 0` (the first DB-mode read auto-seeds via `ensureDemoData` in `prepie/src/lib/data.ts`).

- [ ] **Step 3: If counts are still 0, redeploy so the env var is picked up**

Run from repo root:

```bash
cd "/Users/Shared/Dev/prepie project" && vercel redeploy prepie-lovat.vercel.app
```

Then repeat Steps 1–2. Expected: counts now non-zero.

- [ ] **Step 4 (USER ACTION — needs the secret): wire local DB mode**

The pooler URI must come from Supabase → **Prepi** → **Connect** → Transaction pooler (port **6543**). Then:

```bash
cd "/Users/Shared/Dev/prepie project/prepie" && npm run setup:db -- '<paste-full-uri-from-connect>'
```

This writes `.env.local`, verifies the connection, runs `db:push` (idempotent), syncs Vercel `DATABASE_URL`, and redeploys. If the user prefers not to touch prod, they can instead paste the URI into `.env.local` by hand and run only `npm run verify:db`.

- [ ] **Step 5: Verify local DB mode end-to-end**

Run: `npm run verify:db` → Expected: `Connected OK (aws-0-us-east-1.pooler.supabase.com)`.
Then `npm run dev`, open http://localhost:3000, create a throwaway event, and re-run the Step 2 SQL. Expected: `events` count increased by 1. Delete the throwaway event row afterward if desired:

```sql
delete from events where title = '<throwaway title>';
```

No commit (nothing in git changes).

---

### Task 2: Site lock — Basic Auth middleware + Vitest harness

A single-user deployment on a public URL needs a gate. HTTP Basic Auth via middleware is the smallest thing that works: one env var, no session state, browsers handle the prompt. When `SITE_PASSWORD` is unset the lock is off, so local dev and mock demos stay zero-setup. This task also introduces Vitest (first task that needs a test runner; Tasks 3, 5, 6 reuse it).

**Files:**
- Modify: `prepie/package.json` (add `vitest` dev dep + `test` script)
- Create: `prepie/vitest.config.ts`
- Create: `prepie/src/lib/site-lock.ts`
- Test: `prepie/src/lib/site-lock.test.ts`
- Create: `prepie/src/middleware.ts`
- Modify: `prepie/.env.example` (document `SITE_PASSWORD`)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `isAuthorized(authorizationHeader: string | null, password: string | undefined): boolean` in `@/lib/site-lock`; `npm test` runs Vitest on `src/**/*.test.ts`. Later tasks add test files that this config already picks up.

- [ ] **Step 1: Install Vitest and add the test script**

```bash
cd "/Users/Shared/Dev/prepie project/prepie" && npm install -D vitest
```

In `prepie/package.json`, add to `"scripts"` (after `"lint"`):

```json
    "test": "vitest run",
```

Create `prepie/vitest.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    // Mirror the "@/*" → "src/*" alias from tsconfig.json.
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

- [ ] **Step 2: Write the failing test**

Create `prepie/src/lib/site-lock.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isAuthorized } from "./site-lock";

const header = (user: string, pass: string) =>
  `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;

describe("isAuthorized", () => {
  it("passes everyone when no password is configured (lock off)", () => {
    expect(isAuthorized(null, undefined)).toBe(true);
    expect(isAuthorized(null, "")).toBe(true);
  });

  it("rejects missing or non-Basic headers when locked", () => {
    expect(isAuthorized(null, "s3cret")).toBe(false);
    expect(isAuthorized("Bearer abc", "s3cret")).toBe(false);
  });

  it("rejects malformed base64", () => {
    expect(isAuthorized("Basic %%%not-base64%%%", "s3cret")).toBe(false);
  });

  it("accepts the right password with any username", () => {
    expect(isAuthorized(header("prepie", "s3cret"), "s3cret")).toBe(true);
    expect(isAuthorized(header("", "s3cret"), "s3cret")).toBe(true);
  });

  it("rejects the wrong password", () => {
    expect(isAuthorized(header("prepie", "nope"), "s3cret")).toBe(false);
  });

  it("allows colons inside the password", () => {
    expect(isAuthorized(header("u", "a:b:c"), "a:b:c")).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./site-lock`.

- [ ] **Step 4: Implement `site-lock.ts`**

Create `prepie/src/lib/site-lock.ts`:

```ts
// Shared-secret gate for the single-user deployment. No accounts, no
// sessions: one password in SITE_PASSWORD, checked as the password half of
// HTTP Basic credentials (any username is accepted). Unset password = lock
// off, so local dev and mock demos need zero setup. Runs in the Edge
// runtime, hence atob rather than Buffer.
export function isAuthorized(
  authorizationHeader: string | null,
  password: string | undefined,
): boolean {
  if (!password) return true;
  if (!authorizationHeader?.startsWith("Basic ")) return false;

  let decoded: string;
  try {
    decoded = atob(authorizationHeader.slice("Basic ".length));
  } catch {
    return false;
  }

  const sep = decoded.indexOf(":");
  if (sep === -1) return false;
  return decoded.slice(sep + 1) === password;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS (6 tests).

- [ ] **Step 6: Add the middleware**

Create `prepie/src/middleware.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { isAuthorized } from "@/lib/site-lock";

// Single-user site lock. See src/lib/site-lock.ts for the rules; this file
// only wires it to the request pipeline and the browser's Basic Auth prompt.
export function middleware(request: NextRequest) {
  if (
    isAuthorized(request.headers.get("authorization"), process.env.SITE_PASSWORD)
  ) {
    return NextResponse.next();
  }
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="prepie"' },
  });
}

export const config = {
  // Everything except Next's static assets. The .ics API route stays behind
  // the lock on purpose — downloads happen from an already-authed browser.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 7: Document the env var**

In `prepie/.env.example`, append after the `DATABASE_URL=` line (before the `ANTHROPIC_API_KEY` comment block):

```bash
# ── Single-user site lock ──────────────────────────────────────────────
# HTTP Basic Auth for the deployed URL. Unset = lock OFF (local dev, demos).
# Username is ignored; only the password is checked. Set it on Vercel with:
#   vercel env add SITE_PASSWORD production
# then redeploy.
# SITE_PASSWORD=
```

- [ ] **Step 8: Verify locally, both locked and unlocked**

```bash
npm run build
```

Expected: build succeeds. Then:

```bash
SITE_PASSWORD=testpass npm run dev &
sleep 5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000          # expect 401
curl -s -o /dev/null -w "%{http_code}\n" -u anyone:testpass http://localhost:3000  # expect 200
kill %1
```

Expected: `401` then `200`. Also confirm plain `npm run dev` (no `SITE_PASSWORD`) serves `200` without credentials.

- [ ] **Step 9: Commit**

```bash
cd "/Users/Shared/Dev/prepie project" && git add prepie/package.json prepie/package-lock.json prepie/vitest.config.ts prepie/src/lib/site-lock.ts prepie/src/lib/site-lock.test.ts prepie/src/middleware.ts prepie/.env.example
git commit -m "Add single-user site lock via Basic Auth middleware

SITE_PASSWORD env var gates the whole app; unset means off so local dev
stays zero-setup. Replaces the deferred auth+RLS workstream for the
single-user phase. Also introduces Vitest for pure-logic tests."
```

- [ ] **Step 10 (USER ACTION): set the password on Vercel**

```bash
cd "/Users/Shared/Dev/prepie project" && vercel env add SITE_PASSWORD production
```

(User types the password at the prompt.) Deploy the new middleware after Task 8's push, then verify: `curl -s -o /dev/null -w "%{http_code}\n" https://prepie-lovat.vercel.app` → `401`, and with `-u anyone:<password>` → `200`.

---

### Task 3: Slot helpers (`src/lib/slots.ts`)

The picker tasks (4 and 5) both need three pure functions: propose a slot for an unbooked appointment, and convert between ISO strings (what the app stores) and `datetime-local` input values (what the browser edits, in local time). Extracting them makes the logic testable without a DOM.

**Files:**
- Create: `prepie/src/lib/slots.ts`
- Test: `prepie/src/lib/slots.test.ts`

**Interfaces:**
- Consumes: `date-fns` (`format`, `set`, `subDays`) — already a dependency.
- Produces (used by Tasks 4 and 5):
  - `suggestedSlotISO(eventDate: string, offsetDays: number | null): string` — noon on the offset-derived day (event day when offset is null), as an ISO datetime.
  - `toDatetimeLocalValue(iso: string): string` — ISO → `"yyyy-MM-ddTHH:mm"` in local time.
  - `fromDatetimeLocalValue(value: string): string` — `datetime-local` value → ISO.

- [ ] **Step 1: Write the failing test**

Create `prepie/src/lib/slots.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  fromDatetimeLocalValue,
  suggestedSlotISO,
  toDatetimeLocalValue,
} from "./slots";

describe("suggestedSlotISO", () => {
  it("suggests local noon", () => {
    expect(new Date(suggestedSlotISO("2026-07-08", 4)).getHours()).toBe(12);
  });

  it("moves exactly one day per offset step", () => {
    const at3 = new Date(suggestedSlotISO("2026-07-08", 3)).getTime();
    const at4 = new Date(suggestedSlotISO("2026-07-08", 4)).getTime();
    expect(at3 - at4).toBe(24 * 60 * 60 * 1000);
  });

  it("treats a null offset as the event day itself", () => {
    expect(suggestedSlotISO("2026-07-08", null)).toBe(
      suggestedSlotISO("2026-07-08", 0),
    );
  });
});

describe("datetime-local conversion", () => {
  it("formats in the input's expected local shape", () => {
    const iso = new Date(2026, 6, 20, 14, 30).toISOString(); // local Jul 20, 14:30
    expect(toDatetimeLocalValue(iso)).toBe("2026-07-20T14:30");
  });

  it("round-trips to the minute", () => {
    const iso = new Date(2026, 6, 20, 14, 30).toISOString();
    expect(fromDatetimeLocalValue(toDatetimeLocalValue(iso))).toBe(iso);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./slots`.

- [ ] **Step 3: Implement `slots.ts`**

Create `prepie/src/lib/slots.ts`:

```ts
import { format, set, subDays } from "date-fns";

// Helpers for the "booked" path. The app stores full ISO datetimes
// (scheduledAt — reality); datetime-local inputs speak "yyyy-MM-ddTHH:mm"
// in the browser's local zone. Conversions live here so components stay
// logic-free and both entry points (status control, add-task form) agree.

// Propose a concrete slot for an appointment with no real booking yet:
// local noon on the offset-derived day, or on the event day itself when
// there is no offset. Same convention the status control has always used —
// noon is a visible placeholder, not a claim about the actual time.
export function suggestedSlotISO(
  eventDate: string,
  offsetDays: number | null,
): string {
  const day = subDays(new Date(eventDate), offsetDays ?? 0);
  return set(day, {
    hours: 12,
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
  }).toISOString();
}

export function toDatetimeLocalValue(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd'T'HH:mm");
}

export function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (site-lock + slots suites).

- [ ] **Step 5: Commit**

```bash
cd "/Users/Shared/Dev/prepie project" && git add prepie/src/lib/slots.ts prepie/src/lib/slots.test.ts
git commit -m "Add slot helpers for the booked-slot picker

suggestedSlotISO keeps the existing noon-on-offset-day convention;
the datetime-local converters bridge browser-local input values to the
ISO datetimes the app stores."
```

---

### Task 4: Datetime picker when marking a task booked

Today, flipping an appointment to `booked` silently writes noon on the offset day. Replace that with an inline picker: choosing "Booked" reveals a `datetime-local` input prefilled with the suggested slot; confirming stores the real time. All other transitions keep their current semantics (`needs_booking` clears the slot; `done` preserves it).

**Files:**
- Modify: `prepie/src/components/task-status-control.tsx` (full rewrite below)

**Interfaces:**
- Consumes: `suggestedSlotISO`, `toDatetimeLocalValue`, `fromDatetimeLocalValue` from `@/lib/slots` (Task 3); `setTaskStatusAction(taskId, eventId, status, scheduledAt)` from `@/app/actions` (unchanged).
- Produces: no new exports; same component API (`TaskStatusControlProps` unchanged).

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `prepie/src/components/task-status-control.tsx` with:

```tsx
"use client";

import { useState, useTransition } from "react";
import type { TaskStatus, TaskType } from "@/types";
import { statusesFor, statusLabel } from "@/lib/format";
import {
  fromDatetimeLocalValue,
  suggestedSlotISO,
  toDatetimeLocalValue,
} from "@/lib/slots";
import { setTaskStatusAction } from "@/app/actions";

interface TaskStatusControlProps {
  taskId: string;
  eventId: string;
  eventDate: string; // ISO "YYYY-MM-DD"
  type: TaskType;
  status: TaskStatus;
  offsetDays: number | null;
  scheduledAt: string | null;
}

// Status control with the precedence rule's "reality wins" made explicit:
// booking an appointment asks for the real slot (prefilled with the
// suggested noon-on-offset-day placeholder) instead of silently writing a
// guess. Moving back to "needs_booking" clears the slot so the advisory
// offset takes over; "done" preserves whatever slot exists.
export function TaskStatusControl(props: TaskStatusControlProps) {
  const { taskId, eventId, type, status } = props;
  const [pending, startTransition] = useTransition();
  // Non-null while the booking picker is open; holds the datetime-local draft.
  const [slotDraft, setSlotDraft] = useState<string | null>(null);

  function commit(next: TaskStatus, scheduledAt: string | null) {
    startTransition(() => {
      setTaskStatusAction(taskId, eventId, next, scheduledAt);
    });
  }

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as TaskStatus;
    if (next === status) return;
    if (type === "appointment" && next === "booked") {
      setSlotDraft(
        toDatetimeLocalValue(
          props.scheduledAt ??
            suggestedSlotISO(props.eventDate, props.offsetDays),
        ),
      );
      return;
    }
    const scheduledAt =
      type === "appointment" && next === "done" ? props.scheduledAt : null;
    commit(next, scheduledAt);
  }

  if (slotDraft !== null) {
    return (
      <form
        className="ml-auto flex items-center gap-1.5 text-[13px]"
        onSubmit={(e) => {
          e.preventDefault();
          commit("booked", fromDatetimeLocalValue(slotDraft));
          setSlotDraft(null);
        }}
      >
        <input
          type="datetime-local"
          value={slotDraft}
          onChange={(e) => setSlotDraft(e.target.value)}
          required
          autoFocus
          className="rounded-md border bg-paper px-2 py-1 text-[13px] text-ink outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-ink px-3 py-1 text-paper transition hover:bg-accent disabled:opacity-50"
        >
          Book
        </button>
        <button
          type="button"
          onClick={() => setSlotDraft(null)}
          className="text-muted underline decoration-line underline-offset-4 hover:decoration-accent"
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <label className="ml-auto inline-flex items-center gap-1.5 text-[13px] text-muted">
      <span className="sr-only">Status</span>
      <select
        value={status}
        onChange={onChange}
        disabled={pending}
        className="rounded-md border bg-paper px-2 py-1 text-[13px] text-ink outline-none focus:border-accent disabled:opacity-50"
      >
        {statusesFor(type).map((s) => (
          <option key={s} value={s}>
            {statusLabel(s)}
          </option>
        ))}
      </select>
    </label>
  );
}
```

(Note: the old `slotFor` function and its `date-fns` imports are gone — that logic now lives in `@/lib/slots` plus the inline `done`/`needs_booking` rules above.)

- [ ] **Step 2: Build and verify in the running app**

Run: `npm run build` → Expected: succeeds.
Then `npm run dev`, open the Japan demo event, and verify each transition on an appointment task:
1. `needs_booking → booked`: picker appears prefilled with noon on the offset day; pick a different time, press **Book** → card shows the chosen time; the task's "Add to calendar" `.ics` contains that time.
2. Cancel path: choose "Booked", press **Cancel** → status unchanged.
3. `booked → needs_booking`: slot clears, advisory offset date shows again.
4. `booked → done`: slot preserved.
5. An acquisition task: `to_get → got` still one tap, no picker.

- [ ] **Step 3: Run the test suite (regression)**

Run: `npm test` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd "/Users/Shared/Dev/prepie project" && git add prepie/src/components/task-status-control.tsx
git commit -m "Ask for the real slot when booking instead of writing noon

Selecting Booked now opens an inline datetime-local picker prefilled
with the suggested slot; confirming stores the actual time, so the card
and .ics reflect reality rather than a placeholder."
```

---

### Task 5: "Already booked" as a first-class entry state

The README promises "already booked" as an entry state, but `createTask` hardcodes new appointments to `needs_booking`. Add a third timing mode to the add-task form that captures a real slot up front, and derive `booked` status in the data layer when a slot is provided.

**Files:**
- Modify: `prepie/src/lib/data.ts` (status derivation in `createTask`, ~line 306)
- Modify: `prepie/src/app/actions.ts` (read `scheduledAt` in `addTaskAction`)
- Modify: `prepie/src/components/add-task-form.tsx` (third timing mode)
- Test: `prepie/src/lib/data.test.ts` (new)

**Interfaces:**
- Consumes: `createTask(input: CreateTaskInput)` from `@/lib/data` — `CreateTaskInput.scheduledAt?: string | null` already exists; `fromDatetimeLocalValue` from `@/lib/slots` (Task 3).
- Produces: `createTask` now returns `status: "booked"` when `type === "appointment"` and a `scheduledAt` is provided; `addTaskAction` forwards a `scheduledAt` form field (full ISO datetime string, converted client-side).

- [ ] **Step 1: Write the failing test**

Create `prepie/src/lib/data.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createEvent, createTask } from "./data";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — first test gets `"needs_booking"` instead of `"booked"`.

- [ ] **Step 3: Derive status in `createTask`**

In `prepie/src/lib/data.ts`, replace the status derivation at the top of `createTask`:

```ts
  const status: TaskStatus =
    input.type === "appointment" ? "needs_booking" : "to_get";
```

with:

```ts
  // "Already booked" is a first-class entry state: an appointment created
  // with a real slot starts life as booked (reality wins from the start).
  const status: TaskStatus =
    input.type === "appointment"
      ? input.scheduledAt
        ? "booked"
        : "needs_booking"
      : "to_get";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test` → Expected: PASS.

- [ ] **Step 5: Forward `scheduledAt` through the server action**

In `prepie/src/app/actions.ts`, inside `addTaskAction`, after the `const notes = …` line, add:

```ts
  // Full ISO datetime, converted from the datetime-local value client-side
  // (the browser knows the user's zone; the server does not).
  const scheduledAt = String(formData.get("scheduledAt") ?? "").trim();
```

and extend the `input` literal with one field after `hardDate`:

```ts
    scheduledAt: scheduledAt || null,
```

- [ ] **Step 6: Add the "Already booked" timing mode to the form**

In `prepie/src/components/add-task-form.tsx`:

6a. Extend the imports:

```tsx
import { fromDatetimeLocalValue } from "@/lib/slots";
```

6b. Widen the timing state and add a slot draft (replace the existing `timing` state line):

```tsx
  const [timing, setTiming] = useState<"offset" | "hard" | "booked">("offset");
  const [bookedSlot, setBookedSlot] = useState("");
```

6c. In the form's `action` callback, reset the new state too (after `setTiming("offset")`):

```tsx
        setBookedSlot("");
```

6d. The type toggle: "booked" only makes sense for appointments, so when switching to acquisition, fall back to offset. Replace the type buttons' `onClick={() => setType(t)}` with:

```tsx
            onClick={() => {
              setType(t);
              if (t === "acquisition" && timing === "booked") setTiming("offset");
            }}
```

6e. The timing-mode toggle: replace the array literal `(["offset", "hard"] as const)` with a mode list that includes "booked" for appointments only, and its label lookup. Replace the whole timing-mode `<div>` block:

```tsx
      {/* timing mode */}
      <div className="flex gap-2 text-[13px]">
        {(type === "appointment"
          ? (["offset", "hard", "booked"] as const)
          : (["offset", "hard"] as const)
        ).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setTiming(m)}
            className={`rounded-full border px-3 py-1 transition ${
              timing === m
                ? "border-accent bg-accent-soft/40 text-accent"
                : "text-muted hover:border-accent"
            }`}
          >
            {m === "offset"
              ? "Days before event"
              : m === "hard"
                ? "Fixed date"
                : "Already booked"}
          </button>
        ))}
      </div>
```

6f. Add the booked branch to the timing input. The current code is a two-way ternary (`timing === "offset" ? … : …`); make it three-way:

```tsx
      {timing === "offset" ? (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            How many days before?
          </span>
          <input
            name="offsetDays"
            type="number"
            min={0}
            placeholder="4"
            className="w-full rounded-md border bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>
      ) : timing === "hard" ? (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">On this date</span>
          <input
            name="hardDate"
            type="date"
            className="w-full rounded-md border bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>
      ) : (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Booked for</span>
          <input
            type="datetime-local"
            required
            value={bookedSlot}
            onChange={(e) => setBookedSlot(e.target.value)}
            className="w-full rounded-md border bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          />
          {/* The server stores ISO; convert client-side where the zone is known. */}
          <input
            type="hidden"
            name="scheduledAt"
            value={bookedSlot ? fromDatetimeLocalValue(bookedSlot) : ""}
          />
        </label>
      )}
```

- [ ] **Step 7: Build and verify in the running app**

Run: `npm run build` → Expected: succeeds.
Then `npm run dev`, open an event, "+ Add a task":
1. Appointment → "Already booked" mode appears; pick a datetime, add → task lands directly in `booked` with the chosen slot shown and a timed `.ics`.
2. Switch type to "Acquire" while "Already booked" is selected → mode falls back to "Days before event"; no booked option shown.
3. Plain offset appointment still lands in `needs_booking`.

- [ ] **Step 8: Run the full test suite**

Run: `npm test` → Expected: PASS (site-lock, slots, data suites).

- [ ] **Step 9: Commit**

```bash
cd "/Users/Shared/Dev/prepie project" && git add prepie/src/lib/data.ts prepie/src/lib/data.test.ts prepie/src/app/actions.ts prepie/src/components/add-task-form.tsx
git commit -m "Make 'already booked' a first-class task entry state

Add-task form gains a third timing mode for appointments that captures
the real slot up front; createTask derives booked status when a slot is
provided. Conversion to ISO happens client-side where the zone is known."
```

---

### Task 6: Profile data functions

The profile UI (Task 7) needs three seam functions that don't exist yet: update the profile (sizes, display name, timing defaults), add a provider, delete a provider. Same dual-backend contract as everything else in `data.ts`.

**Files:**
- Modify: `prepie/src/lib/store.ts` (extend `newId` prefix union with `"p"`, line 46)
- Modify: `prepie/src/lib/data.ts` (three new exports, appended after `updateEvent`)
- Test: `prepie/src/lib/data.test.ts` (extend with a profile suite)

**Interfaces:**
- Consumes: `store`, `newId` from `./store`; `ensureProfile`, `mapProvider`, `getProfile` already in `data.ts`.
- Produces (used by Task 7's server actions):
  - `updateProfile(patch: UpdateProfileInput): Promise<Profile>` where `UpdateProfileInput = { displayName?: string; shoeSize?: string | null; clothingSize?: string | null; timingDefaults?: Record<string, number> }`
  - `addProvider(input: CreateProviderInput): Promise<Provider>` where `CreateProviderInput = { name: string; category?: string | null; location?: string | null; notes?: string | null }`
  - `deleteProvider(id: string): Promise<void>`

- [ ] **Step 1: Write the failing tests**

Append to `prepie/src/lib/data.test.ts`:

```ts
import { addProvider, deleteProvider, getProfile, updateProfile } from "./data";

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
```

(Merge the import line with the existing `./data` import at the top of the file: `import { addProvider, createEvent, createTask, deleteProvider, getProfile, updateProfile } from "./data";` — one import statement, not two.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `updateProfile` is not exported.

- [ ] **Step 3: Extend `newId` in `store.ts`**

In `prepie/src/lib/store.ts` line 46, change the prefix union:

```ts
export function newId(prefix: "evt" | "t" | "p"): string {
```

- [ ] **Step 4: Implement the three functions**

Append to `prepie/src/lib/data.ts` (after `updateEvent`, before the Pre-fill section):

```ts
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd "/Users/Shared/Dev/prepie project" && git add prepie/src/lib/data.ts prepie/src/lib/data.test.ts prepie/src/lib/store.ts
git commit -m "Add profile-editing functions to the data seam

updateProfile / addProvider / deleteProvider, dual-backend like the
rest of data.ts. Mock deleteProvider mirrors the DB's ON DELETE SET
NULL on tasks.provider_id."
```

---

### Task 7: Profile page

A `/profile` page that edits everything the create-event pre-fill reads: display name + sizes, timing defaults (category → days-before), and saved providers. Plain server-component forms with server actions — no client JS needed.

**Files:**
- Modify: `prepie/src/app/actions.ts` (five new actions, appended at the end)
- Create: `prepie/src/app/profile/page.tsx`
- Modify: `prepie/src/app/page.tsx` (header link to `/profile`, lines 26–31)

**Interfaces:**
- Consumes: `getProfile`, `updateProfile`, `addProvider`, `deleteProvider` from `@/lib/data` (Task 6).
- Produces: routes `/profile`; actions `updateProfileAction(formData)`, `saveTimingDefaultAction(formData)`, `removeTimingDefaultAction(category: string)`, `addProviderAction(formData)`, `deleteProviderAction(id: string)` — the bound-argument actions are used with `.bind(null, value)` in forms.

- [ ] **Step 1: Add the server actions**

In `prepie/src/app/actions.ts`, extend the `@/lib/data` import:

```ts
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
```

Append at the end of the file:

```ts
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
```

- [ ] **Step 2: Create the page**

Create `prepie/src/app/profile/page.tsx`:

```tsx
import Link from "next/link";
import { getProfile } from "@/lib/data";
import {
  addProviderAction,
  deleteProviderAction,
  removeTimingDefaultAction,
  saveTimingDefaultAction,
  updateProfileAction,
} from "@/app/actions";

const inputClass =
  "w-full rounded-md border bg-paper px-3 py-2 text-sm outline-none focus:border-accent";

// The memory layer, finally editable. Everything on this page feeds the
// create-event pre-fill: timing defaults become seeded appointments, and
// providers attach to them by category.
export default async function ProfilePage() {
  const profile = await getProfile();
  const defaults = Object.entries(profile.timingDefaults).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-12">
        <Link
          href="/"
          className="text-sm text-muted underline decoration-line underline-offset-4 hover:decoration-accent"
        >
          ← All events
        </Link>
        <h1 className="mt-3 font-display text-4xl tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted">
          The memory that pre-fills every new event.
        </p>
      </header>

      {/* ── Basics ── */}
      <section className="rounded-card border bg-surface p-5">
        <h2 className="font-display text-lg">Basics</h2>
        <form action={updateProfileAction} className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Name</span>
            <input
              name="displayName"
              required
              defaultValue={profile.displayName}
              className={inputClass}
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">
                Shoe size
              </span>
              <input
                name="shoeSize"
                defaultValue={profile.shoeSize ?? ""}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">
                Clothing size
              </span>
              <input
                name="clothingSize"
                defaultValue={profile.clothingSize ?? ""}
                className={inputClass}
              />
            </label>
          </div>
          <button
            type="submit"
            className="rounded-full bg-ink px-4 py-2 text-sm text-paper transition hover:bg-accent"
          >
            Save basics
          </button>
        </form>
      </section>

      {/* ── Timing defaults ── */}
      <section className="mt-6 rounded-card border bg-surface p-5">
        <h2 className="font-display text-lg">Usual timing</h2>
        <p className="mt-1 text-sm text-muted">
          Days before the event you usually handle each thing. New events start
          with one unbooked appointment per row.
        </p>

        <ul className="mt-4 space-y-2">
          {defaults.length === 0 && (
            <li className="text-sm text-muted">No timing defaults yet.</li>
          )}
          {defaults.map(([category, days]) => (
            <li
              key={category}
              className="flex items-center justify-between rounded-md border bg-paper px-3 py-2 text-sm"
            >
              <span className="capitalize">{category}</span>
              <span className="ml-auto mr-4 text-muted">
                −{days} day{days === 1 ? "" : "s"}
              </span>
              <form action={removeTimingDefaultAction.bind(null, category)}>
                <button
                  type="submit"
                  className="text-[13px] text-muted underline decoration-line underline-offset-4 hover:decoration-accent"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>

        <form action={saveTimingDefaultAction} className="mt-4 flex items-end gap-3">
          <label className="block flex-1">
            <span className="mb-1.5 block text-sm font-medium">Category</span>
            <input name="category" required placeholder="hair" className={inputClass} />
          </label>
          <label className="block w-32">
            <span className="mb-1.5 block text-sm font-medium">Days before</span>
            <input
              name="days"
              type="number"
              min={0}
              required
              placeholder="4"
              className={inputClass}
            />
          </label>
          <button
            type="submit"
            className="rounded-full bg-ink px-4 py-2 text-sm text-paper transition hover:bg-accent"
          >
            Save
          </button>
        </form>
      </section>

      {/* ── Providers ── */}
      <section className="mt-6 rounded-card border bg-surface p-5">
        <h2 className="font-display text-lg">Saved providers</h2>
        <p className="mt-1 text-sm text-muted">
          Attached to pre-filled appointments by matching category.
        </p>

        <ul className="mt-4 space-y-2">
          {profile.providers.length === 0 && (
            <li className="text-sm text-muted">No providers saved yet.</li>
          )}
          {profile.providers.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-md border bg-paper px-3 py-2 text-sm"
            >
              <div>
                <span>{p.name}</span>
                <span className="ml-2 text-muted">
                  {[p.category, p.location].filter(Boolean).join(" · ")}
                </span>
              </div>
              <form action={deleteProviderAction.bind(null, p.id)}>
                <button
                  type="submit"
                  className="text-[13px] text-muted underline decoration-line underline-offset-4 hover:decoration-accent"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>

        <form action={addProviderAction} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Name</span>
              <input name="name" required placeholder="Salon Aiko" className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Category</span>
              <input name="category" placeholder="hair" className={inputClass} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              Location (optional)
            </span>
            <input name="location" className={inputClass} />
          </label>
          <button
            type="submit"
            className="rounded-full bg-ink px-4 py-2 text-sm text-paper transition hover:bg-accent"
          >
            Add provider
          </button>
        </form>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Link to it from the home header**

In `prepie/src/app/page.tsx`, replace the header's single "New event" `<Link>` (lines 26–31) with:

```tsx
        <div className="flex items-center gap-4">
          <Link
            href="/profile"
            className="text-sm text-muted underline decoration-line underline-offset-4 hover:decoration-accent"
          >
            Profile
          </Link>
          <Link
            href="/events/new"
            className="rounded-full bg-ink px-4 py-2 text-sm text-paper transition hover:bg-accent"
          >
            New event
          </Link>
        </div>
```

- [ ] **Step 4: Build and verify in the running app**

Run: `npm run build` → Expected: succeeds, `/profile` appears in the route list.
Then `npm run dev`:
1. Home header shows "Profile"; open it.
2. Add timing default `massage → 2`, then create a new event → the runway includes an unbooked "Massage" appointment at −2 days.
3. Add provider "Test Salon" with category `massage`, create another event → the Massage task carries that provider.
4. Remove the `massage` default and "Test Salon"; save basics with a changed name → header data persists after reload.
5. If in DB mode (Task 1 done): check Supabase — `profiles.timing_defaults` and `providers` reflect the edits.

- [ ] **Step 5: Run the full test suite**

Run: `npm test` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd "/Users/Shared/Dev/prepie project" && git add prepie/src/app/actions.ts prepie/src/app/profile/page.tsx prepie/src/app/page.tsx
git commit -m "Add the profile page: edit sizes, timing defaults, providers

Plain server-component forms over the new data-seam functions. This is
the memory layer's first UI — everything here feeds create-event
pre-fill, closing the loop on the profile moat."
```

---

### Task 8: Update docs and push

Record the single-user pivot where the next session will look for it, and push everything.

**Files:**
- Modify: `docs/SPRINT_STATE.md` (repo root)
- Modify: `README.md` (repo root, security note lines 106–108)

**Interfaces:** none — docs only.

- [ ] **Step 1: Update `docs/SPRINT_STATE.md`**

1a. In §1 (TL;DR), replace the last sentence ("The next sprint closes the loop … as one unit.") with:

```markdown
**Pivot (2026-07-16): Prepie is intentionally single-user for now.** Auth +
RLS (§5.2 below) are deferred until there is a second user; privacy comes
from an HTTP Basic Auth site lock (`SITE_PASSWORD`) instead. The active plan
is `docs/superpowers/plans/2026-07-16-prepie-single-user-pivot.md`.
```

1b. In §5.2, add this line directly under the heading:

```markdown
> **DEFERRED (single-user pivot, 2026-07-16):** parked until a second user
> exists. The site lock below covers privacy in the meantime. Everything in
> this section remains the plan of record for multi-user, unchanged.
```

1c. Replace §5.2's position in the ordering by inserting a new subsection after §5.1:

```markdown
### 5.1b Single-user site lock *(replaces §5.2 for now)*

HTTP Basic Auth middleware gated by `SITE_PASSWORD` (unset = off). One env
var on Vercel; no accounts, no sessions. **DoD:** deployed URL returns 401
without credentials, 200 with; local dev unaffected.
```

1d. In the §6 risk log, update the first two rows:

| Risk | Mitigation |
|---|---|
| RLS disabled + anon key exposure | No anon key exists anywhere in the app; all DB access is server-side Drizzle. Revisit RLS only when auth lands (multi-user). |
| Public URL, single shared profile | `SITE_PASSWORD` Basic Auth lock (shipped this sprint). |

- [ ] **Step 2: Update the root `README.md` security note**

Replace lines 106–108 (the "Note:" and "Security (P1):" paragraphs) with:

```markdown
**Single-user mode:** prepie currently serves one person. The deployed URL is
locked with HTTP Basic Auth — set `SITE_PASSWORD` on Vercel (`vercel env add
SITE_PASSWORD production`); unset means the lock is off (local dev). Auth +
RLS are deferred until there's a second user; all database access is
server-side Drizzle, so no anon key is exposed.
```

- [ ] **Step 3: Commit and push**

```bash
cd "/Users/Shared/Dev/prepie project" && git add docs/SPRINT_STATE.md README.md
git commit -m "Record the single-user pivot in sprint doc and README

Auth+RLS deferred until a second user exists; SITE_PASSWORD Basic Auth
lock covers privacy in the meantime."
git push origin main
```

Expected: push succeeds; `git status -sb` shows `## main...origin/main` with no divergence.

- [ ] **Step 4: Deploy and verify the lock in production**

Prod deploys from pushes; if auto-deploy is off, run `vercel redeploy prepie-lovat.vercel.app` from the repo root. Then (assuming Task 2 Step 10 set the password):

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://prepie-lovat.vercel.app            # expect 401
curl -s -o /dev/null -w "%{http_code}\n" -u me:<password> https://prepie-lovat.vercel.app  # expect 200
```
