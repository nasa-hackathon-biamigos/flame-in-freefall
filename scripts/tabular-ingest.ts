/**
 * Turns downloaded PSI spreadsheets into a queryable warehouse.
 *
 *   npm run data:ingest-tabular                 # PSI-102 → data/local/psi-tabular.sqlite
 *   npm run data:ingest-tabular -- --psi PSI-102,PSI-101
 *   npm run data:ingest-tabular -- --supabase   # also upsert to the cloud (needs .env.local)
 *
 * Science sheets only ("for average" / detector traces). Housekeeping (~100 cols) is skipped.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import * as XLSX from "xlsx";
import { parseCsv } from "../src/lib/csv";
import {
  downsample,
  isDetectorSheet,
  peak,
  preferredSheets,
  parseFileMeta,
  rowsToSamples,
  skipWorkbook,
  type DetectorSample,
  type MaterialId,
  MATERIAL_LABELS,
} from "../src/lib/tabular/parse";

if (existsSync(".env")) process.loadEnvFile(".env");
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const root = process.cwd();
const TABULAR = path.join(root, "data", "raw", "psi-tabular");
const LOCAL_DIR = path.join(root, "data", "local");
const SQLITE = path.join(LOCAL_DIR, "psi-tabular.sqlite");
const RUNS_JSON = path.join(LOCAL_DIR, "runs.json");
const MAX_FILE_BYTES = 20 * 1024 * 1024;

type FileRow = {
  id: string;
  psi_id: string;
  file_name: string;
  sheet_name: string;
  kind: "detector_series" | "experimental_table";
  material: MaterialId | null;
  gmt: string | null;
  run_label: string | null;
  n_rows: number;
  columns: string[];
  source_path: string;
  content_hash: string;
};

type RunSidecar = FileRow & {
  material_label: string | null;
  peaks: { iss_scatter: number | null; dusttrak_a: number | null; ptrak: number | null };
  series: {
    t: (number | null)[];
    iss_scatter: (number | null)[];
    dusttrak_a: (number | null)[];
    ptrak: (number | null)[];
  };
};

function sha(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

function argList(flag: string, fallback: string[]): string[] {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]!.split(",").map((s) => s.trim()).filter(Boolean);
  return fallback;
}

function sheetToAoa(wb: XLSX.WorkBook, name: string): unknown[][] {
  const sheet = wb.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null }) as unknown[][];
}

function openWorkbook(file: string, names?: string[]): XLSX.WorkBook {
  return names?.length
    ? XLSX.readFile(file, { sheets: names, cellDates: false })
    : XLSX.readFile(file, { bookSheets: true });
}

function parseDetectorWorkbook(psiId: string, abs: string): { file: FileRow; samples: DetectorSample[] }[] {
  const fileName = path.basename(abs);
  if (skipWorkbook(fileName)) return [];
  const st = statSync(abs).size;
  if (st > MAX_FILE_BYTES) {
    console.warn(`  skip ${fileName} (${(st / 1e6).toFixed(1)} MB)`);
    return [];
  }
  const names = openWorkbook(abs).SheetNames;
  const want = preferredSheets(names);
  if (!want.length) return [];
  const wb = openWorkbook(abs, want);
  const meta = parseFileMeta(fileName);
  const out: { file: FileRow; samples: DetectorSample[] }[] = [];
  for (const sheetName of want) {
    const aoa = sheetToAoa(wb, sheetName);
    if (aoa.length < 3) continue;
    const headers = (aoa[0] ?? []).map((h) => String(h ?? ""));
    if (!isDetectorSheet(headers, headers.length)) continue;
    const samples = rowsToSamples(headers, aoa.slice(1));
    if (samples.length < 10) continue;
    const id = sha(`${psiId}\0${fileName}\0${sheetName}`);
    out.push({
      file: {
        id,
        psi_id: psiId,
        file_name: fileName,
        sheet_name: sheetName,
        kind: "detector_series",
        material: meta.material,
        gmt: meta.gmt,
        run_label: meta.run_label,
        n_rows: samples.length,
        columns: headers.filter(Boolean),
        source_path: path.relative(root, abs).replaceAll("\\", "/"),
        content_hash: sha(`${id}\0${samples.length}`),
      },
      samples,
    });
  }
  return out;
}

function experimentalTables(): { file: FileRow; rows: Record<string, string>[] }[] {
  const dir = path.join(root, "data", "raw", "psi");
  if (!existsSync(dir)) return [];
  const out: { file: FileRow; rows: Record<string, string>[] }[] = [];
  for (const name of readdirSync(dir).filter((f) => /^PSI-\d+\.json$/.test(f))) {
    const raw = JSON.parse(readFileSync(path.join(dir, name), "utf8")) as {
      psi_id: string;
      experimental_tables?: { file_name: string; csv: string }[];
    };
    for (const table of raw.experimental_tables ?? []) {
      const grid = parseCsv(table.csv);
      if (grid.length < 2) continue;
      const headers = grid[0]!;
      const rows = grid.slice(1).map((r) => {
        const o: Record<string, string> = {};
        headers.forEach((h, i) => {
          if (h) o[h] = r[i] ?? "";
        });
        return o;
      });
      const id = sha(`${raw.psi_id}\0${table.file_name}\0experimental`);
      out.push({
        file: {
          id,
          psi_id: raw.psi_id,
          file_name: table.file_name,
          sheet_name: "experimental_table",
          kind: "experimental_table",
          material: null,
          gmt: null,
          run_label: null,
          n_rows: rows.length,
          columns: headers,
          source_path: `data/raw/psi/${name}`,
          content_hash: sha(table.csv),
        },
        rows,
      });
    }
  }
  return out;
}

function sqliteSchema(db: DatabaseSync) {
  db.exec(`
    drop table if exists psi_detector_samples;
    drop table if exists psi_table_rows;
    drop table if exists psi_tabular_files;
    create table psi_tabular_files (
      id text primary key,
      psi_id text not null,
      file_name text not null,
      sheet_name text not null,
      kind text not null,
      material text,
      gmt text,
      run_label text,
      n_rows int not null,
      columns_json text not null,
      source_path text not null,
      content_hash text not null
    );
    create table psi_detector_samples (
      id integer primary key autoincrement,
      file_id text not null,
      psi_id text not null,
      material text,
      t_index int not null,
      time_string text,
      elapsed_s real,
      iss_obscuration_v real,
      iss_scatter_v real,
      sts_v real,
      ion_a_v real,
      ion_b_v real,
      ptrak_pt_per_cc real,
      dusttrak_a_mg_m3 real,
      dusttrak_b_mg_m3 real
    );
    create index psi_det_file on psi_detector_samples (file_id);
    create table psi_table_rows (
      id integer primary key autoincrement,
      file_id text not null,
      psi_id text not null,
      row_index int not null,
      data_json text not null
    );
  `);
}

function sidecar(file: FileRow, samples: DetectorSample[]): RunSidecar {
  const thin = downsample(samples, 400);
  return {
    ...file,
    material_label: file.material ? MATERIAL_LABELS[file.material]["pt-BR"] : null,
    peaks: {
      iss_scatter: peak(samples.map((s) => s.iss_scatter_v)),
      dusttrak_a: peak(samples.map((s) => s.dusttrak_a_mg_m3)),
      ptrak: peak(samples.map((s) => s.ptrak_pt_per_cc)),
    },
    series: {
      t: thin.map((s) => s.elapsed_s ?? s.t_index),
      iss_scatter: thin.map((s) => s.iss_scatter_v),
      dusttrak_a: thin.map((s) => s.dusttrak_a_mg_m3),
      ptrak: thin.map((s) => s.ptrak_pt_per_cc),
    },
  };
}

async function pushSupabase(files: FileRow[], samples: { file_id: string; psi_id: string; material: string | null; sample: DetectorSample }[], tables: { file: FileRow; rows: Record<string, string>[] }[]) {
  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const db = createAdminClient();
  const psiIds = [...new Set(files.map((f) => f.psi_id))];
  for (const psi of psiIds) {
    const { data: old, error } = await db.from("psi_tabular_files").select("id").eq("psi_id", psi);
    if (error) throw new Error(error.message);
    const ids = (old ?? []).map((r) => r.id as string);
    if (ids.length) {
      await db.from("psi_detector_samples").delete().in("file_id", ids);
      await db.from("psi_table_rows").delete().in("file_id", ids);
      await db.from("psi_tabular_files").delete().eq("psi_id", psi);
    }
  }
  for (let i = 0; i < files.length; i += 100) {
    const chunk = files.slice(i, i + 100).map((f) => ({
      id: f.id,
      psi_id: f.psi_id,
      file_name: f.file_name,
      sheet_name: f.sheet_name,
      kind: f.kind,
      material: f.material,
      gmt: f.gmt,
      run_label: f.run_label,
      n_rows: f.n_rows,
      columns: f.columns,
      source_path: f.source_path,
      content_hash: f.content_hash,
    }));
    const { error } = await db.from("psi_tabular_files").upsert(chunk);
    if (error) throw new Error(`files: ${error.message}`);
  }
  for (let i = 0; i < samples.length; i += 500) {
    const chunk = samples.slice(i, i + 500).map((s) => ({
      file_id: s.file_id,
      psi_id: s.psi_id,
      material: s.material,
      ...s.sample,
    }));
    const { error } = await db.from("psi_detector_samples").insert(chunk);
    if (error) throw new Error(`samples: ${error.message}`);
  }
  const tableRows = tables.flatMap((t) =>
    t.rows.map((data, row_index) => ({
      file_id: t.file.id,
      psi_id: t.file.psi_id,
      row_index,
      data,
    })),
  );
  for (let i = 0; i < tableRows.length; i += 500) {
    const { error } = await db.from("psi_table_rows").insert(tableRows.slice(i, i + 500));
    if (error) throw new Error(`table_rows: ${error.message}`);
  }
}

async function main() {
  const psiIds = argList("--psi", ["PSI-102"]);
  const wantSupabase = process.argv.includes("--supabase");
  mkdirSync(LOCAL_DIR, { recursive: true });

  const files: FileRow[] = [];
  const sampleRows: { file_id: string; psi_id: string; material: string | null; sample: DetectorSample }[] = [];
  const sidecars: RunSidecar[] = [];

  for (const psi of psiIds) {
    const dir = path.join(TABULAR, psi);
    if (!existsSync(dir)) {
      console.warn(`sem pasta ${dir}`);
      continue;
    }
    const names = readdirSync(dir).filter((f) => /\.(xlsx?|csv)$/i.test(f));
    console.log(`${psi}: ${names.length} planilha(s)`);
    for (const name of names) {
      if (/\.csv$/i.test(name)) continue;
      const parsed = parseDetectorWorkbook(psi, path.join(dir, name));
      for (const p of parsed) {
        files.push(p.file);
        sidecars.push(sidecar(p.file, p.samples));
        for (const sample of p.samples) {
          sampleRows.push({ file_id: p.file.id, psi_id: psi, material: p.file.material, sample });
        }
        console.log(`  ${name} · ${p.file.sheet_name} · ${p.samples.length} pts · ${p.file.material ?? "?"}`);
      }
    }
  }

  const tables = experimentalTables();
  for (const t of tables) files.push(t.file);

  if (existsSync(SQLITE)) {
    try {
      unlinkSync(SQLITE);
    } catch {
      /* open handles on Windows */
    }
  }
  const db = new DatabaseSync(SQLITE);
  sqliteSchema(db);
  const insFile = db.prepare(
    `insert into psi_tabular_files (id, psi_id, file_name, sheet_name, kind, material, gmt, run_label, n_rows, columns_json, source_path, content_hash)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insSample = db.prepare(
    `insert into psi_detector_samples (file_id, psi_id, material, t_index, time_string, elapsed_s, iss_obscuration_v, iss_scatter_v, sts_v, ion_a_v, ion_b_v, ptrak_pt_per_cc, dusttrak_a_mg_m3, dusttrak_b_mg_m3)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insRow = db.prepare(`insert into psi_table_rows (file_id, psi_id, row_index, data_json) values (?, ?, ?, ?)`);
  db.exec("begin");
  for (const f of files) {
    insFile.run(
      f.id,
      f.psi_id,
      f.file_name,
      f.sheet_name,
      f.kind,
      f.material,
      f.gmt,
      f.run_label,
      f.n_rows,
      JSON.stringify(f.columns),
      f.source_path,
      f.content_hash,
    );
  }
  for (const s of sampleRows) {
    const x = s.sample;
    insSample.run(
      s.file_id,
      s.psi_id,
      s.material,
      x.t_index,
      x.time_string,
      x.elapsed_s,
      x.iss_obscuration_v,
      x.iss_scatter_v,
      x.sts_v,
      x.ion_a_v,
      x.ion_b_v,
      x.ptrak_pt_per_cc,
      x.dusttrak_a_mg_m3,
      x.dusttrak_b_mg_m3,
    );
  }
  for (const t of tables) {
    t.rows.forEach((row, i) => insRow.run(t.file.id, t.file.psi_id, i, JSON.stringify(row)));
  }
  db.exec("commit");
  db.close();

  writeFileSync(
    RUNS_JSON,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        sqlite: path.relative(root, SQLITE).replaceAll("\\", "/"),
        n_files: files.length,
        n_samples: sampleRows.length,
        runs: sidecars.sort((a, b) => (a.gmt ?? "").localeCompare(b.gmt ?? "") || a.file_name.localeCompare(b.file_name)),
        conditions: tables.map((t) => ({ psi_id: t.file.psi_id, file_name: t.file.file_name, rows: t.rows })),
      },
      null,
      2,
    ) + "\n",
  );

  console.log(`sqlite ${SQLITE}\n  ${files.length} arquivos · ${sampleRows.length} amostras · ${tables.length} tabelas PSI`);

  if (wantSupabase) {
    await pushSupabase(files, sampleRows, tables);
    console.log("supabase: ok");
  } else {
    console.log("cloud: passe --supabase quando SUPABASE_URL e SERVICE_ROLE_KEY estiverem no .env.local");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
