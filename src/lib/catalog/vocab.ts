import { z } from "zod";

const LabelSchema = z.strictObject({ en: z.string().min(1), "pt-BR": z.string().min(1) });

const TermSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9_]+$/, "id must be snake_case"),
  label: LabelSchema,
  icon: z.string().optional(),
  color: z.string().optional(),
});

export const VOCAB_KEYS = [
  "pillar",
  "environment",
  "gravity",
  "platform",
  "hardware",
  "material_class",
  "solid_form",
  "earth_sectors",
  "transfer_type",
  "spinoff_category",
  "prediction_tags",
] as const;

export type VocabKey = (typeof VOCAB_KEYS)[number];

export const VocabSchema = z.strictObject(
  Object.fromEntries(VOCAB_KEYS.map((k) => [k, z.array(TermSchema).min(1)])) as Record<
    VocabKey,
    z.ZodArray<typeof TermSchema>
  >,
);

export type Label = z.infer<typeof LabelSchema>;
export type VocabTerm = z.infer<typeof TermSchema>;
export type Vocab = Record<VocabKey, VocabTerm[]>;

export function vocabIds(vocab: Vocab, key: VocabKey): string[] {
  return vocab[key].map((t) => t.id);
}
