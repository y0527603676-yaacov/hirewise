import { cookies, headers } from "next/headers";
import { fromAcceptLanguage, getT, isLocale, type Locale } from "@/i18n";

export const LANG_COOKIE = "hw_lang";

/** Visitor language: explicit choice (cookie) first, then the browser language */
export async function visitorLocale(): Promise<Locale> {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLocale(c)) return c;
  return fromAcceptLanguage((await headers()).get("accept-language"));
}

export async function visitorT() {
  const locale = await visitorLocale();
  return { locale, t: getT(locale) };
}
