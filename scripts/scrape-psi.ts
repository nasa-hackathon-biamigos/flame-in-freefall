/**
 * Pulls NASA PSI investigation records into data/raw/psi/ (docs/SPEC.md §6.8).
 *
 *   pnpm data:scrape              # combustion index + every investigation in it
 *   pnpm data:scrape PSI-25 ...   # only these investigations
 *   pnpm data:scrape --force      # re-download files that already exist
 *
 * PSI's web UI is an Angular SPA backed by an open JSON API (no auth, no robots.txt):
 *   search:  /geode-py/ws/repo/search?term=&type=investigation&ffield=&fvalue=
 *   detail:  /geode-py/ws/repo/investigations/<PSI-ID>
 *   files:   /geode-py/ws/studies/<PSI-ID>/download?file=&version=&redirect=false -> presigned S3 URL
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { psiPageUrl, type PsiIndexEntry, type PsiRaw } from "../src/lib/catalog/psi";

const BASE = "https://psi.nasa.gov";
const OUT_DIR = path.join(process.cwd(), "data", "raw", "psi");
const USER_AGENT = "SpaceFirefightersDataScraper/0.1 (NASA Space Apps Challenge 2026 project)";
const MIN_INTERVAL_MS = 1000;
const MAX_TABLE_BYTES = 200_000;

let lastRequestAt = 0;

async function politeFetch(url: string): Promise<Response> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json, text/*" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res;
}

// --- API response shapes (only the fields we use) ---

const SearchSchema = z.object({
  hits: z.object({
    total: z.number(),
    hits: z.array(
      z.object({
        _index: z.string(),
        _source: z.looseObject({
          Accession: z.string(),
          Title: z.string(),
          Acronym: z.string().default(""),
          Keywords: z.string().default(""),
          "Research Area": z.string().default(""),
          "SubResearch Area": z.string().default(""),
          "Project Type": z.string().default(""),
          "Flight Platform": z.string().default(""),
          "Related Investigations": z.string().default(""),
        }),
      }),
    ),
  }),
});

const DetailSchema = z.looseObject({
  accession: z.string(),
  title: z.string(),
  investigationAcronym: z.string().default(""),
  doi: z.string().default(""),
  licenseIdentifier: z.string().default(""),
  licenseName: z.string().default(""),
  licenseLink: z.string().default(""),
  version: z.number().nullable().default(null),
  researchArea: z.string().default(""),
  subResearchArea: z.string().default(""),
  projectType: z.string().default(""),
  flightProgram: z.string().default(""),
  managingNasaCenter: z.string().default(""),
  investigationStartDate: z.string().default(""),
  investigationEndDate: z.string().default(""),
  related_glds: z.string().default(""),
  experimentHardware: z.string().default(""),
  experimentHardwareLink: z.string().default(""),
  objective: z.string().default(""),
  hypothesis: z.string().default(""),
  approach: z.string().default(""),
  researchImpacts: z.string().default(""),
  publications: z
    .array(
      z.looseObject({
        title: z.string().default(""),
        authorList: z.string().default(""),
        doi: z.string().default(""),
      }),
    )
    .default([]),
  experimentalTable: z
    .array(
      z.looseObject({
        file_name: z.string(),
        file_size: z.number().default(0),
        version: z.number().default(1),
        restricted: z.boolean().default(false),
        visible: z.boolean().default(true),
      }),
    )
    .default([]),
});

// --- text helpers ---

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };

function cleanText(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) => ENTITIES[e] ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** PSI joins list values with runs of 3+ spaces. */
function splitList(value: string): string[] {
  return value
    .split(/\s{3,}|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function psiIds(value: string): string[] {
  return [...new Set(value.match(/PSI-\d+/g) ?? [])];
}

// --- fetchers ---

async function searchCombustion(): Promise<
  Map<string, z.infer<typeof SearchSchema>["hits"]["hits"][number]["_source"]>
> {
  const queries = [
    `${BASE}/geode-py/ws/repo/search?type=investigation&size=500&ffield=Research%20Area&fvalue=combustion%20science`,
    `${BASE}/geode-py/ws/repo/search?type=investigation&size=500&term=combustion`,
  ];
  const found = new Map<string, z.infer<typeof SearchSchema>["hits"]["hits"][number]["_source"]>();
  for (const q of queries) {
    const data = SearchSchema.parse(await (await politeFetch(q)).json());
    if (data.hits.hits.length < data.hits.total) {
      console.warn(`  ! search returned ${data.hits.hits.length} of ${data.hits.total} hits: ${q}`);
    }
    for (const h of data.hits.hits) {
      if (h._index === "investigation") found.set(h._source.Accession, h._source);
    }
  }
  return found;
}

async function fetchTableCsv(psiId: string, fileName: string, version: number): Promise<string> {
  const q = new URLSearchParams({ file: fileName, version: String(version), redirect: "false" });
  const presigned = (
    await (await politeFetch(`${BASE}/geode-py/ws/studies/${psiId}/download?${q}`)).text()
  ).trim();
  if (!presigned.startsWith("https://")) throw new Error(`unexpected download response for ${fileName}`);
  return (await (await politeFetch(presigned)).text()).replace(/\r\n?/g, "\n").trim();
}

async function fetchInvestigation(psiId: string, keywords: string[]): Promise<PsiRaw> {
  const apiUrl = `${BASE}/geode-py/ws/repo/investigations/${psiId}`;
  const d = DetailSchema.parse(await (await politeFetch(apiUrl)).json());

  const experimental_tables: PsiRaw["experimental_tables"] = [];
  for (const t of d.experimentalTable) {
    if (t.restricted || !t.visible) continue;
    if (t.file_size > MAX_TABLE_BYTES) {
      console.warn(`  ! ${psiId}: skipping large table ${t.file_name} (${t.file_size} bytes)`);
      continue;
    }
    try {
      experimental_tables.push({
        file_name: t.file_name,
        csv: await fetchTableCsv(psiId, t.file_name, t.version),
      });
    } catch (err) {
      console.warn(`  ! ${psiId}: could not download ${t.file_name}: ${(err as Error).message}`);
    }
  }

  return {
    psi_id: d.accession,
    title: cleanText(d.title),
    acronym: cleanText(d.investigationAcronym),
    url: psiPageUrl(d.accession),
    api_url: apiUrl,
    doi: d.doi || null,
    license: d.licenseIdentifier
      ? { id: d.licenseIdentifier, name: d.licenseName, url: d.licenseLink }
      : null,
    psi_version: d.version,
    fetched_at: new Date().toISOString(),
    metadata: {
      research_area: d.researchArea,
      subresearch_area: d.subResearchArea,
      project_type: d.projectType,
      flight_platform: d.flightProgram,
      managing_center: d.managingNasaCenter,
      start_date: d.investigationStartDate,
      end_date: d.investigationEndDate,
      related_psi_ids: psiIds(d.related_glds),
      keywords,
      hardware: d.experimentHardware
        ? { name: cleanText(d.experimentHardware), link: d.experimentHardwareLink || null }
        : null,
    },
    sections: {
      objectives: cleanText(d.objective),
      hypothesis: cleanText(d.hypothesis),
      approach: cleanText(d.approach),
      research_impacts: cleanText(d.researchImpacts),
    },
    publications: d.publications
      .filter((p) => p.title.trim())
      .map((p) => ({ title: cleanText(p.title), authors: cleanText(p.authorList), doi: p.doi || null })),
    experimental_tables,
  };
}

// --- main ---

async function exists(file: string): Promise<boolean> {
  return stat(file).then(
    () => true,
    () => false,
  );
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const explicitIds = args.filter((a) => /^PSI-\d+$/i.test(a)).map((a) => a.toUpperCase());
  await mkdir(OUT_DIR, { recursive: true });

  const indexFile = path.join(OUT_DIR, "_index.json");
  let targets: Array<{ psiId: string; keywords: string[] }>;

  if (explicitIds.length > 0) {
    let known = new Map<string, string[]>();
    if (await exists(indexFile)) {
      const idx = JSON.parse(await readFile(indexFile, "utf8")) as { investigations: PsiIndexEntry[] };
      known = new Map(idx.investigations.map((e) => [e.psi_id, e.keywords]));
    }
    targets = explicitIds.map((psiId) => ({ psiId, keywords: known.get(psiId) ?? [] }));
  } else {
    console.log("Searching PSI for combustion investigations…");
    const hits = await searchCombustion();
    const investigations = [...hits.values()]
      .map((s) => ({
        psi_id: s.Accession,
        acronym: cleanText(s.Acronym),
        title: cleanText(s.Title),
        url: psiPageUrl(s.Accession),
        research_area: s["Research Area"],
        subresearch_area: s["SubResearch Area"],
        project_type: s["Project Type"],
        flight_platform: s["Flight Platform"],
        related_psi_ids: psiIds(s["Related Investigations"]),
        keywords: splitList(s.Keywords),
      }))
      .sort((a, b) => Number(a.psi_id.slice(4)) - Number(b.psi_id.slice(4)));
    await writeJson(indexFile, {
      source: "NASA Physical Sciences Informatics (https://psi.nasa.gov/) — repository search API",
      query: "Research Area = Combustion Science, plus full-text term 'combustion'",
      generated_at: new Date().toISOString(),
      count: investigations.length,
      investigations,
    });
    console.log(`  wrote _index.json (${investigations.length} investigations)`);
    targets = investigations.map((e) => ({ psiId: e.psi_id, keywords: e.keywords }));
  }

  let written = 0;
  let skipped = 0;
  const failed: string[] = [];
  for (const { psiId, keywords } of targets) {
    const file = path.join(OUT_DIR, `${psiId}.json`);
    if (!force && (await exists(file))) {
      skipped++;
      continue;
    }
    try {
      const raw = await fetchInvestigation(psiId, keywords);
      await writeJson(file, raw);
      written++;
      console.log(`  ${psiId} ${raw.acronym || raw.title} (${raw.experimental_tables.length} table(s))`);
    } catch (err) {
      failed.push(psiId);
      console.error(`  x ${psiId}: ${(err as Error).message}`);
    }
  }

  console.log(
    `Done: ${written} written, ${skipped} already present (use --force to refresh), ${failed.length} failed.`,
  );
  if (failed.length > 0) {
    console.error(`Failed: ${failed.join(", ")}. Fallback: paste the text by hand (see README).`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
