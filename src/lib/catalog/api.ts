import type { Investigation } from "./build";

/** Shared bits of the public read-only API (docs/SPEC.md §9). */

export const PUBLIC_API_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};

export function apiError(status: number, code: string, message_key: string): Response {
  return Response.json({ error: { code, message_key } }, { status, headers: PUBLIC_API_HEADERS });
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: PUBLIC_API_HEADERS });
}

/** List view: everything needed for cards and filters, without long text. */
export function toSummary(i: Investigation) {
  return {
    slug: i.slug,
    psi_id: i.psi_id,
    acronym: i.acronym,
    experiment_name: i.experiment_name,
    psi_url: i.psi_url,
    curation_status: i.curation_status,
    example: i.example,
    fire_safety_pillar: i.fire_safety_pillar,
    environment_tags: i.environment_tags,
    gravity: i.gravity,
    platform: i.platform,
    hardware: i.hardware,
    material_class: i.material_class,
    solid_form: i.solid_form,
    o2_percent: i.atmosphere.o2_percent,
    pressure_psi: i.atmosphere.pressure_psi,
    has_earth_transfer: i.has_earth_transfer,
    lunar_relevance: i.lunar_relevance,
    url: `/investigations/${i.slug}`,
  };
}
