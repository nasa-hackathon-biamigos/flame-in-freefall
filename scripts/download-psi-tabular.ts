/**
 * Downloads **curated** tabular PSI assets (amostras para análise / hackathon).
 *
 *   npm run data:download-tabular                    # lista curada, ≤1 GiB por PSI
 *   npm run data:download-tabular PSI-102 PSI-115    # IDs específicos
 *   npm run data:download-tabular -- --max-mb=1024
 *   npm run data:download-tabular -- --all-hero      # antigo: todas as fichas herói (sem curadoria)
 *   npm run data:download-tabular -- --force
 *
 * Output: data/raw/psi-tabular/<PSI-ID>/… + manifest.json
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = "https://psi.nasa.gov";
const OUT_ROOT = path.join(process.cwd(), "data", "raw", "psi-tabular");
const CACHE_ROOT = path.join(process.cwd(), "data", "raw", "psi-cache");
const LEGACY_115 = path.join(process.cwd(), "data", "psi-115");
const USER_AGENT = "SpaceFirefightersDataScraper/0.1 (NASA Space Apps Challenge 2026)";
const MIN_INTERVAL_MS = 1100;
const TABULAR_EXT = [".csv", ".xls", ".xlsx", ".dat", ".txt", ".tsv"] as const;
const DEFAULT_MAX_INV_BYTES = 1024 * 1024 * 1024;
const MAX_SINGLE_FILE_BYTES = 120 * 1024 * 1024;

/** Investigações do plano hackathon (evita BASS/SAFFIRE/CFI em massa). */
const CURATED_SAMPLE_IDS = [
  "PSI-115",
  "PSI-102",
  "PSI-117",
  "PSI-142",
  "PSI-98",
  "PSI-101",
  "PSI-107",
] as const;

const HERO_IDS = [
  "PSI-102",
  "PSI-101",
  "PSI-69",
  "PSI-39",
  "PSI-26",
  "PSI-25",
  "PSI-107",
  "PSI-106",
  "PSI-98",
  "PSI-99",
  "PSI-100",
  "PSI-20",
  "PSI-159",
  "PSI-115",
] as const;

type CuratedRule = {
  includeCategory?: string[];
  includeName?: RegExp;
  excludeName?: RegExp;
  maxFileBytes?: number;
};

/** Filtros alinhados à tabela de custo/benefício do projeto. */
const CURATED_PROFILES: Record<string, CuratedRule> = {
  "PSI-115": {
    includeCategory: ["Analyzed Data"],
    includeName: /(PSD|NumDen|NucRate|nodeDiameters)\.dat$/i,
    excludeName: /(sGrid_grid3d|Smoke|DAM|Temperature|Species|Vort|Vapor|_[UV]\.dat)/i,
    maxFileBytes: 12 * 1024 * 1024,
  },
  "PSI-102": {
    includeCategory: ["Experimental table", "Analyzed Data"],
    excludeName: /Engineering Documents/i,
  },
  "PSI-101": {
    includeCategory: ["Experimental table", "Analyzed Data"],
    excludeName: /Engineering Documents|Presentations/i,
  },
  "PSI-117": {
    includeCategory: ["Analyzed Data", "Reports", "Science Documents"],
    includeName: /\.(csv|xlsx?|dat|txt)$/i,
    maxFileBytes: 25 * 1024 * 1024,
  },
  "PSI-142": {
    includeCategory: ["Analyzed Data", "Experimental table"],
    includeName: /\.(csv|xlsx?)$/i,
    maxFileBytes: 5 * 1024 * 1024,
  },
  "PSI-98": {
    includeCategory: ["Experimental table", "Analyzed Data", "Science Documents", "Raw Data"],
    includeName: /\.(csv|xls|xlsx|dat|txt)$/i,
    excludeName: /(DistortionGrid|ImageFrame|\.zip|video|mp4)/i,
    maxFileBytes: 80 * 1024 * 1024,
  },
  "PSI-107": {
    includeCategory: ["Experimental table", "Analyzed Data"],
    excludeName: /(NEF|Nikon|Raw Data)/i,
    maxFileBytes: 50 * 1024 * 1024,
  },
};

type PsiFile = {
  file_name: string;
  file_size: number;
  version: number;
  visible?: boolean;
  restricted?: boolean;
};

type PsiDetail = {
  accession: string;
  totalFileSize?: number;
  version?: number;
  added?: PsiFile[];
  experimentalTable?: PsiFile[];
};

let lastRequestAt = 0;

async function politeFetch(url: string, retries = 4): Promise<Response> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
  let lastStatus = 0;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json, text/plain, */*" },
    });
    lastStatus = res.status;
    if (res.ok) return res;
    if (res.status < 500 || attempt === retries) break;
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  throw new Error(`HTTP ${lastStatus} for ${url}`);
}

function isTabular(name: string): boolean {
  const lower = name.toLowerCase();
  return TABULAR_EXT.some((ext) => lower.endsWith(ext));
}

function fileCategory(fileName: string): string {
  const m = fileName.match(/^PSI-\d+_(.+?)_/);
  return m?.[1] ?? "";
}

function localName(fileName: string): string {
  const base = fileName.includes("_") ? fileName.split("_").slice(-1)[0]! : fileName;
  return base.replace(/[<>:"|?*]/g, "_");
}

async function presignedDownloadUrl(psiId: string, fileName: string, version: number): Promise<string> {
  const q = new URLSearchParams({ file: fileName, version: String(version), redirect: "false" });
  const text = (await (await politeFetch(`${BASE}/geode-py/ws/studies/${psiId}/download?${q}`)).text()).trim();
  if (text.startsWith("{")) throw new Error(text);
  if (!text.startsWith("https://")) throw new Error(`unexpected download response for ${fileName}`);
  return text;
}

async function downloadFile(url: string, dest: string): Promise<void> {
  await mkdir(path.dirname(dest), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading asset`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

async function exists(file: string): Promise<boolean> {
  return stat(file).then(
    () => true,
    () => false,
  );
}

function collectTabularFiles(d: PsiDetail): PsiFile[] {
  const fromAdded = (d.added ?? []).filter((f) => f.visible !== false && !f.restricted && isTabular(f.file_name));
  const fromTables = (d.experimentalTable ?? []).filter(
    (f) => f.visible !== false && !f.restricted && isTabular(f.file_name),
  );
  const byName = new Map<string, PsiFile>();
  for (const f of [...fromAdded, ...fromTables]) byName.set(f.file_name, f);
  return [...byName.values()].sort((a, b) => a.file_size - b.file_size);
}

function applyCuratedFilter(psiId: string, files: PsiFile[], useCurated: boolean): PsiFile[] {
  if (!useCurated) return files;
  const rule = CURATED_PROFILES[psiId];
  if (!rule) return [];
  return files.filter((f) => {
    if (rule.maxFileBytes && f.file_size > rule.maxFileBytes) return false;
    if (f.file_size > MAX_SINGLE_FILE_BYTES) return false;
    const cat = fileCategory(f.file_name);
    if (rule.includeCategory?.length && !rule.includeCategory.some((c) => cat === c)) return false;
    if (rule.includeName && !rule.includeName.test(f.file_name)) return false;
    if (rule.excludeName?.test(f.file_name)) return false;
    return true;
  });
}

function selectWithinBudget(files: PsiFile[], maxInvBytes: number): PsiFile[] {
  const selected: PsiFile[] = [];
  let total = 0;
  for (const f of files) {
    if (total + f.file_size > maxInvBytes) break;
    selected.push(f);
    total += f.file_size;
  }
  return selected;
}

async function loadDetail(psiId: string): Promise<PsiDetail> {
  const cacheFile = path.join(CACHE_ROOT, `${psiId}.json`);
  try {
    const detail = (await (await politeFetch(`${BASE}/geode-py/ws/repo/investigations/${psiId}`)).json()) as PsiDetail;
    await mkdir(CACHE_ROOT, { recursive: true });
    await writeFile(cacheFile, JSON.stringify(detail) + "\n", "utf8");
    return detail;
  } catch {
    if (await exists(cacheFile)) {
      console.warn(`  ! API falhou; usando cache ${cacheFile}`);
      return JSON.parse(await readFile(cacheFile, "utf8")) as PsiDetail;
    }
    const legacyInv = path.join(LEGACY_115, "investigation.json");
    if (psiId === "PSI-115" && (await exists(legacyInv))) {
      console.warn(`  ! API falhou; usando ${legacyInv}`);
      return JSON.parse(await readFile(legacyInv, "utf8")) as PsiDetail;
    }
    throw new Error(`sem API nem cache para ${psiId}`);
  }
}

async function processInvestigation(
  psiId: string,
  maxInvBytes: number,
  force: boolean,
  useCurated: boolean,
): Promise<void> {
  const outDir = path.join(OUT_ROOT, psiId);
  await mkdir(outDir, { recursive: true });

  const detail = await loadDetail(psiId);
  const all = collectTabularFiles(detail);
  const filtered = applyCuratedFilter(psiId, all, useCurated);
  const picked = selectWithinBudget(filtered, maxInvBytes);

  const manifest: Array<{ file_name: string; local_path: string; bytes: number; version: number }> = [];
  let downloaded = 0;
  let skipped = 0;

  for (const f of picked) {
    const dest = path.join(outDir, localName(f.file_name));
    if (!force && (await exists(dest))) {
      skipped++;
      manifest.push({
        file_name: f.file_name,
        local_path: path.relative(OUT_ROOT, dest).replace(/\\/g, "/"),
        bytes: (await stat(dest)).size,
        version: f.version,
      });
      continue;
    }
    try {
      const url = await presignedDownloadUrl(psiId, f.file_name, f.version);
      await downloadFile(url, dest);
      downloaded++;
      manifest.push({
        file_name: f.file_name,
        local_path: path.relative(OUT_ROOT, dest).replace(/\\/g, "/"),
        bytes: (await stat(dest)).size,
        version: f.version,
      });
      console.log(`  ✓ ${f.file_name} (${(f.file_size / 1024).toFixed(0)} KiB)`);
    } catch (err) {
      console.warn(`  ! ${f.file_name}: ${(err as Error).message}`);
    }
  }

  await writeFile(
    path.join(outDir, "manifest.json"),
    JSON.stringify(
      {
        psi_id: psiId,
        curated: useCurated,
        fetched_at: new Date().toISOString(),
        total_tabular_in_repo: all.length,
        after_curated_filter: filtered.length,
        downloaded_count: manifest.length,
        skipped_existing: skipped,
        max_inv_bytes: maxInvBytes,
        profile: CURATED_PROFILES[psiId] ?? null,
        files: manifest,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  console.log(
    `${psiId}: ${downloaded} novos, ${skipped} já local, ${manifest.length} arquivos (filtro ${filtered.length}/${all.length}, ≤${(maxInvBytes / 1e6).toFixed(0)} MB)`,
  );
}

function parseMaxMb(argv: string[]): number {
  const eq = argv.find((a) => a.startsWith("--max-mb="));
  if (eq) return Number(eq.split("=")[1]);
  const i = argv.indexOf("--max-mb");
  if (i >= 0 && argv[i + 1]) return Number(argv[i + 1]);
  return DEFAULT_MAX_INV_BYTES / (1024 * 1024);
}

async function main() {
  const argv = process.argv.slice(2);
  const force = argv.includes("--force");
  const allHero = argv.includes("--all-hero");
  const useCurated = !allHero;
  const maxInvBytes = parseMaxMb(argv) * 1024 * 1024;
  const ids = argv.filter((a) => /^PSI-\d+$/i.test(a)).map((a) => a.toUpperCase());
  const targets = ids.length > 0 ? ids : allHero ? [...HERO_IDS] : [...CURATED_SAMPLE_IDS];

  await mkdir(OUT_ROOT, { recursive: true });
  const failed: string[] = [];

  console.log(
    useCurated
      ? `Modo curado: ${targets.join(", ")} (máx. ${(maxInvBytes / 1e6).toFixed(0)} MB/PSI)`
      : `Modo --all-hero: ${targets.length} investigações`,
  );

  for (const psiId of targets) {
    console.log(`\n${psiId}…`);
    try {
      await processInvestigation(psiId, maxInvBytes, force, useCurated);
    } catch (err) {
      failed.push(psiId);
      console.error(`  x ${(err as Error).message}`);
    }
  }

  await writeFile(
    path.join(OUT_ROOT, "_index.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        mode: useCurated ? "curated" : "all-hero",
        max_inv_mb: maxInvBytes / (1024 * 1024),
        investigations: targets.filter((id) => !failed.includes(id)),
        failed,
        excluded_by_default: ["PSI-26", "PSI-25", "PSI-99", "PSI-100", "PSI-39 (CFI raw em massa)"],
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  console.log(`\nConcluído: ${OUT_ROOT}`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});