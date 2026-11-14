import { z } from "zod";

/** Shape of data/raw/psi/<psi_id>.json — written by scripts/scrape-psi.ts, never edited by hand. */
export const PsiRawSchema = z.object({
  psi_id: z.string().regex(/^PSI-\d+$/),
  title: z.string(),
  acronym: z.string(),
  url: z.url(),
  api_url: z.url().nullable(),
  doi: z.string().nullable(),
  license: z.object({ id: z.string(), name: z.string(), url: z.string() }).nullable(),
  psi_version: z.number().nullable(),
  fetched_at: z.string(),
  metadata: z.object({
    research_area: z.string(),
    subresearch_area: z.string(),
    project_type: z.string(),
    flight_platform: z.string(),
    managing_center: z.string(),
    start_date: z.string(),
    end_date: z.string(),
    related_psi_ids: z.array(z.string()),
    keywords: z.array(z.string()),
    hardware: z.object({ name: z.string(), link: z.string().nullable() }).nullable(),
  }),
  sections: z.object({
    objectives: z.string(),
    hypothesis: z.string(),
    approach: z.string(),
    research_impacts: z.string(),
  }),
  publications: z.array(z.object({ title: z.string(), authors: z.string(), doi: z.string().nullable() })),
  experimental_tables: z.array(z.object({ file_name: z.string(), csv: z.string() })),
});

export type PsiRaw = z.infer<typeof PsiRawSchema>;

export const PSI_SECTION_KEYS = ["objectives", "hypothesis", "approach", "research_impacts"] as const;

export const PsiIndexEntrySchema = z.object({
  psi_id: z.string(),
  acronym: z.string(),
  title: z.string(),
  url: z.string(),
  research_area: z.string(),
  subresearch_area: z.string(),
  project_type: z.string(),
  flight_platform: z.string(),
  related_psi_ids: z.array(z.string()),
  keywords: z.array(z.string()),
});

export type PsiIndexEntry = z.infer<typeof PsiIndexEntrySchema>;

export function psiPageUrl(psiId: string): string {
  return `https://psi.nasa.gov/physci/repo/data/investigations/${psiId}`;
}
