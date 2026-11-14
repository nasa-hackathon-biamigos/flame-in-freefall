import { ArrowRight, Globe, Moon } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { PILLAR_STYLE } from "@/components/investigation/badges";
import { VocabIcon } from "@/components/vocab-icon";
import { asUiLocale, termIcon, termLabel } from "@/lib/catalog/labels";
import { catalog } from "@/lib/catalog/load";
import { cn } from "@/lib/utils";

export default async function Home() {
  const t = await getTranslations("home");
  const locale = asUiLocale(await getLocale());
  const { investigations: all, vocab } = catalog;
  const published = all.filter((i) => !i.example);

  const kpis = [
    { value: published.length, label: t("kpi.investigations") },
    { value: published.filter((i) => i.curation_status === "complete").length, label: t("kpi.complete") },
    { value: published.filter((i) => i.has_earth_transfer).length, label: t("kpi.earth") },
    {
      value: published.filter((i) => i.environment_tags.includes("lunar_habitat")).length,
      label: t("kpi.lunar"),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="py-16 sm:py-24">
        <p className="font-mono text-sm text-plasma">{(await getTranslations("app"))("tagline")}</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">{t("lead")}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/explore" className={buttonVariants({ size: "lg" })}>
            {t("ctaExplore")} <ArrowRight aria-hidden />
          </Link>
          <Link
            href="/about"
            className={buttonVariants({ size: "lg", variant: "outline", className: "border-border" })}
          >
            {t("ctaAbout")}
          </Link>
        </div>
      </section>

      <section aria-labelledby="pillars" className="pb-16">
        <h2 id="pillars" className="text-xl font-semibold">
          {t("pillarsTitle")}
        </h2>
        <ul className="mt-4 grid gap-4 md:grid-cols-3">
          {vocab.pillar.map(({ id }) => {
            const count = published.filter((i) => i.fire_safety_pillar.includes(id)).length;
            return (
              <li key={id}>
                <Link
                  href={`/explore?pillar=${id}`}
                  className="flex h-full flex-col rounded-lg border bg-card p-5 transition-colors hover:border-plasma/60"
                >
                  <span
                    className={cn(
                      "inline-flex w-fit items-center gap-2 rounded-md border px-2.5 py-1 font-medium",
                      PILLAR_STYLE[id],
                    )}
                  >
                    <VocabIcon name={termIcon(vocab, "pillar", id)} />
                    {termLabel(vocab, "pillar", id, locale)}
                  </span>
                  <span className="mt-3 flex-1 text-sm text-muted-foreground">
                    {t(`pillarText.${id}` as "pillarText.prevention")}
                  </span>
                  <span className="mt-4 font-mono text-sm">{t("pillarCount", { count })}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="kpis" className="pb-16">
        <h2 id="kpis" className="sr-only">
          {t("kpiTitle")}
        </h2>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="bg-card p-5">
              <dd className="font-mono text-3xl font-semibold">{k.value}</dd>
              <dt className="mt-1 text-sm text-muted-foreground">{k.label}</dt>
            </div>
          ))}
        </dl>
        {published.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">{t("curationInProgress")}</p>
        )}
      </section>

      <section aria-labelledby="dual" className="pb-24">
        <h2 id="dual" className="text-xl font-semibold">
          {t("dualTitle")}
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-card p-5">
            <h3 className="flex items-center gap-2 font-medium text-plasma">
              <Moon aria-hidden className="size-4" /> {t("lunarTitle")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">{t("lunarText")}</p>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <h3 className="flex items-center gap-2 font-medium text-earth">
              <Globe aria-hidden className="size-4" /> {t("earthTitle")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">{t("earthText")}</p>
            <Link
              href="/explore?earth=1"
              className="mt-3 inline-flex items-center gap-1 text-sm text-earth hover:underline"
            >
              {t("earthCta")} <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
