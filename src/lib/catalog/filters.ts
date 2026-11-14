import type { Investigation } from "./build";
import type { VocabKey } from "./vocab";

/**
 * Explore / API filters (docs/SPEC.md §9, §10.4). Same URL params everywhere so filtered views
 * are shareable: ?q=&pillar=a,b&env=&gravity=&material=&hardware=&status=&earth=1
 * Within one facet values are OR'ed; facets are AND'ed.
 */

export const FACETS = [
  { param: "pillar", vocab: "pillar", get: (i: Investigation) => i.fire_safety_pillar },
  { param: "env", vocab: "environment", get: (i: Investigation) => i.environment_tags },
  { param: "gravity", vocab: "gravity", get: (i: Investigation) => i.gravity },
  { param: "material", vocab: "material_class", get: (i: Investigation) => i.material_class },
  { param: "hardware", vocab: "hardware", get: (i: Investigation) => i.hardware },
  { param: "status", vocab: null, get: (i: Investigation) => [i.curation_status] },
] as const satisfies ReadonlyArray<{
  param: string;
  vocab: VocabKey | null;
  get: (i: Investigation) => readonly string[];
}>;

export type FacetParam = (typeof FACETS)[number]["param"];
export const STATUS_VALUES = ["complete", "partial"] as const;

export type Filters = { q: string; earth: boolean } & Record<FacetParam, string[]>;

type SearchParams = Record<string, string | string[] | undefined> | URLSearchParams;

function read(sp: SearchParams, key: string): string | undefined {
  if (sp instanceof URLSearchParams) return sp.get(key) ?? undefined;
  const v = sp[key];
  return Array.isArray(v) ? v.join(",") : v;
}

export function parseFilters(sp: SearchParams): Filters {
  const list = (key: string) =>
    (read(sp, key) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  const f = { q: (read(sp, "q") ?? "").trim().slice(0, 100), earth: read(sp, "earth") === "1" } as Filters;
  for (const facet of FACETS) f[facet.param] = [...new Set(list(facet.param))];
  return f;
}

export function filtersToSearch(f: Filters): string {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  for (const facet of FACETS) if (f[facet.param].length) sp.set(facet.param, f[facet.param].join(","));
  if (f.earth) sp.set("earth", "1");
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function hasActiveFilters(f: Filters): boolean {
  return Boolean(f.q) || f.earth || FACETS.some((facet) => f[facet.param].length > 0);
}

function matchesText(i: Investigation, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return [i.slug, i.acronym, i.experiment_name, i.psi_id, ...i.aliases]
    .filter((s): s is string => !!s)
    .some((s) => s.toLowerCase().includes(needle));
}

function matches(i: Investigation, f: Filters, skip?: FacetParam): boolean {
  if (!matchesText(i, f.q)) return false;
  if (f.earth && !i.has_earth_transfer) return false;
  return FACETS.every((facet) => {
    if (facet.param === skip) return true;
    const wanted = f[facet.param];
    return wanted.length === 0 || facet.get(i).some((v) => wanted.includes(v));
  });
}

export function applyFilters(list: Investigation[], f: Filters): Investigation[] {
  return list.filter((i) => matches(i, f));
}

/** Count per option, given every *other* active filter (standard faceted search). */
export function facetCounts(list: Investigation[], f: Filters, param: FacetParam): Map<string, number> {
  const facet = FACETS.find((x) => x.param === param)!;
  const counts = new Map<string, number>();
  for (const i of list) {
    if (!matches(i, f, param)) continue;
    for (const v of new Set(facet.get(i))) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return counts;
}

export function earthCount(list: Investigation[], f: Filters): number {
  return list.filter((i) => i.has_earth_transfer && matches(i, { ...f, earth: false })).length;
}
