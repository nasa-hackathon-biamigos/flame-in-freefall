import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCatalog, type Catalog, type Investigation } from "../src/lib/catalog/build";
import { bestLine, CitationTracker, insertMarkers, sourceKey } from "../src/lib/rag/citations";
import { toSearchResult, userTurn } from "../src/lib/rag/claude";
import { encodeEvent, readEvents, type AskEvent } from "../src/lib/rag/events";
import type { RetrievedChunk } from "../src/lib/rag/retrieve";
import {
  acronymVariants,
  buildChunks,
  buildRagIndex,
  loadGuideMarkdown,
  matchAliases,
  parseGuideMarkdown,
  splitText,
} from "../src/lib/rag/sources";
import { cacheKey, historyFrom, normalizeQuestion, type StoredTurn } from "../src/lib/rag/store";

const REPO_DATA = path.join(__dirname, "..", "data");

async function repo() {
  const result = await buildCatalog(REPO_DATA, { includeExamples: false });
  return { catalog: result.catalog!, psi: result.psi };
}

describe("aliases", () => {
  it("derives short names from PSI acronyms", () => {
    expect(acronymVariants("ACME CFI-G")).toEqual(["ACME CFI-G", "CFI-G"]);
    expect(acronymVariants("DAFT / DAFT-2")).toEqual(["DAFT", "DAFT-2"]);
    expect(acronymVariants("ACME E-FIELD Flames")).toContain("E-FIELD");
    expect(acronymVariants("ACME/Flame Design")).not.toContain("ACME");
  });

  it("matches acronyms without catching ordinary English words", async () => {
    const { catalog, psi } = await repo();
    const index = buildRagIndex(catalog, psi);
    expect(index).toHaveLength(psi.length);
    expect(matchAliases("What did SAME measure?", index)).toEqual(["PSI-102"]);
    expect(matchAliases("is it the same as on Earth? does the spice burn?", index)).toEqual([]);
    expect(matchAliases("compare same-r and cfi-g", index).sort()).toEqual(["PSI-101", "PSI-159"]);
    expect(matchAliases("tell me about PSI-115", index)).toEqual(["PSI-115"]);
    expect(matchAliases("SAME-R results", index)).toEqual(["PSI-101"]);
  });
});

describe("chunks", () => {
  it("splits long text at paragraphs and keeps pieces under the limit", () => {
    const text = Array.from({ length: 10 }, (_, i) => `Paragraph ${i} ${"x".repeat(300)}.`).join("\n\n");
    const pieces = splitText(text, 1000);
    expect(pieces.length).toBeGreaterThan(2);
    expect(pieces.every((p) => p.length <= 1000)).toBe(true);
    expect(pieces.join("\n\n")).toBe(text);
  });

  it("indexes the original PSI text of every investigation, with unique ids", async () => {
    const { catalog, psi } = await repo();
    const chunks = buildChunks(catalog, psi, buildRagIndex(catalog, psi));
    expect(new Set(chunks.map((c) => c.id)).size).toBe(chunks.length);
    expect(new Set(chunks.filter((c) => c.psi_id).map((c) => c.psi_id)).size).toBe(psi.length);
    const same = chunks.find((c) => c.psi_id === "PSI-102" && c.section === "psi_objectives")!;
    expect(same.metadata.curation).toBe("uncurated");
    expect(same.metadata.url).toBe(same.metadata.psi_url); // no published ficha yet → PSI page
    expect(same.embed_text.startsWith("SAME · PSI-102 · PSI objectives (original PSI text):")).toBe(true);
  });

  it("adds curated sections and in-app links once a ficha is published", async () => {
    const { catalog, psi } = await repo();
    const published = {
      slug: "same",
      psi_id: "PSI-102",
      acronym: "SAME",
      experiment_name: "Smoke and Aerosol Measurement Experiment",
      aliases: ["SAME"],
      curation_status: "partial",
      example: false,
      fire_safety_pillar: ["detection"],
      sections: {
        summary: "Measured smoke.",
        crew_safety: "- Detectors.",
        earth_impact: "",
        key_results: "",
        limitations: "",
      },
      atmosphere: {
        o2_percent: { min: null, max: null },
        pressure_psi: { min: null, max: null },
        diluents: [],
        flow_velocity_cm_s: { min: null, max: null },
        flow_notes: null,
        evidence: null,
      },
      gravity: ["0g"],
      platform: "iss",
      hardware: [],
      material_class: ["smoke_aerosol"],
      solid_form: [],
      fuels: [],
      sample_geometry: null,
      sensors: [],
      measured_variables: [],
      variables_changed: [],
      variables_fixed: [],
    } as unknown as Investigation;
    const withFicha: Catalog = { ...catalog, investigations: [published] };
    const chunks = buildChunks(withFicha, psi, buildRagIndex(withFicha, psi)).filter(
      (c) => c.psi_id === "PSI-102",
    );
    const sections = chunks.map((c) => c.section);
    expect(sections).toEqual(
      expect.arrayContaining(["summary", "crew_safety", "conditions", "psi_objectives"]),
    );
    expect(sections).not.toContain("earth_impact"); // empty sections are skipped
    expect(chunks.find((c) => c.section === "crew_safety")!.metadata.url).toBe(
      "/investigations/same#crew_safety",
    );
    expect(chunks.find((c) => c.section === "conditions")!.content).toContain("Oxygen: not reported.");
    expect(chunks.every((c) => c.metadata.curation === "partial")).toBe(true);
  });

  it("indexes paraphrased mini-book pages as guide chunks with page headings", () => {
    const md = loadGuideMarkdown(path.join(__dirname, ".."));
    const parts = parseGuideMarkdown(md);
    expect(parts.map((p) => p.heading).join(" ")).toContain("Page 35");
    expect(parts.some((p) => p.body.includes("NASA-STD-6001"))).toBe(true);
    const chunks = buildChunks(
      { investigations: [], comparisons: [], spinoffs: [] } as unknown as Catalog,
      [],
      [],
      { guideMarkdown: md },
    );
    const guides = chunks.filter((c) => c.section === "guide");
    expect(guides.length).toBe(parts.length);
    expect(guides[0]!.metadata.url).toBe("/about#mini-book");
    expect(guides.some((c) => c.content.includes("0 to 30 cm/s"))).toBe(true);
  });
});

function chunk(id: string, over: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    id,
    key: "PSI-102",
    psi_id: "PSI-102",
    section: "psi_objectives",
    content: "First paragraph.\n\nSecond paragraph.",
    metadata: {
      psi_id: "PSI-102",
      experiment: "SAME",
      title: "SAME · PSI-102 · PSI objectives (original PSI text)",
      section: "psi_objectives",
      curation: "uncurated",
      pillars: [],
      url: "https://psi.nasa.gov/x",
      psi_url: "https://psi.nasa.gov/x",
      app_slug: null,
    },
    similarity: 0.7,
    ...over,
  };
}

describe("Claude request shape", () => {
  it("sends one citable search_result per chunk, one text block per paragraph", () => {
    const sr = toSearchResult(chunk("abc"));
    expect(sr).toMatchObject({ type: "search_result", source: "sf:abc", citations: { enabled: true } });
    expect(sr.content.map((b) => b.text)).toEqual(["First paragraph.", "Second paragraph."]);
    const turn = userTurn("Q?", [chunk("a"), chunk("b")]);
    expect(Array.isArray(turn.content) && turn.content.at(-1)).toEqual({ type: "text", text: "Q?" });
  });
});

describe("CitationTracker", () => {
  it("numbers sources by first citation and places markers at block end", () => {
    const tracker = new CitationTracker(
      new Map([
        [sourceKey("a"), chunk("a")],
        [sourceKey("b"), chunk("b")],
      ]),
    );
    const first = tracker.cite(1, { source: "sf:b", cited_text: "Second paragraph." });
    expect(first).toEqual([
      { type: "source", source: expect.objectContaining({ n: 1, cited_text: "Second paragraph." }) },
    ]);
    expect(tracker.cite(1, { source: "sf:b", cited_text: "again" })).toEqual([]); // same chunk, same number
    expect(tracker.cite(1, { source: "sf:a", cited_text: "First paragraph." })).toHaveLength(1);
    expect(tracker.cite(1, { source: "sf:unknown", cited_text: "x" })).toEqual([]);
    expect(tracker.close(1, "A sentence that copies nothing")).toEqual([{ type: "cite", ns: [1, 2] }]);
    expect(tracker.close(3, "")).toEqual([]);
    expect(tracker.citedIds()).toEqual(["PSI-102"]);
  });
});

describe("marker placement (OpenRouter returns one text block)", () => {
  it("puts each marker after the line that matches its cited text", () => {
    const text = [
      "Intro line about the catalog and what it covers here.",
      "- **SAME (PSI-102):** the particulate collected on the thermophoretic probes was analyzed with TEM.",
      "- **FLEX (PSI-69):** droplet flames were extinguished with helium and carbon dioxide diluents.",
      "Closing remark.",
    ].join("\n");
    const tracker = new CitationTracker(
      new Map([
        [sourceKey("a"), chunk("a")],
        [sourceKey("b"), chunk("b")],
      ]),
    );
    tracker.cite(0, {
      source: "sf:b",
      cited_text: "FLEX studied droplet flames extinguished with helium and carbon dioxide diluents.",
    });
    tracker.cite(0, {
      source: "sf:a",
      cited_text: "The particulate collected on the thermophoretic probes was analyzed using TEM.",
    });
    tracker.cite(0, { source: "sf:a", cited_text: "Something unrelated entirely about pumps." });
    const events = tracker.close(0, text);
    expect(events).toEqual([
      { type: "cite", ns: [2], after: expect.stringContaining("analyzed with TEM.") },
      { type: "cite", ns: [1], after: expect.stringContaining("dioxide diluents.") },
      { type: "cite", ns: [2] },
    ]);
    let md = text;
    for (const e of events)
      if (e.type === "cite") md = insertMarkers(md, e.ns.map((n) => `[${n}]`).join(""), e.after);
    const lines = md.split("\n");
    expect(lines[1].endsWith("with TEM.[2]")).toBe(true);
    expect(lines[2].endsWith("diluents.[1]")).toBe(true);
    expect(md.endsWith("Closing remark.[2]")).toBe(true);
  });

  it("matches a Portuguese answer line by names and numbers", () => {
    const lines = [
      "Pelos registros, a mudança principal foi no escoamento:",
      "- **Material:** o Saffire III também usou SIBAL, tecido de algodão (75% algodão, 25% fibra de vidro).",
      "- **Escoamento:** os experimentos foram feitos a 30 cm/s, contra 20 cm/s no Saffire I.",
    ];
    const cited = "Saffire III also used SIBAL as the sample material, 75% cotton, 25% fiberglass by weight.";
    expect(bestLine(lines, cited)).toBe(1);
    expect(bestLine(lines, "Experiments were run at 30 cm/s rather than 20 cm/s as in Saffire I.")).toBe(2);
    // a tie between lines is ambiguous: leave the marker at the end
    expect(
      bestLine(["Foi o SAFFIRE com PMMA aqui.", "De novo o SAFFIRE com PMMA ali."], "SAFFIRE PMMA"),
    ).toBe(-1);
  });

  it("ignores short lines and weak matches", () => {
    expect(bestLine(["Yes.", "Totally different words in this line."], "smoke particle sizes")).toBe(-1);
  });
});

describe("SSE events", () => {
  it("round-trips events across arbitrary chunk boundaries", async () => {
    const events: AskEvent[] = [
      { type: "meta", conversation_id: "c", turn: 1, max_turns: 6, cached: false },
      { type: "text", text: 'Line one\n\nline two with "quotes"' },
      { type: "cite", ns: [1] },
      { type: "done", turns_left: 5 },
    ];
    const bytes = new TextEncoder().encode(events.map(encodeEvent).join(""));
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7));
        c.close();
      },
    });
    const out: AskEvent[] = [];
    for await (const e of readEvents(body)) out.push(e);
    expect(out).toEqual(events);
  });
});

describe("store helpers", () => {
  it("normalizes questions for the cache key", () => {
    expect(normalizeQuestion("  Which  PSI experiments?? ")).toBe("which psi experiments");
    const k = (q: string, locale = "en") =>
      cacheKey({ question: q, locale, catalogVersion: "v", promptVersion: "p", model: "m" });
    expect(k("What is SAME?")).toBe(k("what is same"));
    expect(k("What is SAME?")).not.toBe(k("What is SAME?", "pt-BR"));
  });

  it("rebuilds history from answered turns only", () => {
    const turns: StoredTurn[] = [
      {
        turn_index: 0,
        question: "a",
        request_messages: [{ role: "user", content: "a" }],
        response_content: [{ type: "text", text: "x" }] as unknown as StoredTurn["response_content"],
      },
      { turn_index: 1, question: "b", request_messages: null, response_content: null },
    ];
    expect(historyFrom(turns)).toEqual([
      { role: "user", content: "a" },
      { role: "assistant", content: [{ type: "text", text: "x" }] },
    ]);
  });

  it("can replay earlier answers as plain text (OpenRouter)", () => {
    const answer = [
      { type: "thinking", thinking: "", signature: "sig" },
      { type: "text", text: "SAME measured smoke.", citations: [{ type: "search_result_location" }] },
    ] as unknown as StoredTurn["response_content"];
    const turns: StoredTurn[] = [
      {
        turn_index: 0,
        question: "a",
        request_messages: [{ role: "user", content: "a" }],
        response_content: answer,
      },
    ];
    expect(historyFrom(turns, { textOnly: true })).toEqual([
      { role: "user", content: "a" },
      { role: "assistant", content: [{ type: "text", text: "SAME measured smoke." }] },
    ]);
    expect(historyFrom(turns)[1]).toEqual({ role: "assistant", content: answer });
  });
});
