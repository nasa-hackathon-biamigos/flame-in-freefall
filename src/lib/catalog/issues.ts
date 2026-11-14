import type { z } from "zod";

/** A data problem, reported in Portuguese for the curation team (docs/SPEC.md §6.2). */
export type Problem = { file: string; field?: string; message: string };

const TYPE_PT: Record<string, string> = {
  string: "texto",
  number: "número",
  int: "número inteiro",
  boolean: "true ou false",
  array: "lista [ ]",
  object: "bloco de campos",
  null: "null",
  date: "data AAAA-MM-DD",
};

function describeValue(v: unknown): string {
  if (v === undefined) return "campo ausente";
  if (v === null) return "null";
  if (Array.isArray(v)) return "uma lista";
  if (typeof v === "object") return "um bloco de campos";
  return JSON.stringify(v);
}

function valueAt(root: unknown, path: PropertyKey[]): unknown {
  let cur: unknown = root;
  for (const key of path) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<PropertyKey, unknown>)[key];
  }
  return cur;
}

export function formatPath(path: PropertyKey[]): string {
  return path
    .map((p, i) => (typeof p === "number" ? `[${p}]` : i === 0 ? String(p) : `.${String(p)}`))
    .join("");
}

/** Turns Zod issues into readable Portuguese messages. `input` is the parsed YAML, used to show the received value. */
export function zodIssuesToProblems(file: string, issues: z.core.$ZodIssue[], input: unknown): Problem[] {
  return issues.map((issue) => {
    const field = formatPath(issue.path) || undefined;
    const got = valueAt(input, issue.path);
    let message: string;
    switch (issue.code) {
      case "invalid_type":
        message =
          got === undefined
            ? `campo obrigatório ausente (esperado: ${TYPE_PT[issue.expected] ?? issue.expected})`
            : `tipo errado: esperado ${TYPE_PT[issue.expected] ?? issue.expected}, recebido ${describeValue(got)}`;
        break;
      case "invalid_value":
        message = `valor ${describeValue(got)} não permitido. Use um destes: ${issue.values.map(String).join(", ")}`;
        break;
      case "unrecognized_keys":
        message = `campo(s) desconhecido(s): ${issue.keys.join(", ")}. Confira a grafia em data/_template.md`;
        break;
      case "too_small":
        message =
          issue.origin === "array"
            ? `a lista precisa ter pelo menos ${String(issue.minimum)} item(ns)`
            : issue.origin === "string"
              ? "o texto não pode ser vazio"
              : `valor ${describeValue(got)} abaixo do mínimo ${issue.inclusive ? "" : "(exclusivo) "}${String(issue.minimum)}`;
        break;
      case "too_big":
        message =
          issue.origin === "array"
            ? `a lista pode ter no máximo ${String(issue.maximum)} item(ns)`
            : `valor ${describeValue(got)} acima do máximo ${String(issue.maximum)}`;
        break;
      case "invalid_format":
        // regex validators carry their own Portuguese message (see schema.ts)
        if (issue.format === "regex") {
          message = `${issue.message} (recebido ${describeValue(got)})`;
          break;
        }
        message = `formato inválido (${describeValue(got)}); esperado: ${FORMAT_PT[issue.format] ?? issue.format}`;
        break;
      default:
        message = issue.message;
    }
    return { file, field, message };
  });
}

const FORMAT_PT: Record<string, string> = {
  url: "uma URL começando com https://",
  date: "data AAAA-MM-DD",
};
