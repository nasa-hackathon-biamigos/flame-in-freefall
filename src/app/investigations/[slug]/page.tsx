import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ConditionsTable } from "@/components/investigation/conditions-table";
import {
  EarthBadge,
  ExampleBadge,
  PartialBadge,
  PillarBadge,
  TagBadge,
} from "@/components/investigation/badges";
import { PsiOriginal } from "@/components/investigation/psi-original";
import { Markdown } from "@/components/markdown";
import { asUiLocale, termLabel } from "@/lib/catalog/labels";
import { catalog, getInvestigation } from "@/lib/catalog/load";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const inv = getInvestigation((await params).slug);
  if (!inv) return {};
  return {
    title: inv.acronym ?? inv.experiment_name ?? inv.slug,
    description: inv.sections.summary.slice(0, 200) || inv.experiment_name || undefined,
  };
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-lg font-semibold">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function InvestigationPage({ params }: Props) {
  const inv = getInvestigation((await params).slug);
  if (!inv) notFound();

  const t = await getTranslations("investigation");
  const locale = asUiLocale(await getLocale());
  const { vocab } = catalog;
  const empty = <p className="italic text-muted-foreground">{t("notReported")}</p>;
  const md = (text: string) => (text ? <Markdown>{text}</Markdown> : empty);
  const spinoffs = catalog.spinoffs.filter((s) => inv.earth_applications?.spinoff_slugs.includes(s.slug));
  const known = new Map(catalog.investigations.map((i) => [i.slug, i]));
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });

  return (
    <article className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          {inv.example && <ExampleBadge label={t("exampleBadge")} />}
          {inv.curation_status === "partial" && <PartialBadge label={t("partialBadge")} />}
          {inv.has_earth_transfer && <EarthBadge label={t("earthBadge")} />}
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">{inv.acronym ?? inv.experiment_name}</h1>
        {inv.acronym && inv.experiment_name && (
          <p className="mt-1 text-lg text-muted-foreground">{inv.experiment_name}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {inv.psi_id && <span className="font-mono">{inv.psi_id}</span>}
          {inv.psi_url && (
            <a
              href={inv.psi_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-plasma hover:underline"
            >
              {t("openPsi")} <ExternalLink aria-hidden className="size-3.5" />
            </a>
          )}
          <span className="flex flex-wrap gap-1.5">
            {inv.fire_safety_pillar.map((p) => (
              <PillarBadge key={p} id={p} vocab={vocab} locale={locale} />
            ))}
          </span>
        </div>
        {inv.example && (
          <p className="mt-4 rounded-md border border-bad/40 bg-bad/10 p-3 text-sm">{t("exampleNote")}</p>
        )}
        {inv.curation_status === "partial" && (
          <p className="mt-4 rounded-md border border-warn/40 bg-warn/10 p-3 text-sm">{t("partialNote")}</p>
        )}
        {locale === "pt-BR" && <p className="mt-3 text-xs text-muted-foreground">{t("contentInEnglish")}</p>}
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_24rem]">
        <div className="min-w-0 space-y-10">
          <Section id="summary" title={t("sections.summary")}>
            {md(inv.sections.summary)}
          </Section>
          <Section id="crew_safety" title={t("sections.crew_safety")}>
            {md(inv.sections.crew_safety)}
          </Section>
          <Section id="earth_impact" title={t("sections.earth_impact")}>
            {inv.has_earth_transfer && inv.earth_applications ? (
              <div className="space-y-3">
                {md(inv.sections.earth_impact)}
                <div className="flex flex-wrap gap-1.5">
                  {inv.earth_applications.sectors.map((s) => (
                    <TagBadge key={s}>{termLabel(vocab, "earth_sectors", s, locale)}</TagBadge>
                  ))}
                  {inv.earth_applications.transfer_type && (
                    <TagBadge>
                      {termLabel(vocab, "transfer_type", inv.earth_applications.transfer_type, locale)}
                    </TagBadge>
                  )}
                </div>
                {spinoffs.length > 0 && (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {spinoffs.map((s) => (
                      <li key={s.slug} className="rounded-md border bg-card p-3 text-sm">
                        <p className="font-medium">{s.title}</p>
                        {s.spinoff_url && (
                          <a
                            href={s.spinoff_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-earth hover:underline"
                          >
                            {t("spinoffLink")} <ExternalLink aria-hidden className="size-3" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="italic text-muted-foreground">{t("noEarth")}</p>
            )}
          </Section>
          <Section id="changed_fixed" title={t("sections.changed_fixed")}>
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  [t("changed"), inv.variables_changed],
                  [t("fixed"), inv.variables_fixed],
                ] as const
              ).map(([label, items]) => (
                <div key={label} className="rounded-md border p-3">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                  </h3>
                  {items.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                      {items.map((v) => (
                        <li key={v}>{v}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm italic text-muted-foreground">{t("notReported")}</p>
                  )}
                </div>
              ))}
            </div>
          </Section>
          <Section id="key_results" title={t("sections.key_results")}>
            {md(inv.sections.key_results)}
          </Section>
          <Section id="limitations" title={t("sections.limitations")}>
            {md(inv.sections.limitations)}
          </Section>
          {inv.psi_id && (
            <Section id="psi" title={t("sections.psi")}>
              {inv.psi ? (
                <details className="rounded-md border p-4 [&[open]>summary]:mb-4">
                  <summary className="cursor-pointer text-sm text-plasma">{inv.psi.title}</summary>
                  <PsiOriginal psi={inv.psi} />
                </details>
              ) : (
                <p className="italic text-muted-foreground">{t("psi.missing")}</p>
              )}
            </Section>
          )}
        </div>

        <aside className="space-y-10">
          <Section id="conditions" title={t("sections.conditions")}>
            <ConditionsTable inv={inv} vocab={vocab} locale={locale} />
          </Section>
          <Section id="related" title={t("sections.related")}>
            {inv.related.length ? (
              <ul className="flex flex-wrap gap-2 text-sm">
                {inv.related.map((slug) => {
                  const r = known.get(slug);
                  return (
                    <li key={slug}>
                      {r ? (
                        <Link
                          href={`/investigations/${slug}`}
                          className="rounded-md border px-2 py-1 hover:border-plasma"
                        >
                          {r.acronym ?? slug}
                        </Link>
                      ) : (
                        <span className="rounded-md border border-dashed px-2 py-1 text-muted-foreground">
                          {slug}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              empty
            )}
          </Section>
          <Section id="sources" title={t("sections.sources")}>
            <ul className="space-y-1 text-sm">
              {inv.sources.map((s, i) => (
                <li key={i}>
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-plasma hover:underline"
                    >
                      {s.label} <ExternalLink aria-hidden className="size-3" />
                    </a>
                  ) : (
                    s.label
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              {inv.last_reviewed && t("lastReviewed", { date: dateFmt.format(new Date(inv.last_reviewed)) })}
              {inv.last_reviewed && inv.curators.length > 0 && " · "}
              {inv.curators.length > 0 && t("curatedBy", { names: inv.curators.join(", ") })}
            </p>
          </Section>
        </aside>
      </div>
    </article>
  );
}
