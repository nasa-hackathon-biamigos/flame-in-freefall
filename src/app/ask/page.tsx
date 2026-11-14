import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import demoQuestions from "@/generated/demo-questions.json";
import { Chat } from "@/components/ask/chat";
import { asUiLocale } from "@/lib/catalog/labels";
import type { DemoQuestion } from "@/lib/rag/demo";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("ask"))("title") };
}

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("ask");
  const locale = asUiLocale(await getLocale());
  const q = (await searchParams).q;
  const suggestions = (demoQuestions as DemoQuestion[])
    .filter((d) => d.kind === "normal")
    .map((d) => d.question[locale]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("lead")}</p>
      <p className="mt-4 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
        {t("disclaimer")}
      </p>
      <div className="mt-8">
        <Chat suggestions={suggestions} initialQuestion={typeof q === "string" ? q.slice(0, 1000) : ""} />
      </div>
    </div>
  );
}
