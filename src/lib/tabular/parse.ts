/** Filename / header helpers for SAME-style PSI spreadsheets. Pure — no I/O. */

export const MATERIAL_LABELS = {
  dibutyl_phthalate: { en: "Dibutyl phthalate", "pt-BR": "Ftalato de dibutila (DBP)" },
  lampwick: { en: "Lampwick", "pt-BR": "Pavio (lampwick)" },
  kapton: { en: "Kapton", "pt-BR": "Kapton" },
  teflon: { en: "Teflon", "pt-BR": "Teflon" },
  silicone_rubber: { en: "Silicone rubber", "pt-BR": "Borracha de silicone" },
  pyrell: { en: "Pyrell", "pt-BR": "Pyrell" },
} as const;

export type MaterialId = keyof typeof MATERIAL_LABELS;

const MATERIAL_RES: { id: MaterialId; re: RegExp }[] = [
  { id: "dibutyl_phthalate", re: /dbp|dibutyl/i },
  { id: "lampwick", re: /lampwick/i },
  { id: "kapton", re: /kapton/i },
  { id: "teflon", re: /teflon/i },
  { id: "silicone_rubber", re: /silicon/i },
  { id: "pyrell", re: /pyrell/i },
];

export type FileMeta = {
  gmt: string | null;
  run_label: string | null;
  material: MaterialId | null;
};

export function parseFileMeta(fileName: string): FileMeta {
  const gmt = fileName.match(/GMT\s*(\d{3})/i)?.[1] ?? null;
  const run =
    fileName.match(/run\s*([0-9]+[a-z]?)/i)?.[1] ??
    fileName.match(/(?:test|hkp)?(\d{1,3})(?:hkp|avg|a)?\.[a-z]/i)?.[1] ??
    null;
  const material = MATERIAL_RES.find((m) => m.re.test(fileName))?.id ?? null;
  return { gmt, run_label: run, material };
}

export function skipWorkbook(fileName: string): boolean {
  return /testlog|vpred|^test\.xls/i.test(fileName);
}

export function preferredSheets(sheetNames: string[]): string[] {
  const avg = sheetNames.filter((n) => /averag/i.test(n));
  if (avg.length) return avg;
  const graph = sheetNames.filter((n) => /graph/i.test(n) && !/hkp/i.test(n));
  if (graph.length) return graph;
  return sheetNames.filter((n) => /^sheet1$/i.test(n) || /\bdata\b/i.test(n));
}

export type DetectorCol =
  | "time_string"
  | "elapsed_s"
  | "iss_obscuration_v"
  | "iss_scatter_v"
  | "sts_v"
  | "ion_a_v"
  | "ion_b_v"
  | "ptrak_pt_per_cc"
  | "dusttrak_a_mg_m3"
  | "dusttrak_b_mg_m3";

const HEADER_RULES: { col: DetectorCol; test: (h: string) => boolean }[] = [
  { col: "time_string", test: (h) => h === "timestring" || h === "timestamp" },
  { col: "elapsed_s", test: (h) => h === "time" || h.includes("elapsedtesttime") },
  { col: "iss_obscuration_v", test: (h) => h.includes("iss") && h.includes("obscur") },
  { col: "iss_scatter_v", test: (h) => h.includes("iss") && h.includes("scatter") },
  { col: "sts_v", test: (h) => h.includes("stsdetector") },
  { col: "ion_a_v", test: (h) => h.includes("iondetectora") },
  { col: "ion_b_v", test: (h) => h.includes("iondetectorb") },
  { col: "ptrak_pt_per_cc", test: (h) => h.includes("ptrak") },
  { col: "dusttrak_a_mg_m3", test: (h) => h.includes("dusttraka") },
  { col: "dusttrak_b_mg_m3", test: (h) => h.includes("dusttrakb") },
];

export function normHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function mapDetectorHeaders(headers: string[]): Partial<Record<DetectorCol, number>> {
  const out: Partial<Record<DetectorCol, number>> = {};
  headers.forEach((raw, i) => {
    const h = normHeader(String(raw ?? ""));
    if (!h) return;
    for (const rule of HEADER_RULES) {
      if (out[rule.col] == null && rule.test(h)) {
        out[rule.col] = i;
        break;
      }
    }
  });
  return out;
}

export function isDetectorSheet(headers: string[], ncols: number): boolean {
  if (ncols >= 40) return false;
  const mapped = mapDetectorHeaders(headers);
  const sensors = [
    mapped.iss_obscuration_v,
    mapped.iss_scatter_v,
    mapped.sts_v,
    mapped.ion_a_v,
    mapped.ptrak_pt_per_cc,
    mapped.dusttrak_a_mg_m3,
  ].filter((x) => x != null);
  return sensors.length >= 3;
}

export type DetectorSample = {
  t_index: number;
  time_string: string | null;
  elapsed_s: number | null;
  iss_obscuration_v: number | null;
  iss_scatter_v: number | null;
  sts_v: number | null;
  ion_a_v: number | null;
  ion_b_v: number | null;
  ptrak_pt_per_cc: number | null;
  dusttrak_a_mg_m3: number | null;
  dusttrak_b_mg_m3: number | null;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function rowsToSamples(headers: string[], rows: unknown[][]): DetectorSample[] {
  const map = mapDetectorHeaders(headers);
  const samples: DetectorSample[] = [];
  rows.forEach((row, i) => {
    const sample: DetectorSample = {
      t_index: i,
      time_string: map.time_string != null ? String(row[map.time_string] ?? "") || null : null,
      elapsed_s: map.elapsed_s != null ? num(row[map.elapsed_s]) : null,
      iss_obscuration_v: map.iss_obscuration_v != null ? num(row[map.iss_obscuration_v]) : null,
      iss_scatter_v: map.iss_scatter_v != null ? num(row[map.iss_scatter_v]) : null,
      sts_v: map.sts_v != null ? num(row[map.sts_v]) : null,
      ion_a_v: map.ion_a_v != null ? num(row[map.ion_a_v]) : null,
      ion_b_v: map.ion_b_v != null ? num(row[map.ion_b_v]) : null,
      ptrak_pt_per_cc: map.ptrak_pt_per_cc != null ? num(row[map.ptrak_pt_per_cc]) : null,
      dusttrak_a_mg_m3: map.dusttrak_a_mg_m3 != null ? num(row[map.dusttrak_a_mg_m3]) : null,
      dusttrak_b_mg_m3: map.dusttrak_b_mg_m3 != null ? num(row[map.dusttrak_b_mg_m3]) : null,
    };
    const has =
      sample.iss_scatter_v != null ||
      sample.iss_obscuration_v != null ||
      sample.dusttrak_a_mg_m3 != null ||
      sample.ptrak_pt_per_cc != null;
    if (has) samples.push(sample);
  });
  return samples;
}

export function downsample<T>(items: T[], max = 400): T[] {
  if (items.length <= max) return items;
  const out: T[] = [];
  const step = (items.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(items[Math.round(i * step)]!);
  return out;
}

export function peak(values: (number | null)[]): number | null {
  let m: number | null = null;
  for (const v of values) {
    if (v == null) continue;
    if (m == null || v > m) m = v;
  }
  return m;
}
