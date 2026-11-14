import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations();

  return (
    <section className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
      <p className="font-mono text-sm text-plasma">{t("app.tagline")}</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">{t("home.title")}</h1>
      <p className="mt-6 text-muted-foreground">{t("home.status")}</p>
    </section>
  );
}
