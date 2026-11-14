/**
 * Builds the Ask PSI index in Supabase (docs/SPEC.md §8.1).
 *
 *   pnpm rag:ingest            # embed new/changed chunks, delete orphans (costs a few cents)
 *   pnpm rag:ingest --dry-run  # show what would change, no API calls
 *
 * Idempotent: chunk id = sha256(key + section + idx); only chunks whose content_hash changed
 * are re-embedded. Uses the production catalog (no example fichas). Needs OPENAI_API_KEY,
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (loaded from .env.local).
 */
import path from "node:path";
import { buildCatalog } from "../src/lib/catalog/build";
import { embedTexts, embeddingModel } from "../src/lib/rag/embed";
import { buildChunks, buildRagIndex } from "../src/lib/rag/sources";
import { createAdminClient } from "../src/lib/supabase/admin";

process.loadEnvFile?.(".env.local");

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const result = await buildCatalog(path.join(process.cwd(), "data"), { includeExamples: false });
  if (!result.catalog || result.errors.length) {
    console.error("data:build has errors — run `pnpm data:build` and fix them first.");
    process.exit(1);
  }
  const { catalog } = result;
  const chunks = buildChunks(catalog, result.psi, buildRagIndex(catalog, result.psi));
  const db = createAdminClient();

  const { data: existing, error } = await db.from("rag_chunks").select("id, content_hash").range(0, 9999);
  if (error) throw new Error(`reading rag_chunks: ${error.message}`);
  const existingHash = new Map(existing.map((r) => [r.id as string, r.content_hash as string]));
  const wanted = new Set(chunks.map((c) => c.id));
  const changed = chunks.filter((c) => existingHash.get(c.id) !== c.content_hash);
  const orphans = [...existingHash.keys()].filter((id) => !wanted.has(id));

  const bySection = new Map<string, number>();
  for (const c of chunks) bySection.set(c.section, (bySection.get(c.section) ?? 0) + 1);
  console.log(
    `${chunks.length} chunks (${[...bySection].map(([s, n]) => `${s} ${n}`).join(", ")})\n` +
      `${changed.length} to embed, ${chunks.length - changed.length} unchanged, ${orphans.length} orphan(s) to delete`,
  );
  if (dryRun) return;

  if (changed.length) {
    console.log(`Embedding ${changed.length} chunk(s) with ${embeddingModel()}…`);
    const vectors = await embedTexts(changed.map((c) => c.embed_text));
    const rows = changed.map((c, i) => ({
      id: c.id,
      slug: c.key,
      psi_id: c.psi_id,
      section: c.section,
      content: c.content,
      metadata: c.metadata,
      embedding: vectors[i],
      content_hash: c.content_hash,
      catalog_version: catalog.version,
      updated_at: new Date().toISOString(),
    }));
    for (let i = 0; i < rows.length; i += 100) {
      const { error: upErr } = await db.from("rag_chunks").upsert(rows.slice(i, i + 100));
      if (upErr) throw new Error(`upserting chunks: ${upErr.message}`);
    }
  }
  if (orphans.length) {
    const { error: delErr } = await db.from("rag_chunks").delete().in("id", orphans);
    if (delErr) throw new Error(`deleting orphans: ${delErr.message}`);
  }
  const { error: verErr } = await db
    .from("rag_chunks")
    .update({ catalog_version: catalog.version })
    .neq("catalog_version", catalog.version);
  if (verErr) throw new Error(`updating catalog_version: ${verErr.message}`);
  console.log(`rag:ingest ok — catalog ${catalog.version}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
