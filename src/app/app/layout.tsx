import Link from "next/link";
import { Briefcase, CreditCard, LogOut, Settings } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "../actions";
import { Footer, Logo } from "@/components/ui";
import { balance } from "@/lib/core/credits";
import { dirOf, getT, isLocale, type Locale } from "@/i18n";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const locale = (isLocale(user.locale) ? user.locale : "en") as Locale;
  const t = getT(locale);
  const left = balance(user);
  return (
    <div dir={dirOf(locale)} lang={locale} className="min-h-screen">
      <header className="no-print sticky top-0 z-20 border-b border-ink/[0.06] bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Logo href="/app" />
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/app" className="btn-ghost"><Briefcase className="h-4 w-4" /><span className="hidden sm:inline">{t("navJobs")}</span></Link>
            <Link href="/app/wallet" className="btn-ghost">
              <CreditCard className="h-4 w-4" />
              <span className={`badge ${left > 0 ? "bg-mint/10 text-mint" : "bg-red-50 text-red-700"}`}>{t("creditsLeft", { n: left })}</span>
            </Link>
            <Link href="/app/settings" className="btn-ghost"><Settings className="h-4 w-4" /><span className="hidden sm:inline">{t("navSettings")}</span></Link>
            <form action={logoutAction}>
              <button className="btn-ghost" title={t("logout")}><LogOut className="h-4 w-4 rtl:rotate-180" /></button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
      <Footer t={t} />
    </div>
  );
}
