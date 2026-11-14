export const KPA_PER_PSI = 6.894757;

export function psiToKpa(psi: number): number {
  return psi * KPA_PER_PSI;
}

export type Range = { min: number | null; max: number | null };

/** "21–30", "21" (min = max or no max) or null when nothing is known. */
export function formatRange(r: Range, locale: string, maxFractionDigits = 1): string | null {
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: maxFractionDigits });
  if (r.min === null && r.max === null) return null;
  if (r.min !== null && r.max !== null && r.min !== r.max) return `${fmt.format(r.min)}–${fmt.format(r.max)}`;
  if (r.min === null) return `≤ ${fmt.format(r.max as number)}`;
  return fmt.format(r.min);
}

export function mapRange(r: Range, f: (n: number) => number): Range {
  return { min: r.min === null ? null : f(r.min), max: r.max === null ? null : f(r.max) };
}
