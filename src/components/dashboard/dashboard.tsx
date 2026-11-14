import { Droplets, Flame, Moon, Radar, Shield } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  AtmosphereBars,
  FlammabilityMap,
  GroupedBarChart,
  PsdChart,
  Sparkline,
} from "@/components/dashboard/charts";
import { findingsFor, loadFindings, type PillarId } from "@/lib/findings";
import { formatNm, formatPct, formatRatio, loadInsights } from "@/lib/insights/load";

const FLAME = "#ff7a1a";
const PLASMA = "#4da3ff";
const EARTH = "#2bb3a3";
const PREVENTION = "#ff9f43";

export type DashPillar = PillarId | "all";

const PILLARS: DashPillar[] = ["all", "prevention", "detection", "suppression"];

function sparkValues(id: string) {
  const s = loadInsights().smoke.series.find((x) => x.id === id);
  return (s?.points ?? [])
    .filter((p) => p.d_nm >= 80 && p.d_nm <= 80_000)
    .map((p) => p.log10);
}

function share(id: string) {
  return loadInsights().smoke.series.find((s) => s.id === id)?.large_share ?? 0;
}

function loc(locale: string): "en" | "pt-BR" {
  return locale.startsWith("pt") ? "pt-BR" : "en";
}

export async function Dashboard({ pillar }: { pillar: DashPillar }) {
  const t = await getTranslations("dash");
  const locale = await getLocale();
  const lang = loc(locale);
  const insights = loadInsights();
  const h = insights.smoke.headline;
  const s8g = insights.smoke.series.find((s) => s.id === "8cm-1g");
  const s8z = insights.smoke.series.find((s) => s.id === "8cm-0g");
  const materials = [...new Set(insights.same_materials.map((m) => m.material))];
  const findingsDoc = findingsFor(pillar);
  const { document } = loadFindings();

  const showDetection = pillar === "all" || pillar === "detection";
  const showPrevention = pillar === "all" || pillar === "prevention";
  const showSuppression = pillar === "all" || pillar === "suppression";

  const metricCards = [
    {
      title: t("metric.mode1g"),
      value: formatNm(h.mode_d_nm_1g),
      status: t("metric.similar"),
      color: FLAME,
      icon: Flame,
      spark: sparkValues("8cm-1g"),
      hint: t("metric.flow8"),
    },
    {
      title: t("metric.mode0g"),
      value: formatNm(h.mode_d_nm_0g),
      status: t("metric.similar"),
      color: PLASMA,
      icon: Droplets,
      spark: sparkValues("8cm-0g"),
      hint: t("metric.flow8"),
    },
    {
      title: t("metric.tail1g"),
      value: formatPct(h.large_share_1g, 2),
      status: t("metric.earth"),
      color: FLAME,
      icon: Shield,
      spark: sparkValues("8cm-1g"),
      hint: t("metric.cutoff", { d: formatNm(h.tail_cutoff_nm) }),
    },
    {
      title: t("metric.tail0g"),
      value: formatPct(h.large_share_0g, 2),
      status: formatRatio(h.large_share_ratio),
      color: PLASMA,
      icon: Radar,
      spark: sparkValues("8cm-0g"),
      hint: t("metric.cutoff", { d: formatNm(h.tail_cutoff_nm) }),
    },
    {
      title: t("metric.lunar"),
      value: `+${insights.kpis.lunar_o2_increase_pct}%`,
      status: t("metric.artemis"),
      color: EARTH,
      icon: Moon,
      spark: [21, 21, 30, 30, 100],
      hint: t("metric.lunarHint"),
    },
  ];

  const atmo = [
    { id: "earth", label: t("atmo.earth"), o2: 21, psi: 14.7, color: EARTH },
    { id: "lunar", label: t("atmo.lunar"), o2: 30, psi: 10.2, color: PREVENTION },
    { id: "suit", label: t("atmo.suit"), o2: 100, psi: 4.3, color: FLAME },
  ];

  const shownMetrics = pillar === "detection" ? metricCards.slice(0, 4) : metricCards;
  const exploreHref = pillar === "all" ? "/explore" : `/explore?pillar=${pillar}`;

  return (
    <div id="painel" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.22em] text-plasma uppercase">{t("kicker")}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{t("panelTitle")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("panelLead")}</p>
        </div>
        <Link href={exploreHref} className="font-mono text-xs text-plasma hover:underline">
          {t("openExplore")} →
        </Link>
      </div>

      <nav aria-label={t("menuLabel")} className="mt-5 flex flex-wrap gap-2">
        {PILLARS.map((id) => {
          const href = id === "all" ? "/#painel" : `/?pillar=${id}#painel`;
          const active = pillar === id;
          return (
            <Link
              key={id}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                active ? "border-plasma bg-plasma/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`menu.${id}`)}
            </Link>
          );
        })}
      </nav>

      <p className="mt-3 text-xs text-muted-foreground">{document.caveat[lang]}</p>

      <section className="mt-6">
        <h3 className="text-lg font-medium">{t("findingsTitle")}</h3>
        <p className="mb-3 text-sm text-muted-foreground">{t("findingsHint")}</p>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {findingsDoc.map((f) => (
            <li key={f.id} className="rounded-2xl border bg-card p-4">
              <p className="font-mono text-[10px] uppercase text-muted-foreground">
                {f.kind === "myth" ? t("myth") : t("finding")} · {document.label} p. {f.page}
              </p>
              <p className="mt-2 text-sm font-medium line-through decoration-bad/80">{f.myth[lang]}</p>
              <p className="mt-2 text-sm text-muted-foreground">{f.truth[lang]}</p>
              <div className="mt-3 flex flex-wrap gap-2 font-mono text-[11px]">
                {f.psi.map((id) => (
                  <span key={id} className="rounded-full bg-secondary px-2 py-0.5 text-plasma">
                    {id}
                  </span>
                ))}
                <Link href={f.explore} className="text-earth hover:underline">
                  {t("openExplore")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {showDetection ? (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {shownMetrics.map((m) => (
              <article key={m.title} className="rounded-2xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="flex size-9 items-center justify-center rounded-lg"
                    style={{ background: `${m.color}22`, color: m.color }}
                  >
                    <m.icon className="size-4" aria-hidden />
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase"
                    style={{ color: m.color, background: `${m.color}18` }}
                  >
                    {m.status}
                  </span>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{m.title}</p>
                <p className="font-mono text-2xl tracking-tight">{m.value}</p>
                <Sparkline values={m.spark} color={m.color} className="mt-2 h-9 w-full" />
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">{m.hint}</p>
              </article>
            ))}
          </section>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border bg-card p-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="text-lg font-medium">{t("psd.title")}</h3>
                  <p className="text-sm text-muted-foreground">{t("psd.hint")}</p>
                </div>
                <p className="font-mono text-xs text-muted-foreground">
                  <span className="mr-2" style={{ color: FLAME }}>
                    ● {t("psd.legend1g")}
                  </span>
                  <span style={{ color: PLASMA }}>● {t("psd.legend0g")}</span>
                </p>
              </div>
              {s8g && s8z ? (
                <PsdChart
                  series={[
                    { id: "1g", color: FLAME, points: s8g.points },
                    { id: "0g", color: PLASMA, points: s8z.points },
                  ]}
                  labels={{ x: t("psd.x"), y: t("psd.y") }}
                />
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">{t("cite")}</p>
            </section>
            <section className="rounded-2xl border bg-card p-5">
              <h3 className="text-lg font-medium">{t("tail.title")}</h3>
              <p className="mb-3 text-sm text-muted-foreground">{t("tail.hint")}</p>
              <GroupedBarChart
                categories={["8 cm/s", "10 cm/s"]}
                series={[
                  {
                    id: "1g",
                    label: t("psd.legend1g"),
                    color: FLAME,
                    values: [share("8cm-1g") * 100, share("10cm-1g") * 100],
                  },
                  {
                    id: "0g",
                    label: t("psd.legend0g"),
                    color: PLASMA,
                    values: [share("8cm-0g") * 100, share("10cm-0g") * 100],
                  },
                ]}
                yLabel={t("tail.y")}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {t("materials.label")}: {materials.join(" · ")}
              </p>
            </section>
          </div>
        </>
      ) : null}

      {showPrevention ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border bg-card p-5">
            <h3 className="text-lg font-medium">{t("map.title")}</h3>
            <p className="mb-3 text-sm text-muted-foreground">{t("map.hint")}</p>
            <FlammabilityMap
              points={[
                {
                  id: "same-8",
                  flow: 8,
                  o2: 21,
                  color: FLAME,
                  label: "SAME 8 cm/s",
                },
                {
                  id: "same-10",
                  flow: 10,
                  o2: 21,
                  color: PLASMA,
                  label: "SAME 10 cm/s",
                },
              ]}
              labels={{
                x: t("map.x"),
                y: t("map.y"),
                vent: t("map.vent"),
                typical: t("map.typical"),
              }}
            />
            <p className="mt-2 text-xs text-muted-foreground">{t("map.caption")}</p>
          </section>
          <section className="rounded-2xl border bg-card p-5">
            <h3 className="text-lg font-medium">{t("atmo.title")}</h3>
            <p className="mb-4 text-sm text-muted-foreground">{t("atmo.hint")}</p>
            <AtmosphereBars zones={atmo} />
          </section>
        </div>
      ) : null}

      {showSuppression ? (
        <section className="mt-4 rounded-2xl border bg-card p-5">
          <h3 className="text-lg font-medium">{t("fuels.title")}</h3>
          <p className="mb-3 text-sm text-muted-foreground">{t("fuels.hint")}</p>
          <ul className="flex flex-wrap gap-2">
            {insights.spice_fuels
              .slice()
              .sort((a, b) => b.n - a.n)
              .map((f) => (
                <li key={f.fuel} className="rounded-full border bg-secondary/50 px-3 py-1 font-mono text-xs">
                  {f.fuel} <span className="text-flame">{f.n}</span>
                </li>
              ))}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">{t("suppressNote")}</p>
        </section>
      ) : null}

      <aside className="mt-6 rounded-2xl border border-dashed p-5">
        <h3 className="text-lg font-medium">{t("gap.title")}</h3>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t("gap.body")}</p>
      </aside>
    </div>
  );
}
