/** Splits a Markdown body into `## Heading` sections. HTML comments (template hints) are dropped. */
export function parseSections<K extends string>(
  body: string,
  headings: Record<K, string>,
): { sections: Record<K, string>; unknownHeadings: string[] } {
  const byHeading = new Map<string, K>(
    (Object.entries(headings) as Array<[K, string]>).map(([key, h]) => [normalize(h), key]),
  );
  const sections = Object.fromEntries(Object.keys(headings).map((k) => [k, ""])) as Record<K, string>;
  const unknownHeadings: string[] = [];

  const text = body.replace(/<!--[\s\S]*?-->/g, "").replace(/\r\n?/g, "\n");
  let current: K | null = null;
  let buffer: string[] = [];
  const flush = () => {
    if (current)
      sections[current] = [sections[current], buffer.join("\n").trim()].filter(Boolean).join("\n\n");
    buffer = [];
  };

  for (const line of text.split("\n")) {
    const m = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) {
      flush();
      const key = byHeading.get(normalize(m[1]));
      current = key ?? null;
      if (!key) unknownHeadings.push(m[1]);
      continue;
    }
    buffer.push(line);
  }
  flush();
  return { sections, unknownHeadings };
}

function normalize(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

export const INVESTIGATION_SECTIONS = {
  summary: "Summary",
  crew_safety: "Why it matters for crew safety",
  earth_impact: "Earth impact",
  key_results: "Key results",
  limitations: "Limitations",
} as const;

export const COMPARISON_SECTIONS = {
  what_changed: "What changed",
  what_stayed: "What stayed the same",
  so_what: "So what for fire safety",
} as const;

export type InvestigationSectionKey = keyof typeof INVESTIGATION_SECTIONS;
export type ComparisonSectionKey = keyof typeof COMPARISON_SECTIONS;
