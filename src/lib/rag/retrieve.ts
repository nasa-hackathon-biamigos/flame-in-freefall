import type { SupabaseClient } from "@supabase/supabase-js";
import { embedTexts } from "./embed";
import { matchAliases, type ChunkMetadata, type ChunkSection, type RagIndexEntry } from "./sources";

/** Retrieval for Ask PSI (docs/SPEC.md §8.2). */

export type RetrievedChunk = {
  id: string;
  key: string;
  psi_id: string | null;
  section: ChunkSection;
  content: string;
  metadata: ChunkMetadata;
  similarity: number | null; // null = pulled in because the question named the investigation
};

export const MAX_CHUNKS = 12;
const MAX_ALIAS_CHUNKS = 8;
/** Sections pulled in when a question names an investigation (curated first, then PSI text). */
const ALIAS_SECTIONS: ChunkSection[] = [
  "summary",
  "crew_safety",
  "conditions",
  "psi_objectives",
  "psi_research_impacts",
];

type Row = {
  id: string;
  slug: string;
  psi_id: string | null;
  section: string;
  content: string;
  metadata: ChunkMetadata;
  similarity?: number;
};

function toChunk(r: Row): RetrievedChunk {
  return {
    id: r.id,
    key: r.slug,
    psi_id: r.psi_id,
    section: r.section as ChunkSection,
    content: r.content,
    metadata: r.metadata,
    similarity: r.similarity ?? null,
  };
}

export function minSimilarity(): number {
  const v = Number(process.env.RAG_MIN_SIMILARITY);
  return Number.isFinite(v) && v > 0 ? v : 0.3;
}

export async function retrieve(opts: {
  db: SupabaseClient;
  question: string;
  previousQuestion?: string;
  index: RagIndexEntry[];
}): Promise<{ chunks: RetrievedChunk[]; namedPsiIds: string[] }> {
  const { db, question, previousQuestion, index } = opts;
  // Follow-ups ("and in SAME-R?") need the previous question for context.
  const query = previousQuestion ? `${previousQuestion}\n${question}` : question;
  const namedPsiIds = matchAliases(query, index);

  const [aliasRows, vectorRows] = await Promise.all([
    namedPsiIds.length
      ? db
          .from("rag_chunks")
          .select("id, slug, psi_id, section, content, metadata")
          .in("psi_id", namedPsiIds)
          .in("section", ALIAS_SECTIONS)
          .then(({ data, error }) => {
            if (error) throw new Error(`alias lookup: ${error.message}`);
            return (data ?? []) as Row[];
          })
      : Promise.resolve([] as Row[]),
    embedTexts([query]).then(([embedding]) =>
      db
        .rpc("match_rag_chunks", {
          query_embedding: embedding,
          match_count: MAX_CHUNKS,
          min_similarity: minSimilarity(),
        })
        .then(({ data, error }) => {
          if (error) throw new Error(`vector search: ${error.message}`);
          return (data ?? []) as Row[];
        }),
    ),
  ]);

  // Named investigations first (in section priority, at most MAX_ALIAS_CHUNKS), then vector hits.
  const rank = (s: string) => ALIAS_SECTIONS.indexOf(s as ChunkSection);
  const forced = aliasRows
    .sort(
      (a, b) =>
        namedPsiIds.indexOf(a.psi_id ?? "") - namedPsiIds.indexOf(b.psi_id ?? "") ||
        rank(a.section) - rank(b.section),
    )
    .slice(0, MAX_ALIAS_CHUNKS);
  const seen = new Set<string>();
  const merged: RetrievedChunk[] = [];
  for (const r of [...forced, ...vectorRows]) {
    if (seen.has(r.id) || merged.length >= MAX_CHUNKS) continue;
    seen.add(r.id);
    merged.push(toChunk(r));
  }
  // Group by investigation so related passages sit together in the prompt.
  const order = new Map<string, number>();
  merged.forEach((c) => order.has(c.key) || order.set(c.key, order.size));
  merged.sort((a, b) => order.get(a.key)! - order.get(b.key)!);
  return { chunks: merged, namedPsiIds };
}
