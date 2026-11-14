import { z } from "zod";
import { vocabIds, type Vocab, type VocabKey } from "./vocab";

/**
 * Zod schemas for curated data files (docs/SPEC.md §6). Vocabulary enums come from data/vocab.yaml,
 * so the schemas are built at runtime from the loaded vocab.
 *
 * These check the *format* of a file. Rules that depend on `curation_status` (what `partial` and
 * `complete` require) live in build.ts, because they need the body sections and the raw PSI files.
 */

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PSI_ID_RE = /^PSI-\d+$/;

const slug = () => z.string().regex(SLUG_RE, "use só letras minúsculas, números e hífens (ex.: same-r)");
const nullableText = () => z.string().trim().min(1).nullable().default(null);
const textList = () => z.array(z.string().trim().min(1)).default([]);

function range(min: number, max: number, opts: { exclusiveMin?: boolean } = {}) {
  const n = opts.exclusiveMin ? z.number().gt(min).lte(max) : z.number().gte(min).lte(max);
  return z
    .strictObject({ min: n.nullable().default(null), max: n.nullable().default(null) })
    .default({ min: null, max: null })
    .refine((r) => r.min === null || r.max === null || r.min <= r.max, {
      message: "min não pode ser maior que max",
      path: ["max"],
    });
}

export const CURATION_STATUSES = ["draft", "partial", "complete"] as const;
export type CurationStatus = (typeof CURATION_STATUSES)[number];

const SourceSchema = z.strictObject({
  label: z.string().trim().min(1),
  url: z.url().nullable().default(null),
});

export function makeSchemas(vocab: Vocab) {
  const term = (key: VocabKey) => z.enum(vocabIds(vocab, key) as [string, ...string[]]);
  const terms = (key: VocabKey) => z.array(term(key)).default([]);

  const InvestigationFrontmatter = z.strictObject({
    slug: slug(),
    psi_id: z.string().regex(PSI_ID_RE, 'use o formato "PSI-123"').nullable().default(null),
    experiment_name: nullableText(),
    acronym: nullableText(),
    aliases: textList(),
    psi_url: z.url().nullable().default(null),
    curation_status: z.enum(CURATION_STATUSES),
    curators: textList(),
    last_reviewed: z.iso.date().nullable().default(null),

    fire_safety_pillar: terms("pillar"),
    environment_tags: terms("environment"),
    gravity: terms("gravity"),
    platform: term("platform").nullable().default(null),
    hardware: terms("hardware"),
    material_class: terms("material_class"),
    solid_form: terms("solid_form"),
    fuels: textList(),
    sample_geometry: nullableText(),

    atmosphere: z
      .strictObject({
        o2_percent: range(0, 100),
        pressure_psi: range(0, 30, { exclusiveMin: true }),
        diluents: textList(),
        flow_velocity_cm_s: range(0, 1000),
        flow_notes: nullableText(),
        evidence: nullableText(),
      })
      .prefault({}),

    sensors: textList(),
    measured_variables: textList(),
    variables_changed: textList(),
    variables_fixed: textList(),
    lunar_relevance: z.number().int().min(0).max(3).nullable().default(null),
    prediction_tags: terms("prediction_tags"),
    related: z.array(slug()).default([]),

    earth_applications: z
      .strictObject({
        sectors: terms("earth_sectors"),
        spinoff_slugs: z.array(slug()).default([]),
        transfer_type: term("transfer_type").nullable().default(null),
      })
      .nullable()
      .default(null),

    sources: z.array(SourceSchema).default([]),
    example: z.boolean().default(false),
  });

  const SpinoffFrontmatter = z.strictObject({
    slug: slug(),
    title: z.string().trim().min(1),
    category: term("spinoff_category"),
    spinoff_url: z.url().nullable().default(null),
    related_slugs: z.array(slug()).default([]),
    sectors: terms("earth_sectors"),
    transfer_type: term("transfer_type").nullable().default(null),
    sources: z.array(SourceSchema).default([]),
    example: z.boolean().default(false),
  });

  const ComparisonFrontmatter = z.strictObject({
    slugs: z.array(slug()).length(2),
    authors: textList(),
    sources: z.array(SourceSchema).default([]),
    example: z.boolean().default(false),
  });

  const ReferenceAtmospheres = z.array(
    z.strictObject({
      id: z.string().regex(/^[a-z0-9_]+$/, "use snake_case (ex.: lunar_habitat)"),
      label: z.strictObject({ en: z.string().min(1), "pt-BR": z.string().min(1) }),
      o2_percent: range(0, 100),
      pressure_psi: range(0, 30, { exclusiveMin: true }),
      source_url: z.url().nullable().default(null),
      notes: nullableText(),
    }),
  );

  return { InvestigationFrontmatter, SpinoffFrontmatter, ComparisonFrontmatter, ReferenceAtmospheres };
}

type Schemas = ReturnType<typeof makeSchemas>;
export type InvestigationFrontmatter = z.output<Schemas["InvestigationFrontmatter"]>;
export type SpinoffFrontmatter = z.output<Schemas["SpinoffFrontmatter"]>;
export type ComparisonFrontmatter = z.output<Schemas["ComparisonFrontmatter"]>;
export type ReferenceAtmosphere = z.output<Schemas["ReferenceAtmospheres"]>[number];
