import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { DetectorTrace } from "@/components/dashboard/detector-trace";
import { loadTabular } from "@/lib/tabular/load";
import { MATERIAL_LABELS, type MaterialId } from "@/lib/tabular/parse";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("dados"))("title") };
}

function normalize(values: (number | null)[]): (number | null)[] {
  const nums = values.filter((v): v is number => v != null);
  if (!nums.length) return values;
  const min = Math.min(...nums);
  const span = Math.max(...nums) - min || 1;
  return values.map((v) => (v == null ? null : (v - min) / span));
}

const MATERIALS: MaterialId[] = [
  "dibutyl_phthalate",
  "lampwick",
  "kapton",
  "teflon",
  "silicone_rubber",
];

export default async function DadosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("dados");
  const locale = (await getLocale()).startsWith("pt") ? "pt-BR" : "en";
  const sp = await searchParams;
  const material = typeof sp.material === "string" ? sp.material : "all";
  const runId = typeof sp.run === "string" ? sp.run : null;
  const warehouse = loadTabular();

  if (!warehouse) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-3 text-muted-foreground">{t("empty")}</p>
        <pre className="mt-6 overflow-x-auto rounded-lg border bg-card p-4 font-mono text-xs">
          npm run data:ingest-tabular
        </pre>
      </div>
    );
  }

  const runs = warehouse.runs.filter((r) => material === "all" || r.material === material);
  const selected = runs.find((r) => r.id === runId) ?? runs[0] ?? null;
  const same = warehouse.conditions.find((c) => c.psi_id === "PSI-102");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t("lead", { n: warehouse.n_samples, files: warehouse.runs.length })}</p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{warehouse.sqlite}</p>

      <nav aria-label={t("materials")} className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/dados"
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm",
            material === "all" ? "border-plasma bg-plasma/15" : "border-border text-muted-foreground",
          )}
        >
          {t("all")}
        </Link>
        {MATERIALS.map((id) => (
          <Link
            key={id}
            href={`/dados?material=${id}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm",
              material === id ? "border-plasma bg-plasma/15" : "border-border text-muted-foreground",
            )}
          >
            {MATERIAL_LABELS[id][locale]}
          </Link>
        ))}
      </nav>

      {selected ? (
        <section className="mt-6 rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-medium">{selected.file_name}</h2>
          <p className="text-sm text-muted-foreground">
            {selected.material_label ?? selected.material} · GMT {selected.gmt ?? "—"} · {selected.n_rows} {t("points")} · {selected.sheet_name}
          </p>
          <DetectorTrace
            series={[
              { id: "iss", color: "#4da3ff", values: normalize(selected.series.iss_scatter) },
              { id: "dust", color: "#ff7a1a", values: normalize(selected.series.dusttrak_a) },
              { id: "ptrak", color: "#2bb3a3", values: normalize(selected.series.ptrak) },
            ]}
            labels={{ x: t("chartX"), y: t("chartY") }}
          />
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            <span className="text-plasma">●</span> ISS scatter · <span className="text-flame">●</span> DustTrak A ·{" "}
            <span className="text-earth">●</span> PTrak
          </p>
        </section>
      ) : null}

      <section className="mt-6 overflow-x-auto rounded-2xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary/50 font-mono text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">{t("col.file")}</th>
              <th className="px-3 py-2">{t("col.material")}</th>
              <th className="px-3 py-2">GMT</th>
              <th className="px-3 py-2">{t("col.n")}</th>
              <th className="px-3 py-2">ISS scatter max</th>
              <th className="px-3 py-2">DustTrak max</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => {
              const href = material === "all" ? `/dados?run=${r.id}` : `/dados?material=${material}&run=${r.id}`;
              const active = selected?.id === r.id;
              return (
                <tr key={r.id} className={cn("border-t", active && "bg-plasma/10")}>
                  <td className="px-3 py-2">
                    <Link href={href} className="text-plasma hover:underline">
                      {r.file_name}
                    </Link>
                    <p className="font-mono text-[10px] text-muted-foreground">{r.sheet_name}</p>
                  </td>
                  <td className="px-3 py-2">{r.material_label ?? r.material ?? "—"}</td>
                  <td className="px-3 py-2 font-mono">{r.gmt ?? "—"}</td>
                  <td className="px-3 py-2 font-mono">{r.n_rows}</td>
                  <td className="px-3 py-2 font-mono">{r.peaks.iss_scatter?.toFixed(3) ?? "—"}</td>
                  <td className="px-3 py-2 font-mono">{r.peaks.dusttrak_a?.toFixed(3) ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {same ? (
        <section className="mt-8">
          <h2 className="text-lg font-medium">{t("matrixTitle")}</h2>
          <p className="mb-3 text-sm text-muted-foreground">{same.file_name}</p>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary/50 font-mono text-[11px] uppercase text-muted-foreground">
                <tr>
                  {Object.keys(same.rows[0] ?? {}).map((h) => (
                    <th key={h} className="px-3 py-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {same.rows.map((row, i) => (
                  <tr key={i} className="border-t">
                    {Object.values(row).map((v, j) => (
                      <td key={j} className="px-3 py-2">
                        {v || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
