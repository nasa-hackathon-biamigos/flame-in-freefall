import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type TabularRun = {
  id: string;
  psi_id: string;
  file_name: string;
  sheet_name: string;
  kind: string;
  material: string | null;
  material_label: string | null;
  gmt: string | null;
  run_label: string | null;
  n_rows: number;
  peaks: { iss_scatter: number | null; dusttrak_a: number | null; ptrak: number | null };
  series: {
    t: (number | null)[];
    iss_scatter: (number | null)[];
    dusttrak_a: (number | null)[];
    ptrak: (number | null)[];
  };
};

export type TabularWarehouse = {
  generated_at: string;
  sqlite: string;
  n_files: number;
  n_samples: number;
  runs: TabularRun[];
  conditions: { psi_id: string; file_name: string; rows: Record<string, string>[] }[];
};

const file = path.join(process.cwd(), "data", "local", "runs.json");

export function loadTabular(): TabularWarehouse | null {
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as TabularWarehouse;
}
