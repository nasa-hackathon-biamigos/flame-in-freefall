/**
 * Creates draft fichas from data/_template.md with the PSI identification pre-filled.
 *
 *   pnpm data:scaffold                       # the 12 hero investigations (docs/SPEC.md §6.4)
 *   pnpm data:scaffold PSI-25 PSI-68         # specific investigations
 *   pnpm data:scaffold PSI-115 --slug same-smoke-modeling
 *
 * Only identification copied verbatim from PSI is filled in (psi_id, psi_url, name, acronym, source).
 * Everything that needs judgment stays null for the curators. Never overwrites an existing file.
 */
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { PsiRawSchema, type PsiRaw } from "../src/lib/catalog/psi";

const DATA = path.join(process.cwd(), "data");

type Known = { slug: string; acronym: string; curator?: string };

/** Slugs for investigations we know by name. Heroes carry their curator from docs/DIVISAO-EQUIPE.md. */
const KNOWN: Record<string, Known> = {
  "PSI-26": { slug: "bass", acronym: "BASS", curator: "anna" },
  "PSI-107": { slug: "spice", acronym: "SPICE", curator: "anna" },
  "PSI-106": { slug: "slice", acronym: "SLICE", curator: "anna" },
  "PSI-20": { slug: "bre", acronym: "BRE", curator: "anna" },
  "PSI-159": { slug: "cfi-g", acronym: "CFI-G", curator: "anna" },
  "PSI-98": { slug: "saffire-i", acronym: "SAFFIRE-I", curator: "anna" },
  "PSI-99": { slug: "saffire-ii", acronym: "SAFFIRE-II", curator: "anna" },
  "PSI-100": { slug: "saffire-iii", acronym: "SAFFIRE-III", curator: "anna" },
  "PSI-102": { slug: "same", acronym: "SAME", curator: "juliana" },
  "PSI-101": { slug: "same-r", acronym: "SAME-R", curator: "juliana" },
  "PSI-69": { slug: "flex", acronym: "FLEX", curator: "juliana" },
  "PSI-39": { slug: "cfi", acronym: "CFI", curator: "juliana" },
  "PSI-25": { slug: "bass-ii", acronym: "BASS-II" },
  "PSI-68": { slug: "flex-2", acronym: "FLEX-2" },
  "PSI-47": { slug: "daft", acronym: "DAFT" },
};

const HEROES = Object.entries(KNOWN)
  .filter(([, k]) => k.curator)
  .map(([id]) => id);

const q = (s: string) => JSON.stringify(s); // JSON strings are valid YAML double-quoted scalars

function setField(text: string, key: string, value: string): string {
  const re = new RegExp(`^${key}:.*$`, "m");
  if (!re.test(text)) throw new Error(`template has no top-level "${key}:" line`);
  return text.replace(re, `${key}: ${value}`);
}

function kebab(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function render(template: string, raw: PsiRaw, known: Known | undefined, slug: string): string {
  const acronym = known?.acronym ?? (raw.acronym || null);
  const aliases = [...new Set([acronym, raw.acronym].filter((a): a is string => !!a))];
  const related = raw.metadata.related_psi_ids.flatMap((id) => (KNOWN[id] ? [KNOWN[id].slug] : []));
  const relatedNote = raw.metadata.related_psi_ids
    .map((id) => (KNOWN[id] ? `${id} (${KNOWN[id].slug})` : id))
    .join(", ");

  const header = [
    `# Skeleton generated from NASA PSI ${raw.psi_id} (fetched ${raw.fetched_at.slice(0, 10)}) by \`pnpm data:scaffold\`.`,
    `# Read the PSI text in data/raw/psi/${raw.psi_id}.json (objectives, hypothesis, approach,`,
    `# research impacts, experimental tables, publications) and fill in the fields below.`,
    `# What PSI says (hints, not decisions):`,
    `#   platform: ${q(raw.metadata.flight_platform || "not stated")}`,
    `#   hardware: ${q(raw.metadata.hardware?.name ?? "not stated")}`,
    `#   area: ${q(raw.metadata.research_area)} / ${q(raw.metadata.subresearch_area)}`,
    `#   related: ${relatedNote || "none"}`,
    `# When identification + pillar are reviewed, change curation_status to partial.`,
  ];

  const [, fm, body] = template.split(/^---\s*$/m);
  const fmLines = fm.split("\n");
  const firstField = fmLines.findIndex((l) => /^[a-z_]+:/.test(l));
  let out = ["", ...header, ...fmLines.slice(firstField)].join("\n");

  out = setField(out, "slug", `${slug}`);
  out = setField(out, "psi_id", q(raw.psi_id));
  out = setField(out, "experiment_name", q(raw.title));
  out = setField(out, "acronym", acronym ? q(acronym) : "null");
  out = setField(out, "aliases", `[${aliases.map(q).join(", ")}]`);
  out = setField(out, "psi_url", q(raw.url));
  out = setField(out, "curation_status", "draft");
  out = setField(out, "curators", known?.curator ? `[${known.curator}]` : "[]");
  out = setField(out, "related", `[${related.join(", ")}]`);
  out = out.replace(
    /^ {2}- \{ label: "NASA PSI entry", url: null \}$/m,
    `  - { label: ${q(`NASA PSI ${raw.psi_id}`)}, url: ${q(raw.url)} }`,
  );
  return `---${out}---${body}`;
}

async function exists(file: string) {
  return stat(file).then(
    () => true,
    () => false,
  );
}

async function main() {
  const args = process.argv.slice(2);
  const slugFlag = args.indexOf("--slug");
  const customSlug = slugFlag >= 0 ? args[slugFlag + 1] : undefined;
  const ids = args.filter((a) => /^PSI-\d+$/i.test(a)).map((a) => a.toUpperCase());
  const targets = ids.length > 0 ? ids : HEROES;
  if (customSlug && targets.length !== 1) throw new Error("--slug works with exactly one PSI-ID");

  const template = await readFile(path.join(DATA, "_template.md"), "utf8");
  let created = 0;
  for (const psiId of targets) {
    const rawFile = path.join(DATA, "raw", "psi", `${psiId}.json`);
    if (!(await exists(rawFile))) {
      console.error(`  x ${psiId}: no raw PSI file. Run: pnpm data:scrape ${psiId}`);
      process.exitCode = 1;
      continue;
    }
    const raw = PsiRawSchema.parse(JSON.parse(await readFile(rawFile, "utf8")));
    const known = KNOWN[psiId];
    const slug = customSlug ?? known?.slug ?? kebab(raw.acronym);
    if (!slug) {
      console.error(`  x ${psiId}: PSI has no acronym; pass --slug <kebab-case-name>`);
      process.exitCode = 1;
      continue;
    }
    const file = path.join(DATA, "investigations", `${slug}.md`);
    if (await exists(file)) {
      console.log(`  - ${slug}.md already exists, left untouched`);
      continue;
    }
    await writeFile(file, render(template, raw, known, slug), "utf8");
    created++;
    console.log(`  + data/investigations/${slug}.md (${psiId})`);
  }
  console.log(`Done: ${created} skeleton(s) created.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
