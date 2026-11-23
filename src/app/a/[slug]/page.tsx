import { notFound } from "next/navigation";
import { Clock, EyeOff, PauseCircle, Timer, Undo2, Bot, Lock } from "lucide-react";
import { jobBySlug } from "@/lib/candidate";
import { visitorLocale } from "@/lib/locale";
import { retentionMonths } from "@/lib/constants";
import { BriefingForm } from "@/components/forms/briefing-form";
import { LangLinks, Logo } from "@/components/ui";
import { DICTS, dirOf, getT, isLocale, type Locale } from "@/i18n";

export const dynamic = "force-dynamic";

/** The mandatory pre-assessment briefing: conditions, AI notice, data rights, consent */
export default async function Briefing({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { slug } = await params;
  const { lang } = await searchParams;
  const found = await jobBySlug(slug);
  if (!found) notFound();
  const locale = (isLocale(lang) ? lang : await visitorLocale()) as Locale;
  const t = getT(locale);
  const { job, owner } = found;
  const open = job.status === "ACTIVE" && owner.company && owner.contactEmail;
  const rules = [
    { icon: Clock, text: t("cRuleTime") },
    { icon: PauseCircle, text: t("cRuleNoPause") },
    { icon: Timer, text: t("cRuleTimed") },
    { icon: Undo2, text: t("cRuleNoBack") },
    { icon: EyeOff, text: t("cRuleMonitor") },
  ];
  return (
    <div dir={dirOf(locale)} lang={locale} className="mx-auto min-h-screen max-w-2xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Logo href={`/a/${slug}?lang=${locale}`} />
        <LangLinks current={locale} next={`/a/${slug}`} param />
      </div>
      <div className="card mt-6 p-6">
        <p className="text-sm font-semibold text-brand">{owner.company}</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-snug">{t("cInvite", { company: owner.company || "" })}</h1>
        <p className="mt-1 text-ink/60">{t("cRole", { role: job.title })}</p>
        {!open ? (
          <p className="mt-6 rounded-xl bg-amber-50 p-4 text-amber-900">{t("cClosed")}</p>
        ) : (
          <>
            <h2 className="mt-6 font-bold">{t("cBefore")}</h2>
            <ul className="mt-3 space-y-2.5">
              {rules.map((r) => (
                <li key={r.text} className="flex items-start gap-3 text-sm leading-relaxed">
                  <r.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand" />{r.text}
                </li>
              ))}
            </ul>
            <div className="mt-5 space-y-2 rounded-xl bg-mist p-4 text-sm leading-relaxed text-ink/75">
              <p className="flex gap-2"><Bot className="mt-0.5 h-4 w-4 shrink-0" />{t("cAiNotice")}</p>
              <p className="flex gap-2"><Lock className="mt-0.5 h-4 w-4 shrink-0" />{t("cData", { months: retentionMonths(), email: owner.contactEmail || "" })}</p>
            </div>
            <p className="mt-5 text-sm text-ink/60">{t("cLangHint")}</p>
            <div className="mt-4"><BriefingForm d={DICTS[locale]} slug={slug} locale={locale} /></div>
          </>
        )}
      </div>
      <p className="mt-6 text-center text-xs text-ink/45">
        <a href="/privacy" className="hover:underline">{t("privacy")}</a> · Hirewise {t("byClearwise")}
      </p>
    </div>
  );
}
