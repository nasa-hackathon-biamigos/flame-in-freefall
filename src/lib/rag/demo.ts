import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { zodIssuesToProblems, type Problem } from "../catalog/issues";

export const DemoQuestionSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  kind: z.enum(["normal", "out_of_scope", "no_data"]),
  question: z.strictObject({ en: z.string().min(3), "pt-BR": z.string().min(3) }),
  expected_slugs: z.array(z.string()).default([]),
});

export type DemoQuestion = z.output<typeof DemoQuestionSchema>;

export async function loadDemoQuestions(
  dataDir: string,
): Promise<{ questions: DemoQuestion[]; problems: Problem[] }> {
  const file = path.join(dataDir, "demo_questions.yaml");
  const rel = "data/demo_questions.yaml";
  let data: unknown;
  try {
    data = YAML.parse((await readFile(file, "utf8")).replace(/\r\n?/g, "\n"));
  } catch (err) {
    return {
      questions: [],
      problems: [{ file: rel, message: `YAML inválido: ${(err as Error).message.split("\n")[0]}` }],
    };
  }
  const parsed = z.array(DemoQuestionSchema).safeParse(data ?? []);
  if (!parsed.success)
    return { questions: [], problems: zodIssuesToProblems(rel, parsed.error.issues, data) };
  return { questions: parsed.data, problems: [] };
}
