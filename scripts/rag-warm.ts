/**
 * Pre-warms the answer cache with the demo questions (docs/SPEC.md §8.6).
 * Each uncached question is one paid Claude call — ask Pedro before running against production.
 *
 *   pnpm rag:warm                                   # http://localhost:3000, en + pt-BR
 *   pnpm rag:warm --base https://space-firefighters.vercel.app --locale en
 */
import path from "node:path";
import { readEvents } from "../src/lib/rag/events";
import { loadDemoQuestions } from "../src/lib/rag/demo";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  const base = arg("base", "http://localhost:3000").replace(/\/$/, "");
  const locales = arg("locale", "en,pt-BR").split(",") as Array<"en" | "pt-BR">;
  const { questions, problems } = await loadDemoQuestions(path.join(process.cwd(), "data"));
  if (problems.length) throw new Error(problems.map((p) => p.message).join("\n"));

  for (const locale of locales) {
    for (const q of questions) {
      const question = q.question[locale];
      const started = Date.now();
      const res = await fetch(`${base}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: base },
        body: JSON.stringify({ question, locale }),
      });
      if (!res.ok || !res.body) {
        console.log(`  x [${locale}] ${q.id}: HTTP ${res.status} ${await res.text()}`);
        continue;
      }
      let cached = false;
      let sources = 0;
      let error = "";
      for await (const e of readEvents(res.body)) {
        if (e.type === "meta") cached = e.cached;
        if (e.type === "source") sources++;
        if (e.type === "error") error = e.code;
      }
      const status = error ? `ERROR ${error}` : cached ? "already cached" : "warmed";
      console.log(
        `  ${error ? "x" : "✓"} [${locale}] ${q.id} (${q.kind}): ${status}, ${sources} source(s), ${Date.now() - started} ms`,
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
