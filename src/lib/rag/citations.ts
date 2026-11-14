import type { AskEvent, SourceCard } from "./events";
import type { RetrievedChunk } from "./retrieve";

/**
 * Turns Claude's search-result citations into numbered source cards and [n] markers (SPEC §8.5).
 *
 * - Each chunk is sent with source = "sf:<chunk id>", so a citation resolves by its `source`
 *   field — `search_result_index` counts results across the whole conversation and would point
 *   at the wrong chunk on follow-up turns.
 * - Markers are placed at the end of the answer line that best matches the cited text. The
 *   Anthropic API splits answers into one text block per cited span (so this is simply the
 *   block's end), but OpenRouter merges the answer into a single block with every citation on
 *   it; matching lines keeps markers next to the claims they support there too.
 */
export const sourceKey = (chunkId: string) => `sf:${chunkId}`;

type Pending = { n: number; cited_text: string };

const words = (s: string) => new Set(s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);

/**
 * Terms that survive translation (the answer may be in Portuguese, the sources are in English):
 * numbers and capitalized names/acronyms such as "SIBAL", "PMMA", "Nomex", "30".
 */
const distinctive = (s: string) =>
  new Set((s.match(/\p{N}[\p{N}.,]*|\p{Lu}[\p{L}\p{N}-]{2,}/gu) ?? []).map((t) => t.toLowerCase()));

/** Index of the line that draws most on `cited`, or -1 when none clearly does. */
export function bestLine(lines: string[], cited: string): number {
  // 1) Same-language match: at least half of the line's words come from the cited text.
  const c = words(cited);
  let best = -1;
  let bestScore = 0.5;
  lines.forEach((line, i) => {
    const l = words(line);
    if (l.size < 4) return;
    let shared = 0;
    for (const w of l) if (c.has(w)) shared++;
    const score = shared / l.size;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  if (best >= 0) return best;

  // 2) Cross-language match: the single line sharing the most distinctive terms (at least 2).
  const cd = distinctive(cited);
  const counts = lines.map((line) => [...distinctive(line)].filter((t) => cd.has(t)).length);
  const max = Math.max(0, ...counts);
  if (max < 2 || counts.filter((n) => n === max).length > 1) return -1;
  return counts.indexOf(max);
}

/** Last characters of a line, used by the UI to find where to insert a marker. */
const tail = (line: string) => line.trimEnd().slice(-48);

export class CitationTracker {
  private readonly nByChunk = new Map<string, number>();
  private readonly pending = new Map<number, Pending[]>();
  readonly sources: SourceCard[] = [];

  constructor(private readonly chunks: Map<string, RetrievedChunk>) {}

  /** A citation arrived on content block `blockIndex`. Returns a `source` event the first time a chunk is cited. */
  cite(blockIndex: number, citation: { source?: string | null; cited_text: string }): AskEvent[] {
    const chunk = citation.source ? this.chunks.get(citation.source) : undefined;
    if (!chunk) return [];
    const events: AskEvent[] = [];
    let n = this.nByChunk.get(chunk.id);
    if (n === undefined) {
      n = this.sources.length + 1;
      this.nByChunk.set(chunk.id, n);
      const source: SourceCard = {
        n,
        title: chunk.metadata.title,
        experiment: chunk.metadata.experiment,
        psi_id: chunk.psi_id,
        section: chunk.section,
        curation: chunk.metadata.curation,
        cited_text: citation.cited_text,
        url: chunk.metadata.url,
        psi_url: chunk.metadata.psi_url,
      };
      this.sources.push(source);
      events.push({ type: "source", source });
    }
    const list = this.pending.get(blockIndex) ?? [];
    list.push({ n, cited_text: citation.cited_text });
    this.pending.set(blockIndex, list);
    return events;
  }

  /**
   * Content block `blockIndex` finished with text `blockText`: emit its markers. Each marker goes
   * after the line it best matches (`after`), or at the end of the block when no line matches.
   */
  close(blockIndex: number, blockText: string): AskEvent[] {
    const pending = this.pending.get(blockIndex);
    this.pending.delete(blockIndex);
    if (!pending?.length) return [];

    const lines = blockText.split("\n");
    const byLine = new Map<number, number[]>();
    for (const p of pending) {
      const i = lines.length > 1 ? bestLine(lines, p.cited_text) : -1;
      const ns = byLine.get(i) ?? [];
      if (!ns.includes(p.n)) ns.push(p.n);
      byLine.set(i, ns);
    }
    const events: AskEvent[] = [];
    for (const [i, ns] of [...byLine].sort((a, b) => a[0] - b[0])) {
      if (i >= 0 && tail(lines[i])) events.push({ type: "cite", ns, after: tail(lines[i]) });
    }
    const atEnd = byLine.get(-1);
    if (atEnd?.length) events.push({ type: "cite", ns: atEnd });
    return events;
  }

  /** PSI-IDs (or keys) of everything cited, for the anonymous log. */
  citedIds(): string[] {
    return [...new Set(this.sources.map((s) => s.psi_id ?? s.experiment))];
  }
}

/**
 * Applies a `cite` event to the answer text: inserts the markdown markers after the last
 * occurrence of `after` (the line is in the block that just closed), or appends them.
 * Shared by the chat UI.
 */
export function insertMarkers(text: string, markers: string, after?: string): string {
  if (after) {
    const at = text.lastIndexOf(after);
    if (at >= 0) {
      const end = at + after.length;
      return text.slice(0, end) + markers + text.slice(end);
    }
  }
  return text + markers;
}
