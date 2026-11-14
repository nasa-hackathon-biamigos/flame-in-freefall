import type { Vocab, VocabKey } from "./vocab";

export type UiLocale = "en" | "pt-BR";

export function asUiLocale(locale: string): UiLocale {
  return locale === "pt-BR" ? "pt-BR" : "en";
}

/** Localized label of a vocabulary term; falls back to the id. */
export function termLabel(vocab: Vocab, key: VocabKey, id: string, locale: UiLocale): string {
  return vocab[key].find((t) => t.id === id)?.label[locale] ?? id;
}

export function termIcon(vocab: Vocab, key: VocabKey, id: string): string | undefined {
  return vocab[key].find((t) => t.id === id)?.icon;
}
