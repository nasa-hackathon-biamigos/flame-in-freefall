import Anthropic from "@anthropic-ai/sdk";
import { sourceKey } from "./citations";
import { SYSTEM_PROMPT } from "./prompt";
import type { RetrievedChunk } from "./retrieve";

/** Claude call for Ask PSI (docs/SPEC.md §8.3). */

type BetaMessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type BetaSearchResultBlockParam = Anthropic.Beta.Messages.BetaSearchResultBlockParam;

/**
 * The team runs Claude through OpenRouter's Anthropic-compatible Messages endpoint (decided
 * 2026-11-14). Detected from an OpenRouter key (sk-or-...) or an openrouter.ai ANTHROPIC_BASE_URL.
 * Verified there: search_result citations, adaptive thinking, effort, prompt caching, streaming.
 * Not available there: the server-side refusal fallback (a refusal shows the refusal message).
 */
export function viaOpenRouter(): boolean {
  return (
    (process.env.ANTHROPIC_API_KEY ?? "").startsWith("sk-or-") ||
    (process.env.ANTHROPIC_BASE_URL ?? "").includes("openrouter.ai")
  );
}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  client ??= viaOpenRouter()
    ? new Anthropic({
        baseURL: process.env.ANTHROPIC_BASE_URL || "https://openrouter.ai/api",
        authToken: process.env.ANTHROPIC_API_KEY ?? null, // OpenRouter wants a Bearer token
        apiKey: null,
      })
    : new Anthropic(); // reads ANTHROPIC_API_KEY
  return client;
}

/** "claude-opus-5-5" → "anthropic/claude-opus-5.5" (OpenRouter ids); ids with a "/" pass through. */
export function toOpenRouterModel(id: string): string {
  return id.includes("/") ? id : `anthropic/${id.replace(/-(\d+)-(\d+)$/, "-$1.$2")}`;
}

export function claudeModel(): string {
  const id = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
  return viaOpenRouter() ? toOpenRouterModel(id) : id;
}

const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
type Effort = (typeof EFFORTS)[number];
function effort(): Effort {
  const v = process.env.ANTHROPIC_EFFORT as Effort | undefined;
  return v && EFFORTS.includes(v) ? v : "low";
}

/**
 * One search_result per chunk. Paragraphs become separate text blocks so citations point at the
 * paragraph that supports a claim, not the whole chunk.
 */
export function toSearchResult(chunk: RetrievedChunk): BetaSearchResultBlockParam {
  const paragraphs = chunk.content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    type: "search_result",
    source: sourceKey(chunk.id),
    title: chunk.metadata.title,
    content: (paragraphs.length ? paragraphs : [chunk.content]).map((text) => ({ type: "text", text })),
    citations: { enabled: true },
  };
}

/** The new user turn: retrieved passages first, then the question. */
export function userTurn(question: string, chunks: RetrievedChunk[]): BetaMessageParam {
  return { role: "user", content: [...chunks.map(toSearchResult), { type: "text", text: question }] };
}

export function streamAnswer(messages: BetaMessageParam[]) {
  // On the Anthropic API, a safety-classifier refusal is re-run on a fallback model.
  // OpenRouter rejects the `fallbacks` parameter, so it is only sent direct.
  const fallback = viaOpenRouter()
    ? {}
    : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
  return anthropic().beta.messages.stream({
    ...fallback,
    model: claudeModel(),
    max_tokens: 16000, // thinking counts toward this; the prompt keeps answers short
    thinking: { type: "adaptive" },
    output_config: { effort: effort() },
    // Stable system prompt is the cached prefix; top-level auto-caching extends the cache over
    // the append-only history between turns.
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    cache_control: { type: "ephemeral" },
    messages,
  });
}

export { Anthropic };
