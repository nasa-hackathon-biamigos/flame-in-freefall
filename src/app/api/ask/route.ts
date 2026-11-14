import { randomUUID } from "node:crypto";
import { z } from "zod";
import catalogMeta from "@/generated/catalog-meta.json";
import ragIndex from "@/generated/rag-index.json";
import { CitationTracker, sourceKey } from "@/lib/rag/citations";
import { Anthropic, claudeModel, streamAnswer, userTurn, viaOpenRouter } from "@/lib/rag/claude";
import { encodeEvent, MAX_TURNS, type AskErrorCode, type AskEvent } from "@/lib/rag/events";
import { NO_EVIDENCE_MESSAGE, PROMPT_VERSION } from "@/lib/rag/prompt";
import { retrieve } from "@/lib/rag/retrieve";
import type { RagIndexEntry } from "@/lib/rag/sources";
import {
  cacheKey,
  createConversation,
  historyFrom,
  loadConversation,
  logTurn,
  readCache,
  takeRateLimit,
  writeCache,
  type StoredTurn,
} from "@/lib/rag/store";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  conversation_id: z.uuid().optional(),
  question: z.string().trim().min(3).max(1000),
  locale: z.enum(["en", "pt-BR"]).default("en"),
});

const STATUS: Record<AskErrorCode, number> = {
  bad_request: 400,
  forbidden: 403,
  rate_limited: 429,
  daily_cap: 429,
  conversation_limit: 409,
  conversation_expired: 410,
  refusal: 200,
  unavailable: 503,
};

function errorResponse(code: AskErrorCode): Response {
  return Response.json({ error: { code, message_key: `ask.errors.${code}` } }, { status: STATUS[code] });
}

/** Only the site itself may call this endpoint (SPEC §9). */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return errorResponse("forbidden");
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("bad_request");
  const { question, locale } = parsed.data;
  const started = Date.now();
  const db = supabaseAdmin();

  // Conversation: the server owns the history (the client sends only the id + new question).
  let conversationId = parsed.data.conversation_id;
  let turns: StoredTurn[] = [];
  try {
    if (conversationId) {
      const conv = await loadConversation(db, conversationId);
      if (conv.status === "expired") return errorResponse("conversation_expired");
      if (conv.status === "ok") turns = conv.turns;
      else conversationId = undefined; // unknown id: start a new conversation
    }
    if (turns.length >= MAX_TURNS) return errorResponse("conversation_limit");
  } catch (err) {
    console.error(err);
    return errorResponse("unavailable");
  }

  const turnIndex = turns.length;
  const isFirstTurn = turnIndex === 0;
  const model = claudeModel();
  const key = cacheKey({
    question,
    locale,
    catalogVersion: catalogMeta.version,
    promptVersion: PROMPT_VERSION,
    model,
  });
  const cached = isFirstTurn ? await readCache(db, key) : null;

  // Cached demo answers keep working even when the rate limit is hit (SPEC §8.6).
  if (!cached) {
    try {
      const limit = await takeRateLimit(db, clientIp(request));
      if (!limit.ok) return errorResponse(limit.reason);
    } catch (err) {
      console.error(err);
      return errorResponse("unavailable");
    }
  }

  const id = conversationId ?? randomUUID();
  if (!conversationId) {
    try {
      await createConversation(db, id, locale);
    } catch (err) {
      console.error(err);
      return errorResponse("unavailable");
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: AskEvent) => controller.enqueue(encoder.encode(encodeEvent(e)));
      const base = {
        conversation_id: id,
        turn_index: turnIndex,
        question,
        prompt_version: PROMPT_VERSION,
        catalog_version: catalogMeta.version,
      };
      send({
        type: "meta",
        conversation_id: id,
        turn: turnIndex + 1,
        max_turns: MAX_TURNS,
        cached: Boolean(cached),
      });

      // 1) Cache hit: replay the stored answer with a light streaming effect.
      if (cached) {
        for (const e of cached.events) {
          if (e.type === "text") {
            for (const piece of e.text.match(/[\s\S]{1,24}/g) ?? []) {
              send({ type: "text", text: piece });
              await new Promise((r) => setTimeout(r, 12));
            }
          } else send(e);
        }
        send({ type: "done", turns_left: MAX_TURNS - turnIndex - 1 });
        controller.close();
        await logTurn(db, {
          ...base,
          request_messages: cached.request_messages,
          response_content: cached.response_content,
          cited_slugs: cached.cited,
          model: cached.model,
          input_tokens: null,
          output_tokens: null,
          cache_read_tokens: null,
          latency_ms: Date.now() - started,
          cache_hit: true,
          error: null,
        });
        return;
      }

      let error: string | null = null;
      try {
        // 2) Retrieval. No evidence → fixed answer, no Claude call.
        const previousQuestion = turns.at(-1)?.question;
        const { chunks } = await retrieve({
          db,
          question,
          previousQuestion,
          index: ragIndex as RagIndexEntry[],
        });
        if (chunks.length === 0) {
          send({ type: "text", text: NO_EVIDENCE_MESSAGE[locale] });
          send({ type: "done", turns_left: MAX_TURNS - turnIndex - 1 });
          controller.close();
          await logTurn(db, {
            ...base,
            request_messages: null,
            response_content: null,
            cited_slugs: [],
            model: null,
            input_tokens: null,
            output_tokens: null,
            cache_read_tokens: null,
            latency_ms: Date.now() - started,
            cache_hit: false,
            error: "no_evidence",
          });
          return;
        }

        // 3) Claude, streamed, with native citations.
        const newTurn = userTurn(question, chunks);
        const tracker = new CitationTracker(new Map(chunks.map((c) => [sourceKey(c.id), c])));
        const replay: AskEvent[] = [];
        const emit = (e: AskEvent) => {
          send(e);
          replay.push(e);
        };
        const textBlocks = new Map<number, string>(); // block index → text so far
        const answer = streamAnswer([...historyFrom(turns, { textOnly: viaOpenRouter() }), newTurn]);
        for await (const event of answer) {
          if (event.type === "content_block_start" && event.content_block.type === "text")
            textBlocks.set(event.index, "");
          else if (event.type === "content_block_delta" && textBlocks.has(event.index)) {
            if (event.delta.type === "text_delta") {
              textBlocks.set(event.index, textBlocks.get(event.index) + event.delta.text);
              emit({ type: "text", text: event.delta.text });
            } else if (
              event.delta.type === "citations_delta" &&
              event.delta.citation.type === "search_result_location"
            ) {
              tracker.cite(event.index, event.delta.citation).forEach(emit);
            }
          } else if (event.type === "content_block_stop" && textBlocks.has(event.index)) {
            tracker.close(event.index, textBlocks.get(event.index) ?? "").forEach(emit);
          }
        }
        const final = await answer.finalMessage();

        if (final.stop_reason === "refusal") {
          error = "refusal";
          send({ type: "error", code: "refusal" });
        } else {
          send({ type: "done", turns_left: MAX_TURNS - turnIndex - 1 });
        }
        controller.close();

        const ok = final.stop_reason !== "refusal";
        await logTurn(db, {
          ...base,
          request_messages: ok ? [newTurn] : null,
          response_content: ok ? final.content : null,
          cited_slugs: tracker.citedIds(),
          model: final.model,
          input_tokens: final.usage.input_tokens,
          output_tokens: final.usage.output_tokens,
          cache_read_tokens: final.usage.cache_read_input_tokens ?? null,
          latency_ms: Date.now() - started,
          cache_hit: false,
          error,
        });
        if (ok && isFirstTurn && final.stop_reason === "end_turn") {
          await writeCache(db, key, question, locale, {
            events: replay,
            request_messages: [newTurn],
            response_content: final.content,
            cited: tracker.citedIds(),
            model: final.model,
          });
        }
      } catch (err) {
        console.error(err);
        error = err instanceof Anthropic.APIError ? `anthropic ${err.status}` : (err as Error).message;
        try {
          send({ type: "error", code: "unavailable" });
          controller.close();
        } catch {
          // stream already closed
        }
        await logTurn(db, {
          ...base,
          request_messages: null,
          response_content: null,
          cited_slugs: [],
          model,
          input_tokens: null,
          output_tokens: null,
          cache_read_tokens: null,
          latency_ms: Date.now() - started,
          cache_hit: false,
          error,
        });
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
