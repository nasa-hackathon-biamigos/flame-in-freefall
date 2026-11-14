import type { Catalog, Investigation } from "./build";

/** Public dataset export (docs/SPEC.md §6.9). Examples are never exported. */

export const ATTRIBUTION = {
  product: "Space Firefighters — NASA Space Apps Challenge 2026 (Flame in Freefall)",
  source: "NASA Physical Sciences Informatics (PSI), https://psi.nasa.gov/",
  source_license:
    "PSI investigation records are published by NASA under CC0-1.0 (https://spdx.org/licenses/CC0-1.0.html)",
  curation: "Fire-safety fields curated by the Space Firefighters team; each record cites its sources",
  disclaimer: "Not an official NASA product",
};

function exportable(catalog: Catalog): Investigation[] {
  return catalog.investigations.filter((i) => !i.example);
}

export function toExportJson(catalog: Catalog) {
  return {
    attribution: ATTRIBUTION,
    catalog_version: catalog.version,
    generated_at: catalog.generated_at,
    investigations: exportable(catalog).map(({ psi, ...inv }) => ({
      ...inv,
      psi_doi: psi?.doi ?? null,
      psi_title: psi?.title ?? null,
    })),
  };
}

type Column = [header: string, get: (i: Investigation) => string | number | null];

const list = (v: string[]) => v.join(";");

const COLUMNS: Column[] = [
  ["slug", (i) => i.slug],
  ["psi_id", (i) => i.psi_id],
  ["acronym", (i) => i.acronym],
  ["experiment_name", (i) => i.experiment_name],
  ["psi_url", (i) => i.psi_url],
  ["psi_doi", (i) => i.psi?.doi ?? null],
  ["curation_status", (i) => i.curation_status],
  ["fire_safety_pillar", (i) => list(i.fire_safety_pillar)],
  ["environment_tags", (i) => list(i.environment_tags)],
  ["gravity", (i) => list(i.gravity)],
  ["platform", (i) => i.platform],
  ["hardware", (i) => list(i.hardware)],
  ["material_class", (i) => list(i.material_class)],
  ["solid_form", (i) => list(i.solid_form)],
  ["fuels", (i) => list(i.fuels)],
  ["sample_geometry", (i) => i.sample_geometry],
  ["o2_min", (i) => i.atmosphere.o2_percent.min],
  ["o2_max", (i) => i.atmosphere.o2_percent.max],
  ["pressure_psi_min", (i) => i.atmosphere.pressure_psi.min],
  ["pressure_psi_max", (i) => i.atmosphere.pressure_psi.max],
  ["diluents", (i) => list(i.atmosphere.diluents)],
  ["flow_velocity_cm_s_min", (i) => i.atmosphere.flow_velocity_cm_s.min],
  ["flow_velocity_cm_s_max", (i) => i.atmosphere.flow_velocity_cm_s.max],
  ["atmosphere_evidence", (i) => i.atmosphere.evidence],
  ["sensors", (i) => list(i.sensors)],
  ["measured_variables", (i) => list(i.measured_variables)],
  ["variables_changed", (i) => list(i.variables_changed)],
  ["variables_fixed", (i) => list(i.variables_fixed)],
  ["lunar_relevance", (i) => i.lunar_relevance],
  ["prediction_tags", (i) => list(i.prediction_tags)],
  ["related", (i) => list(i.related)],
  ["earth_sectors", (i) => list(i.earth_applications?.sectors ?? [])],
  ["earth_transfer_type", (i) => i.earth_applications?.transfer_type ?? null],
  ["spinoff_slugs", (i) => list(i.earth_applications?.spinoff_slugs ?? [])],
  ["source_urls", (i) => list(i.sources.flatMap((s) => (s.url ? [s.url] : [])))],
  ["last_reviewed", (i) => i.last_reviewed],
];

export function csvCell(v: string | number | null): string {
  if (v === null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV with `#` comment lines for attribution (read with e.g. pandas `comment="#"`). */
export function toExportCsv(catalog: Catalog): string {
  const header = [
    `# ${ATTRIBUTION.product}`,
    `# Source: ${ATTRIBUTION.source}. ${ATTRIBUTION.source_license}.`,
    `# ${ATTRIBUTION.curation}. ${ATTRIBUTION.disclaimer}. Catalog version ${catalog.version}.`,
  ];
  const rows = exportable(catalog).map((inv) => COLUMNS.map(([, get]) => csvCell(get(inv))).join(","));
  return [...header, COLUMNS.map(([h]) => h).join(","), ...rows].join("\n") + "\n";
}
