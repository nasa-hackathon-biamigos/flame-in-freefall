import { createHash } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AskEvent } from "./events";

/** Supabase persistence for Ask PSI: conversations, turns, answer cache, rate limits (SPEC §8.4–8.6). */

type MessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type ContentBlock = Anthropic.Beta.Messages.BetaContentBlock;

export const CONVERSATION_TTL_MS = 24 * 60 * 60 * 1000;

export type StoredTurn = {
  turn_index: number;
  question: string;
  request_messages: MessageParam[] | null;
  response_content: ContentBlock[] | null;
};

export type TurnLog = {
  conversation_id: string;
  turn_index: number;
  question: string;
  request_messages: MessageParam[] | null;
  response_content: ContentBlock[] | null;
  cited_slugs: string[];
  model: string | null;
  prompt_version: string;
  catalog_version: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  latency_ms: number;
  cache_hit: boolean;
  error: string | null;
};

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function loadConversation(
  db: SupabaseClient,
  id: string,
): Promise<{ status: "ok"; turns: StoredTurn[] } | { status: "missing" | "expired" }> {
  const { data: conv, error } = await db
    .from("chat_conversations")
    .select("created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`loading conversation: ${error.message}`);
  if (!conv) return { status: "missing" };
  if (Date.now() - new Date(conv.created_at as string).getTime() > CONVERSATION_TTL_MS)
    return { status: "expired" };
  const { data: turns, error: turnsErr } = await db
    .from("chat_turns")
    .select("turn_index, question, request_messages, response_content")
    .eq("conversation_id", id)
    .order("turn_index");
  if (turnsErr) throw new Error(`loading turns: ${turnsErr.message}`);
  return { status: "ok", turns: (turns ?? []) as StoredTurn[] };
}

export async function createConversation(db: SupabaseClient, id: string, locale: string): Promise<void> {
  const { error } = await db.from("chat_conversations").insert({ id, locale });
  if (error) throw new Error(`creating conversation: ${error.message}`);
}

/**
 * Rebuilds the message history (append-only, SPEC §8.4). Turns without a model answer
 * (no evidence, refusal, error) are skipped: only what the model actually saw goes back.
 *
 * `textOnly`: send earlier answers as plain text. Needed through OpenRouter, where replayed
 * thinking blocks make the model stop citing on follow-up turns (measured 2026-11-14:
 * 0 citations with thinking blocks replayed, 8 without). Direct to the Anthropic API the exact
 * content goes back unchanged, as preserved thinking requires.
 */
export function historyFrom(turns: StoredTurn[], opts: { textOnly?: boolean } = {}): MessageParam[] {
  const messages: MessageParam[] = [];
  for (const t of turns) {
    if (!t.request_messages || !t.response_content) continue;
    const content = opts.textOnly
      ? t.response_content.flatMap((b) =>
          b.type === "text" ? [{ type: "text" as const, text: b.text }] : [],
        )
      : t.response_content;
    if (content.length === 0) continue;
    messages.push(...t.request_messages, { role: "assistant", content });
  }
  return messages;
}

export async function logTurn(db: SupabaseClient, turn: TurnLog): Promise<void> {
  const { error } = await db.from("chat_turns").insert(turn);
  if (error) console.error(`chat_turns insert failed: ${error.message}`);
}

// --- answer cache (first turn only) ---

export type CachedAnswer = {
  events: AskEvent[];
  request_messages: MessageParam[];
  response_content: ContentBlock[];
  cited: string[];
  model: string;
};

export function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .replace(/[\s?!.]+$/, "")
    .trim();
}

export function cacheKey(parts: {
  question: string;
  locale: string;
  catalogVersion: string;
  promptVersion: string;
  model: string;
}) {
  return sha256(
    [
      normalizeQuestion(parts.question),
      parts.locale,
      parts.catalogVersion,
      parts.promptVersion,
      parts.model,
    ].join("\0"),
  );
}

export async function readCache(db: SupabaseClient, key: string): Promise<CachedAnswer | null> {
  const { data, error } = await db.from("answer_cache").select("response").eq("key", key).maybeSingle();
  if (error) {
    console.error(`answer_cache read failed: ${error.message}`);
    return null;
  }
  return (data?.response as CachedAnswer | undefined) ?? null;
}

export async function writeCache(
  db: SupabaseClient,
  key: string,
  question: string,
  locale: string,
  answer: CachedAnswer,
) {
  const { error } = await db.from("answer_cache").upsert({ key, question, locale, response: answer });
  if (error) console.error(`answer_cache write failed: ${error.message}`);
}

// --- abuse / cost limits ---

export function ipHash(ip: string): string {
  return sha256(`${ip}\0${process.env.IP_HASH_SALT ?? ""}`);
}

function envInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isInteger(v) && v > 0 ? v : fallback;
}

/** Counts one message for this IP in the current hour. Returns false when over the limit. */
export async function takeRateLimit(
  db: SupabaseClient,
  ip: string,
): Promise<{ ok: true } | { ok: false; reason: "rate_limited" | "daily_cap" }> {
  const limit = envInt("RATE_LIMIT_PER_HOUR", 30);
  const dailyCap = envInt("DAILY_MESSAGE_CAP", 1500);
  const now = new Date();
  const window = new Date(now);
  window.setUTCMinutes(0, 0, 0);
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);

  const { count: today, error: capErr } = await db
    .from("chat_turns")
    .select("id", { count: "exact", head: true })
    .eq("cache_hit", false)
    .gte("created_at", dayStart.toISOString());
  if (capErr) throw new Error(`daily cap: ${capErr.message}`);
  if ((today ?? 0) >= dailyCap) return { ok: false, reason: "daily_cap" };

  const hash = ipHash(ip);
  const { data: row, error } = await db
    .from("rate_limits")
    .select("count")
    .eq("ip_hash", hash)
    .eq("window_start", window.toISOString())
    .maybeSingle();
  if (error) throw new Error(`rate limit: ${error.message}`);
  const used = (row?.count as number | undefined) ?? 0;
  if (used >= limit) return { ok: false, reason: "rate_limited" };
  const { error: upErr } = await db
    .from("rate_limits")
    .upsert({ ip_hash: hash, window_start: window.toISOString(), count: used + 1 });
  if (upErr) throw new Error(`rate limit update: ${upErr.message}`);
  return { ok: true };
}
