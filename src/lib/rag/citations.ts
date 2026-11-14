import type { AskEvent, SourceCard } from "./events";
import type { RetrievedChunk } from "./retrieve";

/**
 * Turns Claude's search-result citations into numbered source cards (SPEC §8.5).
 * Each chunk is sent with source = "sf:<chunk id>", so a citation resolves by its `source`
 * field — `search_result_index` counts results across the whole conversation and would
 * point at the wrong chunk on follow-up turns.
 */
export const sourceKey = (chunkId: string) => `sf:${chunkId}`;

export class CitationTracker {
  private readonly nByChunk = new Map<string, number>();
  private readonly pending = new Map<number, number[]>();
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
    if (!list.includes(n)) list.push(n);
    this.pending.set(blockIndex, list);
    return events;
  }

  /** Content block finished: emit its citation markers, placed after the block's text. */
  close(blockIndex: number): AskEvent[] {
    const ns = this.pending.get(blockIndex);
    this.pending.delete(blockIndex);
    return ns?.length ? [{ type: "cite", ns }] : [];
  }

  /** PSI-IDs (or keys) of everything cited, for the anonymous log. */
  citedIds(): string[] {
    return [...new Set(this.sources.map((s) => s.psi_id ?? s.experiment))];
  }
}
