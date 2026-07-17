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
