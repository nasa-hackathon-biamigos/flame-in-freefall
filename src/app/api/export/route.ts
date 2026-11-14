import { apiError, preflight } from "@/lib/catalog/api";

const FILES = { json: "space-firefighters-catalog.json", csv: "space-firefighters-catalog.csv" } as const;

/** GET /api/export?format=json|csv — redirects to the static download built by data:build. */
export function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "json";
  if (format !== "json" && format !== "csv") return apiError(400, "bad_format", "api.errors.badFormat");
  return Response.redirect(new URL(`/downloads/${FILES[format]}`, url), 307);
}

export const OPTIONS = preflight;
