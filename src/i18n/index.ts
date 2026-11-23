import en, { type Dict } from "./en";
import he from "./he";
import es from "./es";
import fr from "./fr";
import de from "./de";
import ar from "./ar";

export const LOCALES = ["en", "he", "es", "fr", "de", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const RTL: Locale[] = ["he", "ar"];
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", he: "עברית", es: "Español", fr: "Français", de: "Deutsch", ar: "العربية" };
/** Language names in English, used inside AI instructions */
export const LOCALE_EN: Record<Locale, string> = { en: "English", he: "Hebrew", es: "Spanish", fr: "French", de: "German", ar: "Arabic" };

const DICTS: Record<Locale, Dict> = { en, he, es, fr, de, ar };

export const isLocale = (l: unknown): l is Locale => LOCALES.includes(l as Locale);
export const dirOf = (l: Locale) => (RTL.includes(l) ? "rtl" : "ltr");
export type Key = keyof Dict;
export type T = (key: Key, vars?: Record<string, string | number>) => string;

export function getT(locale: Locale): T {
  const d = DICTS[locale] || en;
  return (key, vars) => {
    let s = d[key] ?? en[key] ?? String(key);
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
}

/** Picks the best supported locale from an Accept-Language header */
export function fromAcceptLanguage(header: string | null | undefined): Locale {
  for (const part of String(header || "").split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (code === "iw") return "he";
    if (isLocale(code)) return code;
  }
  return "en";
}

export { DICTS };
