import { Download } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { catalog } from "@/lib/catalog/load";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("about"))("title") };
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://space-firefighters.vercel.app";

const API_ENDPOINTS = [
  "GET /api/investigations?pillar=detection&earth=1",
  "GET /api/investigations/<slug>",
  "GET /api/export?format=json|csv",
];

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}

export default async function AboutPage() {
  const t = await getTranslations("about");
  const year = new Date(catalog.generated_at).getUTCFullYear();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("lead")}</p>

      <div className="mt-10 space-y-10">
        <Block title={t("whatTitle")}>
          <p>{t("whatText")}</p>
        </Block>
        <Block title={t("statusTitle")}>
          <p>{t("statusText")}</p>
        </Block>
        <Block title={t("limitsTitle")}>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t("limits.partialGravity")}</li>
            <li>{t("limits.notModel")}</li>
            <li>{t("limits.scope")}</li>
          </ul>
        </Block>
        <Block title={t("downloadTitle")}>
          <p>{t("downloadText")}</p>
          <div className="flex gap-3">
            <a href="/api/export?format=json" className={buttonVariants({ variant: "outline" })}>
              <Download aria-hidden /> {t("downloadJson")}
            </a>
            <a href="/api/export?format=csv" className={buttonVariants({ variant: "outline" })}>
              <Download aria-hidden /> {t("downloadCsv")}
            </a>
          </div>
          <p className="font-mono text-xs">catalog {catalog.version}</p>
        </Block>
        <Block title={t("apiTitle")}>
          <p>{t("apiText")}</p>
          <ul className="space-y-1 rounded-md border bg-card p-3 font-mono text-xs text-foreground">
            {API_ENDPOINTS.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Block>
        <Block title={t("citeTitle")}>
          <p>{t("citeText")}</p>
          <p className="rounded-md border bg-card p-3 font-mono text-xs text-foreground">
            Space Firefighters ({year}). Curated NASA PSI combustion catalog for fire safety. NASA Space Apps
            Challenge {year}. {SITE_URL} (catalog {catalog.version}).
          </p>
        </Block>
        <Block title={t("licenseTitle")}>
          <p>{t("licenseText")}</p>
        </Block>
        <Block title={t("guideTitle")}>
          <p id="mini-book">{t("guideText")}</p>
        </Block>
      </div>
    </div>
  );
}
