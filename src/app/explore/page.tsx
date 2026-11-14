import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { FilterPanel, type FacetView } from "@/components/explore/filter-panel";
import { InvestigationCard } from "@/components/investigation/investigation-card";
import {
  applyFilters,
  earthCount,
  FACETS,
  facetCounts,
  hasActiveFilters,
  parseFilters,
  STATUS_VALUES,
} from "@/lib/catalog/filters";
import { asUiLocale } from "@/lib/catalog/labels";
import { catalog } from "@/lib/catalog/load";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("explore"))("title") };
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("explore");
  const locale = asUiLocale(await getLocale());
  const filters = parseFilters(await searchParams);
  const { investigations: all, vocab } = catalog;
  const results = applyFilters(all, filters);

  const facets: FacetView[] = FACETS.map((facet) => {
    const counts = facetCounts(all, filters, facet.param);
    const options = facet.vocab
      ? vocab[facet.vocab].map((term) => ({
          id: term.id,
          label: term.label[locale],
          count: counts.get(term.id) ?? 0,
        }))
      : STATUS_VALUES.map((s) => ({ id: s, label: t(`status.${s}`), count: counts.get(s) ?? 0 }));
    return { param: facet.param, title: t(`facet.${facet.param}`), options };
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t("lead")}</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside>
          <Suspense>
            <FilterPanel facets={facets} earthCount={earthCount(all, filters)} />
          </Suspense>
        </aside>

        <section aria-labelledby="results-count">
          <p id="results-count" aria-live="polite" className="font-mono text-sm text-muted-foreground">
            {t("results", { count: results.length })}
          </p>
          {results.length === 0 ? (
            <p className="mt-6 rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              {all.length === 0 || !hasActiveFilters(filters) ? t("emptyCatalog") : t("empty")}
            </p>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((inv) => (
                <InvestigationCard key={inv.slug} inv={inv} vocab={vocab} locale={locale} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
