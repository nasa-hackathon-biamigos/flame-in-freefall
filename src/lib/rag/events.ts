import type { ChunkSection, CurationLevel } from "./sources";

/** Server-sent events of POST /api/ask (docs/SPEC.md §9). Shared by the route and the chat UI. */

export const MAX_TURNS = 6;

export type SourceCard = {
  n: number;
  title: string;
  experiment: string;
  psi_id: string | null;
  section: ChunkSection;
  curation: CurationLevel;
  cited_text: string;
  /** In-app link (ficha section) when published, else the PSI page. */
  url: string;
  psi_url: string | null;
};

export type AskErrorCode =
  | "bad_request"
  | "forbidden"
  | "rate_limited"
  | "daily_cap"
  | "conversation_limit"
  | "conversation_expired"
  | "refusal"
  | "unavailable";

export type AskEvent =
  | { type: "meta"; conversation_id: string; turn: number; max_turns: number; cached: boolean }
  | { type: "text"; text: string }
  | { type: "cite"; ns: number[] }
  | { type: "source"; source: SourceCard }
  | { type: "done"; turns_left: number }
  | { type: "error"; code: AskErrorCode };

export function encodeEvent(e: AskEvent): string {
  return `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`;
}

/** Parses an SSE byte stream (as produced by encodeEvent) into events. */
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<AskEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const data = frame
        .split("\n")
        .filter((l) => l.startsWith("data: "))
        .map((l) => l.slice(6))
        .join("\n");
      if (data) yield JSON.parse(data) as AskEvent;
    }
  }
}
