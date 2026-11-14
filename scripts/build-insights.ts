/**
 * Compact chart JSON from curated PSI tabular + experimental tables.
 * Called by data:build. Output: src/lib/insights/data.json
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const OUT = path.join(root, "src", "lib", "insights", "data.json");

type PsdPoint = { d_nm: number; psd: number; log10: number };
type PsdSeries = {
  id: string;
  gravity: "1g" | "0g";
  flow_cm_s: number;
  file: string;
  points: PsdPoint[];
  mode_d_nm: number;
  large_share: number;
};

function parseSciLine(line: string): number | null {
  const t = line.trim();
  if (!t || /[a-zA-Z]/.test(t.replace(/[eE+\-.\d\s]/g, ""))) {
    if (/^[+\-]?\d/.test(t) || t.includes("E") || t.includes("e")) {
      const n = Number(t.split(/\s+/).pop());
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseDiameters(text: string): number[] {
  const out: number[] = [];
  for (const line of text.split(/\n/)) {
    const n = parseSciLine(line);
    if (n !== null && n > 0) out.push(n);
  }
  return out;
}

function parsePsd(text: string): { bin: number; value: number }[] {
  const out: { bin: number; value: number }[] = [];
  for (const line of text.split(/\n/)) {
    const parts = line.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) continue;
    const bin = Number(parts[0]);
    const value = Number(parts[1]);
    if (Number.isInteger(bin) && Number.isFinite(value) && value >= 0) out.push({ bin, value });
  }
  return out;
}

function seriesFrom(id: string, gravity: "1g" | "0g", flow: number, file: string, diameters: number[], psd: { bin: number; value: number }[]): PsdSeries {
  const points: PsdPoint[] = [];
  for (const row of psd) {
    const d = diameters[row.bin - 2];
    if (!d) continue;
    const psdVal = row.value;
    points.push({
      d_nm: d * 1e9,
      psd: psdVal,
      log10: Math.log10(psdVal + 1e-30),
    });
  }
  let mode = points[0];
  for (const p of points) if (p.psd > (mode?.psd ?? 0)) mode = p;
  const total = points.reduce((s, p) => s + p.psd, 0);
  const tail = points.filter((p) => p.d_nm >= 20_000).reduce((s, p) => s + p.psd, 0);
  return {
    id,
    gravity,
    flow_cm_s: flow,
    file,
    points,
    mode_d_nm: mode?.d_nm ?? 0,
    large_share: total > 0 ? tail / total : 0,
  };
}

function parseCsv(csv: string): string[][] {
  return csv
    .trim()
    .split("\n")
    .map((line) => line.split(",").map((c) => c.trim()));
}

function spiceSummary(csv: string) {
  const rows = parseCsv(csv);
  const header = rows[0] ?? [];
  const fuelI = header.findIndex((h) => /^fuel$/i.test(h));
  const airI = header.findIndex((h) => /air rate/i.test(h));
  const nozI = header.findIndex((h) => /nozzle/i.test(h));
  const counts = new Map<string, { n: number; air: number[]; nozzles: Set<string> }>();
  for (const r of rows.slice(1)) {
    const fuel = (r[fuelI] ?? "")
      .replace(/\s+/g, " ")
      .replace(/75\s*%\s*Propylene/i, "75% Propylene")
      .replace(/50\s*%\s*Propylene/i, "50% Propylene");
    if (!fuel) continue;
    const air = Number(r[airI]);
    const noz = r[nozI] ?? "";
    const cur = counts.get(fuel) ?? { n: 0, air: [], nozzles: new Set<string>() };
    cur.n += 1;
    if (Number.isFinite(air) && air > 0) cur.air.push(air);
    if (noz) cur.nozzles.add(noz);
    counts.set(fuel, cur);
  }
  return [...counts.entries()].map(([fuel, v]) => ({
    fuel,
    n: v.n,
    air_min: v.air.length ? Math.min(...v.air) : null,
    air_max: v.air.length ? Math.max(...v.air) : null,
    nozzles: [...v.nozzles],
  }));
}

export async function buildInsights(): Promise<{ ok: boolean; message: string }> {
  const tabular = path.join(root, "data", "raw", "psi-tabular", "PSI-115");
  let diameters: number[] = [];
  try {
    diameters = parseDiameters(await readFile(path.join(tabular, "nodeDiameters.dat"), "utf8"));
  } catch {
    return { ok: false, message: "PSI-115 nodeDiameters.dat ausente — insights não regenerados" };
  }

  const specs = [
    { id: "8cm-1g", gravity: "1g" as const, flow: 8, file: "8cmGravityPSD.dat" },
    { id: "8cm-0g", gravity: "0g" as const, flow: 8, file: "8cmNoGravityPSD.dat" },
    { id: "10cm-1g", gravity: "1g" as const, flow: 10, file: "10cmGravityPSD.dat" },
    { id: "10cm-0g", gravity: "0g" as const, flow: 10, file: "10cmNoGravityPSD.dat" },
  ];

  const smoke: PsdSeries[] = [];
  for (const s of specs) {
    const text = await readFile(path.join(tabular, s.file), "utf8");
    smoke.push(seriesFrom(s.id, s.gravity, s.flow, s.file, diameters, parsePsd(text)));
  }

  const g8 = smoke.find((s) => s.id === "8cm-1g")!;
  const z8 = smoke.find((s) => s.id === "8cm-0g")!;

  let same_materials: { material: string; air_cm_s: number | null; mass_loss_mg_min: number | null; aging_min: number | null }[] = [];
  try {
    const raw = JSON.parse(await readFile(path.join(root, "data", "raw", "psi", "PSI-102.json"), "utf8")) as {
      experimental_tables: { csv: string }[];
    };
    const rows = parseCsv(raw.experimental_tables[0]?.csv ?? "");
    for (const r of rows.slice(1)) {
      if (!r[1]) continue;
      same_materials.push({
        material: r[1].replace(/: same conditions as 1-4/i, "").trim(),
        air_cm_s: r[2] ? Number(r[2]) : null,
        mass_loss_mg_min: r[3] ? Number(r[3]) : null,
        aging_min: r[4] ? Number(r[4]) : null,
      });
    }
  } catch {
    same_materials = [];
  }

  let spice_fuels: ReturnType<typeof spiceSummary> = [];
  try {
    const raw = JSON.parse(await readFile(path.join(root, "data", "raw", "psi", "PSI-107.json"), "utf8")) as {
      experimental_tables: { csv: string }[];
    };
    spice_fuels = spiceSummary(raw.experimental_tables[0]?.csv ?? "");
  } catch {
    spice_fuels = [];
  }

  const payload = {
    generated_at: new Date().toISOString(),
    sources: [
      { psi_id: "PSI-115", url: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-115", doi: "10.60555/q0v5-1v28" },
      { psi_id: "PSI-102", url: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-102", doi: "10.60555/gd4k-8h62" },
      { psi_id: "PSI-107", url: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-107", doi: null },
    ],
    smoke: {
      headline: {
        flow_cm_s: 8,
        mode_d_nm_1g: g8.mode_d_nm,
        mode_d_nm_0g: z8.mode_d_nm,
        large_share_1g: g8.large_share,
        large_share_0g: z8.large_share,
        large_share_ratio: g8.large_share > 0 ? z8.large_share / g8.large_share : 0,
        tail_cutoff_nm: 20_000,
      },
      series: smoke,
    },
    same_materials,
    spice_fuels,
    kpis: {
      curated_psi: 7,
      combustion_in_index: 26,
      same_materials: same_materials.length,
      spice_runs: spice_fuels.reduce((s, f) => s + f.n, 0),
      lunar_o2_increase_pct: 43,
    },
  };

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload) + "\n", "utf8");
  return { ok: true, message: `insights: ${smoke.length} PSD séries, ${same_materials.length} materiais SAME, ${spice_fuels.length} combustíveis SPICE` };
}

