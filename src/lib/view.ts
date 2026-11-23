/** Small helpers shared by the employer screens */
import { getT, isLocale, type Locale } from "@/i18n";
import type { User } from "./schema";

export const userLocale = (u: User) => (isLocale(u.locale) ? u.locale : "en") as Locale;
export const userT = (u: User) => getT(userLocale(u));

export const fmtDate = (d: Date | null | undefined, locale: Locale) =>
  d ? new Intl.DateTimeFormat(locale === "he" ? "he-IL" : locale === "ar" ? "ar" : locale, { dateStyle: "medium", timeStyle: "short" }).format(d) : "";

export const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export const safeJson = <T,>(s: string | null | undefined, fallback: T): T => {
  try {
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
};
