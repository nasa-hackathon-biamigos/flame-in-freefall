import { PUBLIC_API_HEADERS, preflight, toSummary } from "@/lib/catalog/api";
import { applyFilters, parseFilters } from "@/lib/catalog/filters";
import { catalog } from "@/lib/catalog/load";

/** GET /api/investigations?pillar=&env=&gravity=&material=&hardware=&status=&earth=1&q= */
export function GET(request: Request) {
  const filters = parseFilters(new URL(request.url).searchParams);
  const results = applyFilters(catalog.investigations, filters);
  return Response.json(
    { catalog_version: catalog.version, count: results.length, investigations: results.map(toSummary) },
    { headers: PUBLIC_API_HEADERS },
  );
}

export const OPTIONS = preflight;
