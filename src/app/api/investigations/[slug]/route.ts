import { apiError, PUBLIC_API_HEADERS, preflight } from "@/lib/catalog/api";
import { catalog, getInvestigation } from "@/lib/catalog/load";

/** GET /api/investigations/<slug> — full record, including the raw PSI text. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const inv = getInvestigation((await params).slug);
  if (!inv) return apiError(404, "not_found", "api.errors.notFound");
  return Response.json(
    { catalog_version: catalog.version, investigation: inv },
    { headers: PUBLIC_API_HEADERS },
  );
}

export const OPTIONS = preflight;
