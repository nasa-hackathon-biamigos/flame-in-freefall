import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildCatalog } from "../src/lib/catalog/build";
import { csvCell, toExportCsv, toExportJson } from "../src/lib/catalog/export";
import { INVESTIGATION_SECTIONS, parseSections } from "../src/lib/catalog/sections";

const REPO_DATA = path.join(__dirname, "..", "data");
const tmpDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tmpDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

/** Builds a throwaway data/ dir with the real vocab plus the given files. */
async function dataDir(files: Record<string, string>): Promise<string> {
  const dir = path.join(await mkdtemp(path.join(os.tmpdir(), "sf-data-")), "data");
  tmpDirs.push(path.dirname(dir));
  const all = { "vocab.yaml": await readFile(path.join(REPO_DATA, "vocab.yaml"), "utf8"), ...files };
  for (const [rel, content] of Object.entries(all)) {
    const file = path.join(dir, rel);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  return dir;
}

const RAW_PSI_1 = JSON.stringify({
  psi_id: "PSI-1",
  title: "Test Investigation",
  acronym: "TEST",
  url: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-1",
  api_url: null,
  doi: null,
  license: null,
  psi_version: 1,
  fetched_at: "2026-11-14T00:00:00Z",
  metadata: {
    research_area: "Combustion Science",
    subresearch_area: "",
    project_type: "",
    flight_platform: "",
    managing_center: "",
    start_date: "",
    end_date: "",
    related_psi_ids: [],
    keywords: [],
    hardware: null,
  },
  sections: { objectives: "o", hypothesis: "", approach: "a", research_impacts: "" },
  publications: [],
  experimental_tables: [],
});

function ficha(fields: Record<string, string>, body = "## Summary\n\nText.\n"): string {
  const fm = { slug: "test", curation_status: "draft", ...fields };
  return `---\n${Object.entries(fm)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")}\n---\n\n${body}`;
}

const COMPLETE_FIELDS = {
  psi_id: '"PSI-1"',
  psi_url: '"https://psi.nasa.gov/physci/repo/data/investigations/PSI-1"',
  experiment_name: '"Test Investigation"',
  curation_status: "complete",
  fire_safety_pillar: "[prevention]",
  gravity: "[0g]",
  material_class: "[solid]",
  atmosphere:
    "{ o2_percent: { min: 21, max: 21 }, pressure_psi: { min: 14.7, max: 14.7 }, evidence: 'PSI table' }",
  variables_changed: "[flow]",
  variables_fixed: "[material]",
  prediction_tags: "[solid_flammability]",
  sources: '[{ label: "PSI", url: "https://psi.nasa.gov/" }]',
};
const COMPLETE_BODY = "## Summary\n\nDid things.\n\n## Why it matters for crew safety\n\n- Matters.\n";

describe("data:build on the repository data", () => {
  it("builds with no errors", async () => {
    const result = await buildCatalog(REPO_DATA, { includeExamples: true });
    expect(result.errors).toEqual([]);
    expect(result.catalog).not.toBeNull();
  });

  it("accepts the ficha template as a draft", async () => {
    const template = await readFile(path.join(REPO_DATA, "_template.md"), "utf8");
    const dir = await dataDir({ "investigations/example-slug.md": template });
    const result = await buildCatalog(dir, { includeExamples: true });
    expect(result.errors).toEqual([]);
    expect(result.stats.drafts).toBe(1);
    expect(result.catalog?.investigations).toEqual([]);
  });
});

describe("ficha validation", () => {
  it("accepts a complete ficha and joins the raw PSI text", async () => {
    const dir = await dataDir({
      "investigations/test.md": ficha(COMPLETE_FIELDS, COMPLETE_BODY),
      "raw/psi/PSI-1.json": RAW_PSI_1,
    });
    const result = await buildCatalog(dir, { includeExamples: false });
    expect(result.errors).toEqual([]);
    expect(result.stats.complete).toBe(1);
    const inv = result.catalog!.investigations[0];
    expect(inv.psi?.sections.objectives).toBe("o");
    expect(inv.sections.crew_safety).toBe("- Matters.");
  });

  it("rejects min > max with a Portuguese message on the right field", async () => {
    const dir = await dataDir({
      "investigations/test.md": ficha({ atmosphere: "{ o2_percent: { min: 40, max: 21 } }" }),
    });
    const { errors } = await buildCatalog(dir, { includeExamples: true });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      field: "atmosphere.o2_percent.max",
      message: "min não pode ser maior que max",
    });
  });

  it("lists the allowed values when a vocabulary value is wrong", async () => {
    const dir = await dataDir({ "investigations/test.md": ficha({ fire_safety_pillar: "[detecção]" }) });
    const { errors } = await buildCatalog(dir, { includeExamples: true });
    expect(errors[0].field).toBe("fire_safety_pillar[0]");
    expect(errors[0].message).toContain("prevention, detection, suppression");
  });

  it("flags misspelled field names", async () => {
    const dir = await dataDir({ "investigations/test.md": ficha({ pilar: "[detection]" }) });
    const { errors } = await buildCatalog(dir, { includeExamples: true });
    expect(errors[0].message).toContain("campo(s) desconhecido(s): pilar");
  });

  it("requires the file name to match the slug", async () => {
    const dir = await dataDir({ "investigations/other.md": ficha({}) });
    const { errors } = await buildCatalog(dir, { includeExamples: true });
    expect(errors[0]).toMatchObject({ field: "slug" });
  });

  it("requires raw PSI text for a partial ficha", async () => {
    const dir = await dataDir({
      "investigations/test.md": ficha({
        curation_status: "partial",
        psi_id: '"PSI-1"',
        experiment_name: "Test",
        fire_safety_pillar: "[detection]",
      }),
    });
    const { errors } = await buildCatalog(dir, { includeExamples: true });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("pnpm data:scrape PSI-1");
  });

  it("lists every missing vital field for a complete ficha", async () => {
    const dir = await dataDir({
      "investigations/test.md": ficha(
        { ...COMPLETE_FIELDS, variables_changed: "[]", prediction_tags: "[]" },
        "## Summary\n\n<!-- hint only -->\n",
      ),
      "raw/psi/PSI-1.json": RAW_PSI_1,
    });
    const fields = (await buildCatalog(dir, { includeExamples: true })).errors.map((e) => e.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        "variables_changed",
        "prediction_tags",
        "## Summary",
        "## Why it matters for crew safety",
      ]),
    );
  });

  it("accepts a complete ficha without atmosphere when Limitations explains why", async () => {
    const dir = await dataDir({
      "investigations/test.md": ficha(
        { ...COMPLETE_FIELDS, atmosphere: "{}" },
        `${COMPLETE_BODY}\n## Limitations\n\nNo controlled atmosphere (detection study).\n`,
      ),
      "raw/psi/PSI-1.json": RAW_PSI_1,
    });
    const { errors, warnings } = await buildCatalog(dir, { includeExamples: true });
    expect(errors).toEqual([]);
    expect(warnings.map((w) => w.field)).toContain("atmosphere");
  });

  it("rejects duplicate PSI-IDs", async () => {
    const dir = await dataDir({
      "investigations/test.md": ficha({ psi_id: '"PSI-1"' }),
      "investigations/test-2.md": ficha({ slug: "test-2", psi_id: '"PSI-1"' }),
    });
    const { errors } = await buildCatalog(dir, { includeExamples: true });
    expect(errors[0]).toMatchObject({ field: "psi_id" });
  });

  it("warns on unknown body headings", async () => {
    const dir = await dataDir({ "investigations/test.md": ficha({}, "## Sumary\n\nTypo.\n") });
    const { errors, warnings } = await buildCatalog(dir, { includeExamples: true });
    expect(errors).toEqual([]);
    expect(warnings[0].message).toContain('"## Sumary"');
  });
});

describe("examples and export", () => {
  it("drops example fichas in production and never exports them", async () => {
    const example = ficha(
      { ...COMPLETE_FIELDS, psi_id: "null", psi_url: "null", example: "true" },
      COMPLETE_BODY,
    );
    const dir = await dataDir({ "investigations/test.md": example });

    const dev = await buildCatalog(dir, { includeExamples: true });
    expect(dev.errors).toEqual([]);
    expect(dev.catalog!.investigations).toHaveLength(1);
    expect(toExportJson(dev.catalog!).investigations).toHaveLength(0);
    expect(toExportCsv(dev.catalog!).trim().split("\n")).toHaveLength(4); // 3 attribution lines + header

    const prod = await buildCatalog(dir, { includeExamples: false });
    expect(prod.catalog!.investigations).toHaveLength(0);
  });

  it("escapes CSV cells", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(14.7)).toBe("14.7");
    expect(csvCell('a, "b"')).toBe('"a, ""b"""');
  });
});

describe("parseSections", () => {
  it("drops HTML comments and merges known headings case-insensitively", () => {
    const { sections, unknownHeadings } = parseSections(
      "## summary\n\n<!-- hint -->\nReal text.\n\n## Notes\n\nx\n",
      INVESTIGATION_SECTIONS,
    );
    expect(sections.summary).toBe("Real text.");
    expect(sections.crew_safety).toBe("");
    expect(unknownHeadings).toEqual(["Notes"]);
  });
});
