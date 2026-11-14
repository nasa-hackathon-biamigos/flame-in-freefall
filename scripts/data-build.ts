/**
 * Validates data/** and writes the catalog (docs/SPEC.md §6.9).
 *
 *   pnpm data:build               # examples included (dev / previews)
 *   pnpm data:build --production  # examples excluded (also when VERCEL_ENV=production)
 *
 * Outputs: src/generated/catalog.json, public/downloads/space-firefighters-catalog.{json,csv}.
 * Exits 1 on any error. Messages are in Portuguese: the curation team reads them on their PRs.
 */
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildCatalog } from "../src/lib/catalog/build";
import { toExportCsv, toExportJson } from "../src/lib/catalog/export";
import type { Problem } from "../src/lib/catalog/issues";

const root = process.cwd();
const production = process.argv.includes("--production") || process.env.VERCEL_ENV === "production";
const inGithub = process.env.GITHUB_ACTIONS === "true";

function line(p: Problem): string {
  return `${p.file}${p.field ? ` → ${p.field}` : ""}: ${p.message}`;
}

/** GitHub annotations show up on the PR's changed files, where curators edit. */
function annotate(kind: "error" | "warning", p: Problem) {
  const esc = (s: string) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  console.log(`::${kind} file=${p.file},title=${esc(p.field ?? "ficha")}::${esc(p.message)}`);
}

async function main() {
  const result = await buildCatalog(path.join(root, "data"), { includeExamples: !production });
  const { catalog, errors, warnings, stats } = result;

  for (const w of warnings) {
    if (inGithub) annotate("warning", w);
    else console.warn(`  aviso  ${line(w)}`);
  }
  for (const e of errors) {
    if (inGithub) annotate("error", e);
    else console.error(`  ERRO   ${line(e)}`);
  }

  if (process.env.GITHUB_STEP_SUMMARY && (errors.length || warnings.length)) {
    const md = [
      `## data:build — ${errors.length} erro(s), ${warnings.length} aviso(s)`,
      ...errors.map((e) => `- ❌ ${line(e)}`),
      ...warnings.map((w) => `- ⚠️ ${line(w)}`),
      "",
    ].join("\n");
    await appendFile(process.env.GITHUB_STEP_SUMMARY, md);
  }

  if (errors.length > 0 || !catalog) {
    console.error(
      `\ndata:build falhou com ${errors.length} erro(s). Corrija os campos acima (modelo: data/_template.md).`,
    );
    process.exit(1);
  }

  const generated = path.join(root, "src", "generated");
  const downloads = path.join(root, "public", "downloads");
  await mkdir(generated, { recursive: true });
  await mkdir(downloads, { recursive: true });
  await writeFile(path.join(generated, "catalog.json"), JSON.stringify(catalog) + "\n");
  // Small sidecar so routes like /api/health don't bundle the whole catalog.
  await writeFile(
    path.join(generated, "catalog-meta.json"),
    JSON.stringify({ version: catalog.version, generated_at: catalog.generated_at, stats }, null, 2) + "\n",
  );
  await writeFile(
    path.join(downloads, "space-firefighters-catalog.json"),
    JSON.stringify(toExportJson(catalog), null, 2) + "\n",
  );
  await writeFile(path.join(downloads, "space-firefighters-catalog.csv"), toExportCsv(catalog));

  console.log(
    [
      `data:build ok — catalog ${catalog.version}${production ? " (production)" : " (examples included)"}`,
      `  ${stats.files} ficha file(s): ${stats.complete} complete · ${stats.partial} partial · ${stats.drafts} draft (hidden) · ${stats.examples} example`,
      `  ${stats.with_earth} with Earth applications · ${catalog.spinoffs.length} spinoff(s) · ${catalog.comparisons.length} comparison(s)`,
      `  ${catalog.reference_atmospheres.filter((z) => z.drawable).length}/${catalog.reference_atmospheres.length} reference atmosphere(s) drawable (need source_url + values)`,
      `  ${warnings.length} warning(s)`,
    ].join("\n"),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
