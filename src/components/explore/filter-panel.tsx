"use client";

import { Globe, Search, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";

export type FacetOption = { id: string; label: string; count: number };
export type FacetView = { param: string; title: string; options: FacetOption[] };

/** Filters live in the URL so every view is a shareable link (docs/SPEC.md §10.1). */
export function FilterPanel({ facets, earthCount }: { facets: FacetView[]; earthCount: number }) {
  const t = useTranslations("explore");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const searchId = useId();
  const panelId = useId();
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  function update(mutate: (p: URLSearchParams) => void) {
    const p = new URLSearchParams(searchParams.toString());
    mutate(p);
    const qs = p.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function toggle(param: string, id: string) {
    update((p) => {
      const current = (p.get(param) ?? "").split(",").filter(Boolean);
      const next = current.includes(id) ? current.filter((v) => v !== id) : [...current, id];
      if (next.length) p.set(param, next.join(","));
      else p.delete(param);
    });
  }

  useEffect(() => () => clearTimeout(debounce.current), []);

  function onQuery(value: string) {
    setQuery(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(
      () =>
        update((p) => {
          if (value.trim()) p.set("q", value.trim());
          else p.delete("q");
        }),
      250,
    );
  }

  const selected = (param: string) => (searchParams.get(param) ?? "").split(",").filter(Boolean);
  const hasFilters = [...searchParams.keys()].some(
    (k) => k === "q" || k === "earth" || facets.some((f) => f.param === k),
  );

  return (
    <div aria-busy={pending}>
      <label htmlFor={searchId} className="sr-only">
        {t("search")}
      </label>
      <div className="relative">
        <Search
          aria-hidden
          className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t("search")}
          className="h-9 w-full rounded-md border bg-input/30 pl-8 pr-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="mt-3 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm lg:hidden"
      >
        <SlidersHorizontal aria-hidden className="size-4" />
        {open ? t("hideFilters") : t("showFilters")}
      </button>

      <div
        id={panelId}
        className={cn("mt-4 space-y-5 lg:block", open ? "block" : "hidden", pending && "opacity-70")}
      >
        <h2 className="sr-only">{t("filters")}</h2>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={searchParams.get("earth") === "1"}
            onChange={(e) =>
              update((p) => {
                if (e.target.checked) p.set("earth", "1");
                else p.delete("earth");
              })
            }
            className="size-4 accent-[var(--earth)]"
          />
          <Globe aria-hidden className="size-4 text-earth" />
          <span className="flex-1">{t("earthOnly")}</span>
          <span className="font-mono text-xs text-muted-foreground">{earthCount}</span>
        </label>

        {facets.map((facet) => {
          const chosen = selected(facet.param);
          return (
            <fieldset key={facet.param}>
              <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {facet.title}
              </legend>
              <ul className="space-y-1">
                {facet.options.map((o) => {
                  const checked = chosen.includes(o.id);
                  return (
                    <li key={o.id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-2 text-sm",
                          o.count === 0 && !checked && "text-muted-foreground",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(facet.param, o.id)}
                          className="size-4 accent-[var(--plasma)]"
                        />
                        <span className="flex-1">{o.label}</span>
                        <span className="font-mono text-xs text-muted-foreground">{o.count}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          );
        })}

        {hasFilters && (
          <Link
            href={pathname}
            scroll={false}
            onClick={() => setQuery("")}
            className="inline-block text-sm text-plasma hover:underline"
          >
            {t("clear")}
          </Link>
        )}
      </div>
    </div>
  );
}
