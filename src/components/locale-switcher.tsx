"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, locales } from "@/i18n/config";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("locale");

  return (
    <div role="group" aria-label={t("label")} className="flex gap-1 font-mono text-xs">
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={l === locale}
          onClick={() => {
            document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
            router.refresh();
          }}
          className="rounded px-2 py-1 text-muted-foreground hover:text-foreground aria-pressed:bg-secondary aria-pressed:text-foreground"
        >
          {l === "en" ? "EN" : "PT"}
        </button>
      ))}
    </div>
  );
}
