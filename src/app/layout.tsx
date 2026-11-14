import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { NavLink } from "@/components/nav-link";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Space Firefighters", template: "%s · Space Firefighters" },
  description: "Curated NASA PSI microgravity combustion data for fire safety — for the Moon and for Earth.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations();

  return (
    <html lang={locale} className={`${inter.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <a
            href="#content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded focus:bg-primary focus:px-3 focus:py-1 focus:text-primary-foreground"
          >
            {t("app.skip")}
          </a>
          <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
              <Link href="/" className="font-semibold tracking-tight">
                <span aria-hidden className="text-flame">
                  ▲
                </span>{" "}
                {t("app.name")}
              </Link>
              <nav aria-label={t("nav.label")} className="flex flex-1 gap-1 text-sm">
                <NavLink href="/explore">{t("nav.explore")}</NavLink>
                <NavLink href="/about">{t("nav.about")}</NavLink>
              </nav>
              <LocaleSwitcher />
            </div>
          </header>
          <main id="content" className="flex-1">
            {children}
          </main>
          <footer className="border-t">
            <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:px-6">
              <span>{t("app.disclaimer")}</span>
              <Link href="/about" className="hover:text-foreground">
                {t("nav.about")}
              </Link>
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
