import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, locales, type Locale } from "./config";

export default getRequestConfig(async () => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = locales.includes(value as Locale) ? (value as Locale) : "en";
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
