import Link from "next/link";
import { visitorT } from "@/lib/locale";
import { sampleFor } from "@/lib/sample";
import { ReportView } from "@/components/report-view";
import { Footer, LangLinks, Logo, Notice } from "@/components/ui";
import { LOCALE_NAMES } from "@/i18n";

export const dynamic = "force-dynamic";

export default async function SamplePage() {
  const { locale, t } = await visitorT();
  const s = sampleFor(locale);
  const lang = locale === "he" ? "he" : "en";
  return (
    <div>
      <header className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <Logo sub={t("byClearwise")} />
        <LangLinks current={locale} next="/sample" />
      </header>
      <main className="mx-auto max-w-4xl space-y-5 px-5">
        <Notice>
          {t("heroCta2")} · {s.job.title}. <Link href="/login" className="font-semibold underline">{t("heroCta")}</Link>
        </Notice>
        <ReportView
          t={t}
          r={{
            name: s.candidate, role: s.job.title, answeredIn: t("answeredIn", { lang: LOCALE_NAMES[lang] }), submitted: "",
            overall: s.report.overallScore, competence: s.report.competenceScore, culture: s.report.cultureFitScore, reliability: s.report.reliabilityScore,
            summary: s.report.executiveSummary, strengths: s.report.strengths, redFlags: s.report.redFlags, interview: s.report.recommendedInterviewQuestions,
            integrity: { level: "clean", flags: [] },
            questions: s.assessment.questions.map((q, i) => ({ id: q.id, title: q.title, prompt: q.prompt, answer: s.answers[q.id], seconds: s.seconds[i], score: s.report.perQuestion[i]?.score, note: s.report.perQuestion[i]?.note })),
          }}
        />
      </main>
      <Footer t={t} />
    </div>
  );
}
