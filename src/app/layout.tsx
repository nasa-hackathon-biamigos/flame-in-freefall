import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Space Firefighters",
  description:
    "Curated NASA PSI microgravity combustion data for fire safety — for the Moon and for Earth.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations("app");

  return (
    <html lang={locale} className={`${inter.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
            <span className="font-semibold tracking-tight">
              <span aria-hidden className="text-flame">
                ▲
              </span>{" "}
              {t("name")}
            </span>
            <LocaleSwitcher />
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
            {t("disclaimer")}
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
