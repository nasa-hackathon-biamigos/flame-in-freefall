import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Investigation } from "@/lib/catalog/build";
import { termLabel, type UiLocale } from "@/lib/catalog/labels";
import type { Vocab } from "@/lib/catalog/vocab";
import { formatRange } from "@/lib/units";
import { EarthBadge, ExampleBadge, PartialBadge, PillarBadge } from "./badges";

export async function InvestigationCard({
  inv,
  vocab,
  locale,
}: {
  inv: Investigation;
  vocab: Vocab;
  locale: UiLocale;
}) {
  const t = await getTranslations("investigation");
  const o2 = formatRange(inv.atmosphere.o2_percent, locale);
  const pressure = formatRange(inv.atmosphere.pressure_psi, locale);

  return (
    <li className="group relative flex flex-col rounded-lg border bg-card p-4 transition-colors hover:border-plasma/60 focus-within:border-plasma">
      <div className="flex flex-wrap items-center gap-2">
        {inv.example && <ExampleBadge label={t("exampleBadge")} />}
        {inv.curation_status === "partial" && <PartialBadge label={t("partialBadge")} />}
        {inv.has_earth_transfer && <EarthBadge label={t("earthBadge")} />}
      </div>
      <h3 className="mt-3 text-2xl font-semibold tracking-tight">
        <Link
          href={`/investigations/${inv.slug}`}
          className="outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:underline"
        >
          {inv.acronym ?? inv.experiment_name ?? inv.slug}
        </Link>
      </h3>
      {inv.acronym && inv.experiment_name && (
        <p className="mt-1 text-sm text-muted-foreground">{inv.experiment_name}</p>
      )}
      {inv.psi_id && <p className="mt-1 font-mono text-xs text-muted-foreground">{inv.psi_id}</p>}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {inv.fire_safety_pillar.map((p) => (
          <PillarBadge key={p} id={p} vocab={vocab} locale={locale} />
        ))}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
        <div>
          <dt className="text-muted-foreground">{t("o2")}</dt>
          <dd className="font-mono">{o2 ? `${o2} %` : t("notReported")}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("pressure")}</dt>
          <dd className="font-mono">{pressure ? `${pressure} psia` : t("notReported")}</dd>
        </div>
        {inv.hardware.length > 0 && (
          <div className="col-span-2">
            <dt className="sr-only">{t("conditions.hardware")}</dt>
            <dd className="text-muted-foreground">
              {inv.hardware.map((h) => termLabel(vocab, "hardware", h, locale)).join(" · ")}
            </dd>
          </div>
        )}
      </dl>
    </li>
  );
}
