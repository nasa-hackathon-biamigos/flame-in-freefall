import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import YAML from "yaml";
import { zodIssuesToProblems, type Problem } from "./issues";
import { psiPageUrl, PsiRawSchema, type PsiRaw } from "./psi";
import {
  makeSchemas,
  type ComparisonFrontmatter,
  type InvestigationFrontmatter,
  type ReferenceAtmosphere,
  type SpinoffFrontmatter,
} from "./schema";
import {
  COMPARISON_SECTIONS,
  INVESTIGATION_SECTIONS,
  parseSections,
  type ComparisonSectionKey,
  type InvestigationSectionKey,
} from "./sections";
import { VocabSchema, type Vocab } from "./vocab";

export type Investigation = InvestigationFrontmatter & {
  sections: Record<InvestigationSectionKey, string>;
  has_earth_transfer: boolean;
  psi: PsiRaw | null;
};

export type Spinoff = SpinoffFrontmatter & { body: string };

export type Comparison = ComparisonFrontmatter & {
  id: string;
  sections: Record<ComparisonSectionKey, string>;
};

export type CatalogReferenceAtmosphere = ReferenceAtmosphere & { drawable: boolean };

export type Catalog = {
  version: string;
  generated_at: string;
  includes_examples: boolean;
  investigations: Investigation[];
  spinoffs: Spinoff[];
  comparisons: Comparison[];
  reference_atmospheres: CatalogReferenceAtmosphere[];
  vocab: Vocab;
};

export type BuildStats = {
  files: number;
  drafts: number;
  complete: number;
  partial: number;
  examples: number;
  with_earth: number;
};

export type BuildResult = {
  catalog: Catalog | null;
  errors: Problem[];
  warnings: Problem[];
  stats: BuildStats;
};

type Ctx = { dataDir: string; errors: Problem[]; warnings: Problem[]; hash: ReturnType<typeof createHash> };

const rel = (ctx: Ctx, file: string) =>
  path.relative(path.dirname(ctx.dataDir), file).split(path.sep).join("/");

async function listFiles(dir: string, ext: string): Promise<string[]> {
  try {
    const names = await readdir(dir);
    return names
      .filter((n) => n.endsWith(ext) && !n.startsWith("_") && !n.startsWith("."))
      .sort()
      .map((n) => path.join(dir, n));
  } catch {
    return [];
  }
}

async function readTracked(ctx: Ctx, file: string): Promise<string> {
  const text = await readFile(file, "utf8");
  ctx.hash.update(rel(ctx, file)).update("\0").update(text).update("\0");
  return text;
}

function parseYaml(ctx: Ctx, file: string, text: string): { ok: true; data: unknown } | { ok: false } {
  const doc = YAML.parseDocument(text, { prettyErrors: true });
  if (doc.errors.length > 0) {
    for (const e of doc.errors) {
      ctx.errors.push({
        file: rel(ctx, file),
        message: `YAML inválido (linha ${e.linePos?.[0].line ?? "?"}): ${e.message.split("\n")[0]}`,
      });
    }
    return { ok: false };
  }
  return { ok: true, data: doc.toJS() };
}

function parseMarkdown(
  ctx: Ctx,
  file: string,
  text: string,
): { ok: true; data: unknown; body: string } | { ok: false } {
  try {
    const parsed = matter(text, {
      engines: { yaml: (s: string) => YAML.parse(s) as object },
    });
    return { ok: true, data: parsed.data, body: parsed.content };
  } catch (err) {
    const msg = (err as Error).message.split("\n")[0];
    ctx.errors.push({ file: rel(ctx, file), message: `cabeçalho YAML (entre os ---) inválido: ${msg}` });
    return { ok: false };
  }
}

const isBlank = (s: string | null | undefined) => !s || s.trim() === "";

/** Rules that depend on curation_status (docs/SPEC.md §6.1–6.2). */
function checkStatusRules(
  ctx: Ctx,
  file: string,
  fm: InvestigationFrontmatter,
  sections: Record<InvestigationSectionKey, string>,
  psi: PsiRaw | null,
) {
  const err = (field: string | undefined, message: string) => ctx.errors.push({ file, field, message });
  const warn = (field: string | undefined, message: string) => ctx.warnings.push({ file, field, message });
  const forStatus = `obrigatório para curation_status: ${fm.curation_status}`;

  if (fm.solid_form.length > 0 && !fm.material_class.includes("solid")) {
    err("solid_form", 'só pode ser preenchido quando material_class inclui "solid"');
  }
  if (fm.psi_id && fm.psi_url && fm.psi_url !== psiPageUrl(fm.psi_id)) {
    warn("psi_url", `difere do link padrão do PSI para ${fm.psi_id} (${psiPageUrl(fm.psi_id)}). Confira.`);
  }
  if (fm.curation_status === "draft") return;

  if (!fm.example) {
    if (!fm.psi_id) err("psi_id", forStatus);
    else if (!psi)
      err(
        "psi_id",
        `texto bruto do PSI não encontrado em data/raw/psi/${fm.psi_id}.json. Rode: pnpm data:scrape ${fm.psi_id}`,
      );
  }
  if (isBlank(fm.experiment_name)) err("experiment_name", forStatus);
  if (fm.fire_safety_pillar.length === 0) err("fire_safety_pillar", `${forStatus} (pelo menos 1 pilar)`);
  if (fm.curation_status === "partial") return;

  // complete
  if (!fm.example && !fm.psi_url) err("psi_url", forStatus);
  if (fm.material_class.length === 0) err("material_class", `${forStatus} (pelo menos 1)`);
  if (fm.gravity.length === 0) err("gravity", `${forStatus} (pelo menos 1)`);
  if (fm.variables_changed.length === 0) err("variables_changed", forStatus);
  if (fm.variables_fixed.length === 0) err("variables_fixed", forStatus);
  if (fm.prediction_tags.length === 0) err("prediction_tags", `${forStatus} (pelo menos 1)`);
  if (!fm.sources.some((s) => s.url)) err("sources", `${forStatus}: pelo menos 1 fonte com url`);
  if (isBlank(sections.summary)) err("## Summary", `seção vazia — ${forStatus}`);
  if (isBlank(sections.crew_safety)) err("## Why it matters for crew safety", `seção vazia — ${forStatus}`);

  const a = fm.atmosphere;
  const hasAtmosphere = a.o2_percent.min !== null && a.pressure_psi.min !== null;
  if (!hasAtmosphere) {
    if (isBlank(a.flow_notes) && isBlank(sections.limitations)) {
      err(
        "atmosphere",
        "preencha o2_percent.min e pressure_psi.min, ou explique em atmosphere.flow_notes ou em ## Limitations por que o experimento não tem atmosfera controlada",
      );
    } else {
      warn("atmosphere", "sem O₂/pressão: a ficha fica fora do mapa O₂×P (justificativa aceita)");
    }
  } else if (isBlank(a.evidence)) {
    err(
      "atmosphere.evidence",
      "diga de onde vieram os números de O₂/pressão (seção do PSI, tabela, artigo ou URL)",
    );
  }
}

export async function buildCatalog(
  dataDir: string,
  opts: { includeExamples: boolean },
): Promise<BuildResult> {
  const ctx: Ctx = { dataDir, errors: [], warnings: [], hash: createHash("sha256") };
  const stats: BuildStats = { files: 0, drafts: 0, complete: 0, partial: 0, examples: 0, with_earth: 0 };
  ctx.hash.update(`examples:${opts.includeExamples}\0`);

  // vocab — everything else depends on it
  const vocabFile = path.join(dataDir, "vocab.yaml");
  const vocabYaml = parseYaml(ctx, vocabFile, await readTracked(ctx, vocabFile));
  if (!vocabYaml.ok) return { catalog: null, errors: ctx.errors, warnings: ctx.warnings, stats };
  const vocabParsed = VocabSchema.safeParse(vocabYaml.data);
  if (!vocabParsed.success) {
    ctx.errors.push(...zodIssuesToProblems(rel(ctx, vocabFile), vocabParsed.error.issues, vocabYaml.data));
    return { catalog: null, errors: ctx.errors, warnings: ctx.warnings, stats };
  }
  const vocab = vocabParsed.data;
  const schemas = makeSchemas(vocab);

  // raw PSI text
  const psiById = new Map<string, PsiRaw>();
  for (const file of await listFiles(path.join(dataDir, "raw", "psi"), ".json")) {
    const r = PsiRawSchema.safeParse(JSON.parse(await readTracked(ctx, file)));
    if (r.success) psiById.set(r.data.psi_id, r.data);
    else ctx.errors.push(...zodIssuesToProblems(rel(ctx, file), r.error.issues, null));
  }

  // investigations
  const all: Investigation[] = [];
  const allSlugs = new Set<string>();
  const psiIdOwner = new Map<string, string>();
  for (const file of await listFiles(path.join(dataDir, "investigations"), ".md")) {
    stats.files++;
    const relFile = rel(ctx, file);
    const md = parseMarkdown(ctx, file, await readTracked(ctx, file));
    if (!md.ok) continue;
    const parsed = schemas.InvestigationFrontmatter.safeParse(md.data);
    if (!parsed.success) {
      ctx.errors.push(...zodIssuesToProblems(relFile, parsed.error.issues, md.data));
      continue;
    }
    const fm = parsed.data;
    const expectedSlug = path.basename(file, ".md");
    if (fm.slug !== expectedSlug) {
      ctx.errors.push({
        file: relFile,
        field: "slug",
        message: `deve ser igual ao nome do arquivo ("${expectedSlug}")`,
      });
    }
    allSlugs.add(fm.slug);
    if (fm.psi_id) {
      const owner = psiIdOwner.get(fm.psi_id);
      if (owner)
        ctx.errors.push({ file: relFile, field: "psi_id", message: `${fm.psi_id} já é usado por ${owner}` });
      else psiIdOwner.set(fm.psi_id, relFile);
    }

    const { sections, unknownHeadings } = parseSections(md.body, INVESTIGATION_SECTIONS);
    for (const h of unknownHeadings) {
      ctx.warnings.push({
        file: relFile,
        message: `seção "## ${h}" desconhecida (será ignorada). Seções válidas: ${Object.values(INVESTIGATION_SECTIONS).join(" · ")}`,
      });
    }
    const psi = fm.psi_id ? (psiById.get(fm.psi_id) ?? null) : null;
    checkStatusRules(ctx, relFile, fm, sections, psi);

    if (fm.curation_status === "draft") {
      stats.drafts++;
      continue;
    }
    if (fm.example) {
      stats.examples++;
      if (!opts.includeExamples) continue;
    }
    all.push({ ...fm, sections, psi, has_earth_transfer: fm.earth_applications !== null });
  }

  // spinoffs
  const spinoffs: Spinoff[] = [];
  for (const file of await listFiles(path.join(dataDir, "spinoffs"), ".md")) {
    const relFile = rel(ctx, file);
    const md = parseMarkdown(ctx, file, await readTracked(ctx, file));
    if (!md.ok) continue;
    const parsed = schemas.SpinoffFrontmatter.safeParse(md.data);
    if (!parsed.success) {
      ctx.errors.push(...zodIssuesToProblems(relFile, parsed.error.issues, md.data));
      continue;
    }
    if (parsed.data.slug !== path.basename(file, ".md")) {
      ctx.errors.push({
        file: relFile,
        field: "slug",
        message: `deve ser igual ao nome do arquivo ("${path.basename(file, ".md")}")`,
      });
    }
    if (parsed.data.example && !opts.includeExamples) continue;
    spinoffs.push({ ...parsed.data, body: md.body.replace(/<!--[\s\S]*?-->/g, "").trim() });
  }

  // comparisons
  const comparisons: Comparison[] = [];
  for (const file of await listFiles(path.join(dataDir, "comparisons"), ".md")) {
    const relFile = rel(ctx, file);
    const md = parseMarkdown(ctx, file, await readTracked(ctx, file));
    if (!md.ok) continue;
    const parsed = schemas.ComparisonFrontmatter.safeParse(md.data);
    if (!parsed.success) {
      ctx.errors.push(...zodIssuesToProblems(relFile, parsed.error.issues, md.data));
      continue;
    }
    const id = parsed.data.slugs.join("--");
    if (path.basename(file, ".md") !== id) {
      ctx.errors.push({ file: relFile, field: "slugs", message: `o nome do arquivo deve ser "${id}.md"` });
    }
    for (const s of parsed.data.slugs) {
      if (!allSlugs.has(s))
        ctx.errors.push({
          file: relFile,
          field: "slugs",
          message: `ficha "${s}" não existe em data/investigations/`,
        });
    }
    const { sections, unknownHeadings } = parseSections(md.body, COMPARISON_SECTIONS);
    for (const h of unknownHeadings) {
      ctx.warnings.push({
        file: relFile,
        message: `seção "## ${h}" desconhecida. Seções válidas: ${Object.values(COMPARISON_SECTIONS).join(" · ")}`,
      });
    }
    if (parsed.data.example && !opts.includeExamples) continue;
    comparisons.push({ ...parsed.data, id, sections });
  }

  // reference atmospheres
  let reference_atmospheres: CatalogReferenceAtmosphere[] = [];
  const atmFile = path.join(dataDir, "reference_atmospheres.yaml");
  const atmYaml = parseYaml(ctx, atmFile, await readTracked(ctx, atmFile).catch(() => "[]"));
  if (atmYaml.ok) {
    const parsed = schemas.ReferenceAtmospheres.safeParse(atmYaml.data ?? []);
    if (parsed.success) {
      reference_atmospheres = parsed.data.map((z) => ({
        ...z,
        drawable: z.source_url !== null && z.o2_percent.min !== null && z.pressure_psi.min !== null,
      }));
    } else {
      ctx.errors.push(...zodIssuesToProblems(rel(ctx, atmFile), parsed.error.issues, atmYaml.data));
    }
  }

  // cross-file links (warnings: they don't break the app)
  const published = new Set(all.map((i) => i.slug));
  const spinoffBySlug = new Map(spinoffs.map((s) => [s.slug, s]));
  for (const inv of all) {
    const file = `data/investigations/${inv.slug}.md`;
    for (const r of inv.related) {
      if (!allSlugs.has(r)) ctx.warnings.push({ file, field: "related", message: `ficha "${r}" não existe` });
    }
    for (const s of inv.earth_applications?.spinoff_slugs ?? []) {
      const sp = spinoffBySlug.get(s);
      if (!sp)
        ctx.warnings.push({
          file,
          field: "earth_applications.spinoff_slugs",
          message: `spinoff "${s}" não existe em data/spinoffs/`,
        });
      else if (!sp.related_slugs.includes(inv.slug)) {
        ctx.warnings.push({
          file,
          field: "earth_applications.spinoff_slugs",
          message: `data/spinoffs/${s}.md não lista "${inv.slug}" em related_slugs (as duas pontas devem bater)`,
        });
      }
    }
  }
  for (const sp of spinoffs) {
    const file = `data/spinoffs/${sp.slug}.md`;
    for (const r of sp.related_slugs) {
      if (!allSlugs.has(r))
        ctx.warnings.push({ file, field: "related_slugs", message: `ficha "${r}" não existe` });
      else if (published.has(r)) {
        const inv = all.find((i) => i.slug === r);
        if (!inv?.earth_applications?.spinoff_slugs.includes(sp.slug)) {
          ctx.warnings.push({
            file,
            field: "related_slugs",
            message: `a ficha "${r}" não lista "${sp.slug}" em earth_applications.spinoff_slugs`,
          });
        }
      }
    }
  }

  for (const inv of all) {
    if (inv.example) continue;
    if (inv.curation_status === "complete") stats.complete++;
    else stats.partial++;
    if (inv.has_earth_transfer) stats.with_earth++;
  }

  const catalog: Catalog = {
    version: ctx.hash.digest("hex").slice(0, 12),
    generated_at: new Date().toISOString(),
    includes_examples: opts.includeExamples,
    investigations: all.sort((a, b) => a.slug.localeCompare(b.slug)),
    spinoffs,
    comparisons,
    reference_atmospheres,
    vocab,
  };
  return { catalog, errors: ctx.errors, warnings: ctx.warnings, stats };
}
