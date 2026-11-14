import "server-only";
import raw from "@/generated/catalog.json";
import type { Catalog, Investigation } from "./build";

/** The catalog built by `pnpm data:build`. Server-only: it carries the full raw PSI text. */
export const catalog = raw as unknown as Catalog;

export function getInvestigation(slug: string): Investigation | undefined {
  return catalog.investigations.find((i) => i.slug === slug);
}
