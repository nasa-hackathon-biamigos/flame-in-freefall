import { createHash } from "node:crypto";
import type { Catalog, Investigation } from "../catalog/build";
import { termLabel } from "../catalog/labels";
import type { PsiRaw } from "../catalog/psi";
import { formatRange } from "../units";

/**
 * What the chat can cite (docs/SPEC.md §8.1). Pure functions shared by `pnpm rag:ingest`,
 * `pnpm data:build` (which writes the index for the API route) and tests.
 *
 * Every PSI investigation we downloaded is citable through its original PSI text, even before
 * the research team publishes a ficha for it. Curated sections join as fichas are published.
 */

export type CurationLevel = "complete" | "partial" | "uncurated";

/** One investigation as the chat knows it: names to match in questions and where to link. */
export type RagIndexEntry = {
  psi_id: string;
  acronym: string;
  title: string;
  aliases: string[];
  /** Published ficha slug, or null when only the raw PSI text exists. */
  slug: string | null;
  curation: CurationLevel;
  psi_url: string;
  pillars: string[];
};

export const SECTION_LABELS = {
  summary: "Summary",
  crew_safety: "Why it matters for crew safety",
  earth_impact: "Earth impact",
  key_results: "Key results",
  limitations: "Limitations",
  conditions: "Conditions",
  psi_objectives: "PSI objectives",
  psi_hypothesis: "PSI hypothesis",
  psi_approach: "PSI approach",
  psi_research_impacts: "PSI research impacts / Earth benefits",
  comparison: "Curated comparison",
  spinoff: "Earth spinoff",
} as const;

export type ChunkSection = keyof typeof SECTION_LABELS;

/** Anchor on the investigation page that a chunk's section links to (SPEC §10.5). */
const SECTION_ANCHOR: Partial<Record<ChunkSection, string>> = {
  summary: "summary",
  crew_safety: "crew_safety",
  earth_impact: "earth_impact",
  key_results: "key_results",
  limitations: "limitations",
  conditions: "conditions",
  psi_objectives: "psi",
  psi_hypothesis: "psi",
  psi_approach: "psi",
  psi_research_impacts: "psi",
};

export type ChunkMetadata = {
  psi_id: string | null;
  experiment: string;
  title: string;
  section: ChunkSection;
  curation: CurationLevel;
  pillars: string[];
  /** In-app link when a ficha is published, else the PSI page. */
  url: string;
  psi_url: string | null;
  app_slug: string | null;
};

export type Chunk = {
  id: string;
  /** rag_chunks.slug: the published slug, or the PSI-ID for raw-only investigations. */
  key: string;
  psi_id: string | null;
  section: ChunkSection;
  /** Text shown to Claude and in citations (no context prefix). */
  content: string;
  /** Text that gets embedded: context prefix + content. */
  embed_text: string;
  content_hash: string;
  metadata: ChunkMetadata;
};

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * "ACME CFI-G" → ["ACME CFI-G", "CFI-G"]; "DAFT / DAFT-2" → ["DAFT", "DAFT-2"];
 * "ACME E-FIELD Flames" → [..., "E-FIELD Flames", "E-FIELD"]. A bare "ACME" (a family of
 * experiments) is never an alias of one investigation.
 */
export function acronymVariants(acronym: string): string[] {
  const out = new Set<string>();
  for (const part of acronym.split("/").map((p) => p.trim())) {
    if (!part) continue;
    out.add(part);
    const noAcme = part.replace(/^ACME\s+/i, "").trim();
    if (noAcme) out.add(noAcme);
    const first = noAcme.split(/\s+/)[0];
    if (first && first !== noAcme && /^[A-Z0-9-]{3,}$/.test(first)) out.add(first);
  }
  out.delete("ACME");
  return [...out];
}

export function buildRagIndex(catalog: Catalog, raws: PsiRaw[]): RagIndexEntry[] {
  const fichaByPsi = new Map(
    catalog.investigations.filter((i) => i.psi_id && !i.example).map((i) => [i.psi_id as string, i]),
  );
  return raws
    .map((raw) => {
      const ficha = fichaByPsi.get(raw.psi_id);
      const acronym = ficha?.acronym ?? (raw.acronym || raw.psi_id);
      const aliases = new Set<string>([
        raw.psi_id,
        ...acronymVariants(raw.acronym),
        ...(ficha ? [ficha.acronym ?? "", ...ficha.aliases] : []),
      ]);
      aliases.delete("");
      return {
        psi_id: raw.psi_id,
        acronym,
        title: ficha?.experiment_name ?? raw.title,
        aliases: [...aliases],
        slug: ficha?.slug ?? null,
        curation: (ficha?.curation_status as CurationLevel | undefined) ?? "uncurated",
        psi_url: raw.url,
        pillars: ficha?.fire_safety_pillar ?? [],
      };
    })
    .sort((a, b) => Number(a.psi_id.slice(4)) - Number(b.psi_id.slice(4)));
}

/**
 * Investigations named in a question. All-caps acronyms match case-sensitively as whole words
 * ("SAME", "BASS", "FLEX" are also English words); names with a digit or hyphen ("same-r",
 * "cfi-g", "flex-2") also match in lower case.
 */
export function matchAliases(text: string, index: RagIndexEntry[]): string[] {
  const hits = new Set<string>();
  for (const entry of index) {
    for (const alias of entry.aliases) {
      if (alias.length < 3) continue;
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const loose = /[\d-]/.test(alias);
      const re = new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, loose ? "i" : "");
      if (re.test(text)) {
        hits.add(entry.psi_id);
        break;
      }
    }
  }
  return [...hits];
}

/** Splits long text at paragraph boundaries into pieces of at most ~maxChars (~450 tokens). */
export function splitText(text: string, maxChars = 1800): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const pieces: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if (current && current.length + p.length + 2 > maxChars) {
      pieces.push(current);
      current = "";
    }
    if (p.length > maxChars) {
      // one huge paragraph: cut at sentence ends
      for (const sentence of p.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [p]) {
        if (current && current.length + sentence.length > maxChars) {
          pieces.push(current.trim());
          current = "";
        }
        current += sentence;
      }
      continue;
    }
    current = current ? `${current}\n\n${p}` : p;
  }
  if (current.trim()) pieces.push(current.trim());
  return pieces;
}

/** Deterministic text for the structured fields (SPEC §8.1 "conditions"). */
export function conditionsText(inv: Investigation, vocab: Catalog["vocab"]): string {
  const a = inv.atmosphere;
  const terms = (key: Parameters<typeof termLabel>[1], ids: string[]) =>
    ids.map((id) => termLabel(vocab, key, id, "en")).join(", ");
  const o2 = formatRange(a.o2_percent, "en");
  const p = formatRange(a.pressure_psi, "en");
  const flow = formatRange(a.flow_velocity_cm_s, "en");
  const lines = [
    `Oxygen: ${o2 ? `${o2} % by volume` : "not reported"}.`,
    `Pressure: ${p ? `${p} psia` : "not reported"}.`,
    a.diluents.length ? `Diluents: ${a.diluents.join(", ")}.` : null,
    flow ? `Flow velocity: ${flow} cm/s.` : null,
    a.flow_notes ? `Flow notes: ${a.flow_notes}` : null,
    inv.gravity.length ? `Gravity: ${terms("gravity", inv.gravity)}.` : null,
    inv.platform ? `Platform: ${termLabel(vocab, "platform", inv.platform, "en")}.` : null,
    inv.hardware.length ? `Hardware: ${terms("hardware", inv.hardware)}.` : null,
    inv.material_class.length ? `Material class: ${terms("material_class", inv.material_class)}.` : null,
    inv.solid_form.length ? `Solid form: ${terms("solid_form", inv.solid_form)}.` : null,
    inv.fuels.length ? `Fuels / materials: ${inv.fuels.join(", ")}.` : null,
    inv.sample_geometry ? `Sample geometry: ${inv.sample_geometry}.` : null,
    inv.sensors.length ? `Sensors: ${inv.sensors.join(", ")}.` : null,
    inv.measured_variables.length ? `Measured: ${inv.measured_variables.join(", ")}.` : null,
    inv.variables_changed.length ? `Varied: ${inv.variables_changed.join(", ")}.` : null,
    inv.variables_fixed.length ? `Held fixed: ${inv.variables_fixed.join(", ")}.` : null,
    a.evidence ? `Source of these numbers: ${a.evidence}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

/** Acronym, or a shortened title for PSI entries without one (e.g. PSI-115). */
export function experimentName(entry: Pick<RagIndexEntry, "acronym" | "psi_id" | "title">): string {
  if (entry.acronym && entry.acronym !== entry.psi_id) return entry.acronym;
  return entry.title.length > 60 ? `${entry.title.slice(0, 57).trimEnd()}…` : entry.title;
}

export function chunkTitle(m: Pick<ChunkMetadata, "experiment" | "psi_id" | "section" | "curation">): string {
  const tag =
    m.curation === "uncurated"
      ? " (original PSI text)"
      : m.curation === "partial"
        ? " (partial curation)"
        : "";
  return [m.experiment, m.psi_id, SECTION_LABELS[m.section]].filter(Boolean).join(" · ") + tag;
}

export function buildChunks(catalog: Catalog, raws: PsiRaw[], index: RagIndexEntry[]): Chunk[] {
  const chunks: Chunk[] = [];
  const byPsi = new Map(index.map((e) => [e.psi_id, e]));
  const fichaBySlug = new Map(catalog.investigations.filter((i) => !i.example).map((i) => [i.slug, i]));

  const add = (
    entry: RagIndexEntry | null,
    section: ChunkSection,
    text: string,
    extra?: Partial<ChunkMetadata>,
  ) => {
    const pieces = splitText(text);
    pieces.forEach((content, idx) => {
      const key = entry?.slug ?? entry?.psi_id ?? extra?.app_slug ?? "catalog";
      const anchor = SECTION_ANCHOR[section];
      const metadata: ChunkMetadata = {
        psi_id: entry?.psi_id ?? null,
        experiment: entry ? experimentName(entry) : (extra?.experiment ?? ""),
        title: "",
        section,
        curation: entry?.curation ?? "complete",
        pillars: entry?.pillars ?? [],
        url: entry?.slug
          ? `/investigations/${entry.slug}${anchor ? `#${anchor}` : ""}`
          : (entry?.psi_url ?? "/"),
        psi_url: entry?.psi_url ?? null,
        app_slug: entry?.slug ?? null,
        ...extra,
      };
      metadata.title = chunkTitle(metadata) + (pieces.length > 1 ? ` (${idx + 1}/${pieces.length})` : "");
      const embed_text = `${metadata.title}:\n${content}`;
      chunks.push({
        id: sha256(`${key}\0${section}\0${extra?.title ?? ""}\0${idx}`),
        key,
        psi_id: metadata.psi_id,
        section,
        content,
        embed_text,
        content_hash: sha256(embed_text),
        metadata,
      });
    });
  };

  // Curated ficha sections (published, non-example fichas only)
  for (const inv of fichaBySlug.values()) {
    const entry = inv.psi_id ? (byPsi.get(inv.psi_id) ?? null) : null;
    if (!entry) continue;
    for (const section of ["summary", "crew_safety", "earth_impact", "key_results", "limitations"] as const) {
      if (inv.sections[section].trim()) add(entry, section, inv.sections[section]);
    }
    add(entry, "conditions", conditionsText(inv, catalog.vocab));
  }

  // Original PSI text — every downloaded investigation
  for (const raw of raws) {
    const entry = byPsi.get(raw.psi_id) ?? null;
    if (!entry) continue;
    for (const k of ["objectives", "hypothesis", "approach", "research_impacts"] as const) {
      if (raw.sections[k].trim()) add(entry, `psi_${k}`, raw.sections[k]);
    }
  }

  // Curated comparisons and spinoffs
  for (const c of catalog.comparisons) {
    const names = c.slugs.map((s) => fichaBySlug.get(s)?.acronym ?? s).join(" × ");
    const body = [
      c.sections.what_changed && `What changed:\n${c.sections.what_changed}`,
      c.sections.what_stayed && `What stayed the same:\n${c.sections.what_stayed}`,
      c.sections.so_what && `So what for fire safety:\n${c.sections.so_what}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    if (body)
      add(null, "comparison", body, {
        experiment: names,
        title: c.id,
        url: `/compare?ids=${c.slugs.join(",")}`,
        app_slug: c.id,
      });
  }
  for (const s of catalog.spinoffs) {
    if (s.body)
      add(null, "spinoff", `${s.title}\n\n${s.body}`, {
        experiment: s.title,
        title: s.slug,
        url: s.spinoff_url ?? "/",
        app_slug: `spinoff-${s.slug}`,
      });
  }
  return chunks;
}
