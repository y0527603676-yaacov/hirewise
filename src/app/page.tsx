import Link from "next/link";
import { ArrowRight, Check, Clock, FileText, Globe2, Link2, Scale, ShieldCheck, X } from "lucide-react";
import { visitorT } from "@/lib/locale";
import { Footer, LangLinks, Logo } from "@/components/ui";
import { getPrices } from "@/lib/payments";
import { currencyForLocale, formatPrice, PACK_CREDITS, PACKS } from "@/lib/core/pricing";
import { FREE_REPORTS } from "@/lib/core/credits";
import { retentionMonths } from "@/lib/constants";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { locale, t } = await visitorT();
  const user = await currentUser().catch(() => null);
  const prices = await getPrices().catch(() => null);
  const cur = currencyForLocale(locale);
  const steps = [
    { icon: FileText, t: t("how1T"), d: t("how1D") },
    { icon: Link2, t: t("how2T"), d: t("how2D") },
    { icon: Check, t: t("how3T"), d: t("how3D") },
  ];
  return (
    <div>
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <Logo sub={t("byClearwise")} />
        <div className="flex items-center gap-3">
          <LangLinks current={locale} next="/" />
          <Link href={user ? "/app" : "/login"} className="btn-dark">{user ? t("dashboard") : t("login")}</Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-10 pt-8 sm:pt-16">
        <div className="max-w-3xl">
          <h1 className=" text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl">{t("heroTitle")}</h1>
          <p className="mt-5 text-lg leading-relaxed text-ink/70 sm:text-xl">{t("heroSub")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={user ? "/app/jobs/new" : "/login"} className="btn-primary px-6 py-3 text-base">
              {t("heroCta")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
            <Link href="/sample" className="btn-outline px-6 py-3 text-base">{t("heroCta2")}</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10">
        <h2 className="text-2xl font-extrabold tracking-tight">{t("howTitle")}</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={i} className="card">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand"><s.icon className="h-5 w-5" /></span>
                <span className="text-sm font-bold text-ink/40">0{i + 1}</span>
              </div>
              <h3 className="mt-4 text-lg font-bold">{s.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink/65">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-5 py-10 md:grid-cols-2">
        <div className="card bg-ink text-white">
          <h2 className="text-xl font-extrabold">{t("getTitle")}</h2>
          <ul className="mt-4 space-y-3">
            {[t("get1"), t("get2"), t("get3"), t("get4")].map((x) => (
              <li key={x} className="flex gap-3 text-white/85"><Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />{x}</li>
            ))}
          </ul>
          <Link href="/sample" className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-indigo-200 hover:text-white">{t("heroCta2")} <ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link>
        </div>
        <div className="grid gap-4">
          {[
            { icon: Clock, h: t("integrityTitle"), d: t("integrityD") },
            { icon: Scale, h: t("fairTitle"), d: t("fairD") },
            { icon: Globe2, h: t("langsTitle"), d: t("langsD") },
          ].map((b) => (
            <div key={b.h} className="card flex gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint/10 text-mint"><b.icon className="h-5 w-5" /></span>
              <div>
                <h3 className="font-bold">{b.h}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink/65">{b.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {prices && (
        <section className="mx-auto max-w-6xl px-5 py-10" id="pricing">
          <h2 className="text-2xl font-extrabold tracking-tight">{t("pricingTitle")}</h2>
          <p className="mt-2 text-ink/65">{t("pricingNote")}</p>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="card border-brand/30 bg-brand/[0.04]">
              <div className="text-sm font-bold text-brand">{t("pricingFree", { n: FREE_REPORTS })}</div>
              <div className="mt-2 text-3xl font-extrabold">0</div>
            </div>
            {PACKS.map((p) => (
              <div key={p} className="card">
                <div className="text-sm font-bold text-ink/60">{t("pricingPack", { n: PACK_CREDITS[p] })}</div>
                <div className="mt-2 text-3xl font-extrabold" dir="ltr">{formatPrice(prices[cur][p], cur, locale)}</div>
                <div className="mt-1 text-xs text-ink/55">{t("pricingPer", { price: formatPrice(Math.round((prices[cur][p] / PACK_CREDITS[p]) * 100) / 100, cur, locale) })}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-5 py-10">
        <h2 className="text-2xl font-extrabold tracking-tight">{t("notTitle")}</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {[t("not1"), t("not2"), t("not3"), t("not4")].map((x) => (
            <div key={x} className="flex items-start gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-3.5">
              <X className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <span className="text-sm leading-relaxed">{x}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-10">
        <h2 className="text-2xl font-extrabold tracking-tight">{t("faqTitle")}</h2>
        <div className="mt-5 space-y-3">
          {([["faq1Q", "faq1A"], ["faq2Q", "faq2A"], ["faq3Q", "faq3A"], ["faq4Q", "faq4A"]] as const).map(([q, a]) => (
            <details key={q} className="card group">
              <summary className="cursor-pointer list-none font-bold">{t(q)}</summary>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">{t(a, { months: retentionMonths() })}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="card flex flex-col items-start justify-between gap-4 bg-gradient-to-br from-brand to-indigo-700 text-white sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-indigo-200" />
            <h2 className="text-xl font-extrabold">{t("finalCta")}</h2>
          </div>
          <Link href={user ? "/app/jobs/new" : "/login"} className="btn bg-white text-brand hover:bg-indigo-50">{t("heroCta")}</Link>
        </div>
      </section>
      <Footer t={t} />
    </div>
  );
}
