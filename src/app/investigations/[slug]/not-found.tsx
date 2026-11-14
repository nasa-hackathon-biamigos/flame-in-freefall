import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <Link href="/explore" className="mt-4 inline-block text-plasma hover:underline">
        {t("back")}
      </Link>
    </div>
  );
}
