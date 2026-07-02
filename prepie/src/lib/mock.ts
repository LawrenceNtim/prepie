import { materializeJapanMock } from "./demo-seed";

// ── Seeded scenario: the Japan traveler ─────────────────────────────────
// Intentionally pedagogical. Running `npm run dev` with no DB shows a live
// runway that exercises every part of the model. Dates are relative to today.

const { profile, events, tasks } = materializeJapanMock();

export const mockProfile = profile;
export const mockEvents = events;
export const mockTasks = tasks;
