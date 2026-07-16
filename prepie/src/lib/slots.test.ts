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
