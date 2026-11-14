import { Globe } from "lucide-react";
import type { Vocab } from "@/lib/catalog/vocab";
import { termIcon, termLabel, type UiLocale } from "@/lib/catalog/labels";
import { cn } from "@/lib/utils";
import { VocabIcon } from "@/components/vocab-icon";

/** Pillar colors as literal classes so Tailwind can see them. Always icon + text, never color alone. */
export const PILLAR_STYLE: Record<string, string> = {
  prevention: "border-prevention/40 bg-prevention/10 text-prevention",
  detection: "border-detection/40 bg-detection/10 text-detection",
  suppression: "border-suppression/40 bg-suppression/10 text-suppression",
};

const base = "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium";

export function PillarBadge({ id, vocab, locale }: { id: string; vocab: Vocab; locale: UiLocale }) {
  return (
    <span className={cn(base, PILLAR_STYLE[id] ?? "border-border text-muted-foreground")}>
      <VocabIcon name={termIcon(vocab, "pillar", id)} className="size-3.5" />
      {termLabel(vocab, "pillar", id, locale)}
    </span>
  );
}

export function TagBadge({ children }: { children: React.ReactNode }) {
  return <span className={cn(base, "border-border text-muted-foreground")}>{children}</span>;
}

export function PartialBadge({ label }: { label: string }) {
  return <span className={cn(base, "border-warn/40 bg-warn/10 text-warn")}>{label}</span>;
}

export function ExampleBadge({ label }: { label: string }) {
  return <span className={cn(base, "border-bad/40 bg-bad/10 font-mono uppercase text-bad")}>{label}</span>;
}

export function EarthBadge({ label }: { label: string }) {
  return (
    <span className={cn(base, "border-earth/40 bg-earth/10 text-earth")}>
      <Globe aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}
