import OpenAI from "openai";

/** OpenAI is used only for embeddings (docs/SPEC.md §4). Claude answers live in claude.ts. */

export const EMBEDDING_DIMENSIONS = 1536;

let client: OpenAI | null = null;
function openai(): OpenAI {
  client ??= new OpenAI(); // reads OPENAI_API_KEY
  return client;
}

export function embeddingModel(): string {
  return process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
}

/** Embeds texts in order, in batches of 96. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 96) {
    const res = await openai().embeddings.create({ model: embeddingModel(), input: texts.slice(i, i + 96) });
    const batch = [...res.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
    for (const e of batch) {
      if (e.length !== EMBEDDING_DIMENSIONS)
        throw new Error(`embedding has ${e.length} dims, expected ${EMBEDDING_DIMENSIONS}`);
    }
    out.push(...batch);
  }
  return out;
}
