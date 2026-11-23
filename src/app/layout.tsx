import "./globals.css";
import type { Metadata, Viewport } from "next";
import { visitorLocale } from "@/lib/locale";
import { dirOf, getT } from "@/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await visitorLocale());
  return {
    metadataBase: new URL(process.env.APP_URL || "https://hire.clearwise.me"),
    title: `Hirewise — ${t("heroTitle")}`,
    description: t("heroSub"),
  };
}
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#4f46e5" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await visitorLocale();
  return (
    <html lang={locale} dir={dirOf(locale)}>
      <body>{children}</body>
    </html>
  );
}
