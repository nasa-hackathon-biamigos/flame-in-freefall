import {
  AlertTriangle,
  Cpu,
  Droplets,
  Flame,
  Home,
  LayoutDashboard,
  Moon,
  Radar,
  Shield,
  Table2,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { AtmosphereBars, GroupedBarChart, PsdChart, Sparkline } from "@/components/dashboard/charts";
import { formatNm, formatPct, formatRatio, loadInsights } from "@/lib/insights/load";

const FLAME = "#ff7a1a";
const PLASMA = "#4da3ff";
const EARTH = "#2bb3a3";
const PREVENTION = "#ff9f43";
const HW_COLOR: Record<string, string> = {
  same: PLASMA,
  msg: PREVENTION,
  "cir-mdca": EARTH,
  "cir-acme": FLAME,
};

type Pair = { id: string; title: string; items: string; note: string };
type Dual = { kicker: string; body: string };
type Row = { psi: string; name: string; pillar: string; hw: string; material: string; changed: string };

function sparkValues(id: string) {
  const insights = loadInsights();
  const s = insights.smoke.series.find((x) => x.id === id);
  return (s?.points ?? [])
    .filter((p) => p.d_nm >= 80 && p.d_nm <= 80_000)
    .map((p) => p.log10);
}

function share(id: string) {
  return loadInsights().smoke.series.find((s) => s.id === id)?.large_share ?? 0;
}

export async function Dashboard() {
  const t = await getTranslations("dash");
  const locale = await getLocale();
  const insights = loadInsights();
  const h = insights.smoke.headline;
  const s8g = insights.smoke.series.find((s) => s.id === "8cm-1g");
  const s8z = insights.smoke.series.find((s) => s.id === "8cm-0g");
  const materials = [...new Set(insights.same_materials.map((m) => m.material))];
  const hardware = t.raw("hardware.items") as Pair[];
  const dual = t.raw("dual.items") as Dual[];
  const rows = t.raw("table.rows") as Row[];
  const cols = t.raw("table.cols") as string[];

  const kpis = [
    { value: String(insights.kpis.curated_psi), label: t("kpi.curated"), hint: t("kpi.curatedHint") },
    { value: String(insights.kpis.combustion_in_index), label: t("kpi.index"), hint: t("kpi.indexHint") },
    { value: String(materials.length), label: t("kpi.materials"), hint: t("kpi.materialsHint") },
    { value: String(insights.kpis.spice_runs), label: t("kpi.spice"), hint: t("kpi.spiceHint") },
  ];

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

  const nav = [
    { href: "#top", icon: Home, label: t("side.home") },
    { href: "#insights", icon: LayoutDashboard, label: t("side.insights") },
    { href: "#hardware", icon: Cpu, label: t("side.hardware") },
    { href: "#table", icon: Table2, label: t("side.table") },
    { href: "#gap", icon: AlertTriangle, label: t("side.gap") },
  ];

  return (
    <div className="px-3 py-4 sm:px-6 sm:py-6">
      <div
        id="top"
        className="relative mx-auto max-w-[1180px] rounded-[28px] border border-white/8 bg-[#0b1118] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-7 lg:pl-16"
      >
        <nav
          aria-label={t("side.label")}
          className="absolute top-1/2 left-0 z-10 hidden -translate-x-1/2 -translate-y-1/2 flex-col gap-1 rounded-full bg-earth p-2 text-[#06221e] shadow-lg lg:flex"
        >
          {nav.map((item, i) => (
            <a
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex size-10 items-center justify-center rounded-full transition-colors hover:bg-white/25 ${i === 0 ? "bg-white/90" : ""}`}
            >
              <item.icon className="size-4" aria-hidden />
              <span className="sr-only">{item.label}</span>
            </a>
          ))}
        </nav>

        <header className="space-y-4">
          <div>
            <p className="font-mono text-[11px] tracking-[0.22em] text-plasma uppercase">{t("kicker")}</p>
            <h1 className="mt-1 max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">{t("lead")}</p>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">{t("facts.source")}</dt>
              <dd className="font-medium">NASA PSI</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("facts.gravity")}</dt>
              <dd className="font-medium">1g / 0g</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("facts.flow")}</dt>
              <dd className="font-medium">{h.flow_cm_s} cm/s</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("facts.doi")}</dt>
              <dd className="font-mono text-xs sm:text-sm">10.60555/q0v5-1v28</dd>
            </div>
          </dl>
        </header>

        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((k) => (
            <li key={k.label} className="rounded-2xl border bg-card p-4">
              <p className="font-mono text-2xl text-flame">{k.value}</p>
              <p className="mt-1 text-sm">{k.label}</p>
              <p className="text-xs text-muted-foreground">{k.hint}</p>
            </li>
          ))}
        </ul>

        <section id="insights" className="mt-4 scroll-mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {metricCards.map((m) => (
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
                <h2 className="text-lg font-medium">{t("psd.title")}</h2>
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
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-lg font-medium">{t("tail.title")}</h2>
                <p className="text-sm text-muted-foreground">{t("tail.hint")}</p>
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                <span className="mr-2" style={{ color: FLAME }}>
                  ● {t("psd.legend1g")}
                </span>
                <span style={{ color: PLASMA }}>● {t("psd.legend0g")}</span>
              </p>
            </div>
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
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              0g / 1g @ 8 cm/s = {formatRatio(h.large_share_ratio)}
            </p>
          </section>
        </div>

        <section className="mt-4 rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-medium">{t("atmo.title")}</h2>
          <p className="mb-4 text-sm text-muted-foreground">{t("atmo.hint")}</p>
          <AtmosphereBars zones={atmo} />
        </section>

        <section id="hardware" className="mt-6 scroll-mt-8">
          <h2 className="mb-1 text-lg font-medium">{t("hardware.title")}</h2>
          <p className="mb-3 text-sm text-muted-foreground">{t("hardware.hint")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {hardware.map((block) => (
              <article key={block.id} className="rounded-2xl border bg-card p-4">
                <p className="font-mono text-xs" style={{ color: HW_COLOR[block.id] ?? PLASMA }}>
                  {block.title}
                </p>
                <p className="mt-1 text-sm font-medium">{block.items}</p>
                <p className="mt-1 text-sm text-muted-foreground">{block.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-medium">{t("dual.title")}</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-3">
            {dual.map((item, i) => (
              <li key={item.kicker} className="rounded-xl bg-secondary/60 p-3 text-sm">
                <span className="font-mono text-xs" style={{ color: [PLASMA, FLAME, EARTH][i] }}>
                  {item.kicker}
                </span>
                <p className="mt-1 text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-4 rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-medium">{t("fuels.title")}</h2>
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
          <p className="mt-3 text-xs text-muted-foreground">
            {t("materials.label")}: {materials.join(" · ")}
          </p>
        </section>

        <section id="table" className="mt-6 scroll-mt-8">
          <h2 className="text-lg font-medium">{t("table.title")}</h2>
          <p className="mb-3 text-sm text-muted-foreground">{t("table.hint")}</p>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-secondary/80 font-mono text-xs text-muted-foreground">
                <tr>
                  {cols.map((c) => (
                    <th key={c} className="px-3 py-2 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.psi} className="border-t">
                    <td className="px-3 py-2 font-mono text-plasma">{row.psi}</td>
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2">{row.pillar}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.hw}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.material}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.changed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside id="gap" className="mt-6 scroll-mt-8 rounded-2xl border border-dashed p-5">
          <h2 className="text-lg font-medium">{t("gap.title")}</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t("gap.body")}</p>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            {locale} · {insights.generated_at.slice(0, 10)}
          </p>
        </aside>
      </div>
    </div>
  );
}
