import { describe, expect, it } from "vitest";
import type { Investigation } from "../src/lib/catalog/build";
import {
  applyFilters,
  earthCount,
  facetCounts,
  filtersToSearch,
  hasActiveFilters,
  parseFilters,
} from "../src/lib/catalog/filters";
import { parseCsv } from "../src/lib/csv";
import { formatRange, mapRange, psiToKpa } from "../src/lib/units";

function inv(slug: string, over: Partial<Investigation> = {}): Investigation {
  return {
    slug,
    psi_id: null,
    experiment_name: slug.toUpperCase(),
    acronym: slug.toUpperCase(),
    aliases: [],
    psi_url: null,
    curation_status: "partial",
    curators: [],
    last_reviewed: null,
    fire_safety_pillar: [],
    environment_tags: [],
    gravity: [],
    platform: null,
    hardware: [],
    material_class: [],
    solid_form: [],
    fuels: [],
    sample_geometry: null,
    atmosphere: {
      o2_percent: { min: null, max: null },
      pressure_psi: { min: null, max: null },
      diluents: [],
      flow_velocity_cm_s: { min: null, max: null },
      flow_notes: null,
      evidence: null,
    },
    sensors: [],
    measured_variables: [],
    variables_changed: [],
    variables_fixed: [],
    lunar_relevance: null,
    prediction_tags: [],
    related: [],
    earth_applications: null,
    sources: [],
    example: false,
    sections: { summary: "", crew_safety: "", earth_impact: "", key_results: "", limitations: "" },
    has_earth_transfer: false,
    psi: null,
    ...over,
  };
}

const LIST = [
  inv("same", {
    psi_id: "PSI-102",
    fire_safety_pillar: ["detection"],
    has_earth_transfer: true,
    aliases: ["Smoke"],
  }),
  inv("same-r", { fire_safety_pillar: ["detection"], curation_status: "complete" }),
  inv("bass", { fire_safety_pillar: ["prevention", "suppression"], environment_tags: ["lunar_habitat"] }),
];

describe("parseFilters / filtersToSearch", () => {
  it("reads comma lists from the URL and round-trips", () => {
    const f = parseFilters({ pillar: "detection,prevention", earth: "1", q: " sam " });
    expect(f.pillar).toEqual(["detection", "prevention"]);
    expect(f.earth).toBe(true);
    expect(f.q).toBe("sam");
    expect(parseFilters(new URLSearchParams(filtersToSearch(f).slice(1)))).toEqual(f);
  });

  it("knows when nothing is filtered", () => {
    expect(hasActiveFilters(parseFilters({}))).toBe(false);
    expect(filtersToSearch(parseFilters({}))).toBe("");
  });
});

describe("applyFilters", () => {
  const slugs = (sp: Record<string, string>) => applyFilters(LIST, parseFilters(sp)).map((i) => i.slug);

  it("ORs values within a facet and ANDs across facets", () => {
    expect(slugs({ pillar: "detection,prevention" })).toEqual(["same", "same-r", "bass"]);
    expect(slugs({ pillar: "detection", status: "complete" })).toEqual(["same-r"]);
  });

  it("matches text on acronym, aliases and PSI-ID, case-insensitively", () => {
    expect(slugs({ q: "psi-102" })).toEqual(["same"]);
    expect(slugs({ q: "smoke" })).toEqual(["same"]);
    expect(slugs({ q: "bas" })).toEqual(["bass"]);
  });

  it("filters by Earth applications", () => {
    expect(slugs({ earth: "1" })).toEqual(["same"]);
  });
});

describe("facetCounts", () => {
  it("counts each option against the other active filters only", () => {
    const f = parseFilters({ pillar: "detection", env: "lunar_habitat" });
    // pillar counts ignore the pillar filter but respect env
    expect(Object.fromEntries(facetCounts(LIST, f, "pillar"))).toEqual({ prevention: 1, suppression: 1 });
    expect(Object.fromEntries(facetCounts(LIST, f, "env"))).toEqual({});
    expect(earthCount(LIST, parseFilters({ pillar: "detection", earth: "1" }))).toBe(1);
  });
});

describe("units", () => {
  it("formats ranges and single values", () => {
    expect(formatRange({ min: 21, max: 30 }, "en")).toBe("21–30");
    expect(formatRange({ min: 14.7, max: 14.7 }, "en")).toBe("14.7");
    expect(formatRange({ min: 14.7, max: null }, "pt-BR")).toBe("14,7");
    expect(formatRange({ min: null, max: 10.2 }, "en")).toBe("≤ 10.2");
    expect(formatRange({ min: null, max: null }, "en")).toBeNull();
  });

  it("converts psi to kPa", () => {
    expect(psiToKpa(14.7)).toBeCloseTo(101.35, 1);
    expect(formatRange(mapRange({ min: 14.7, max: null }, psiToKpa), "en", 0)).toBe("101");
  });
});

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, CRLF and blank lines", () => {
    const csv = 'a,b\r\n"x, y","say ""hi"""\n\n1,"multi\nline"\n';
    expect(parseCsv(csv)).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["1", "multi\nline"],
    ]);
  });
});
