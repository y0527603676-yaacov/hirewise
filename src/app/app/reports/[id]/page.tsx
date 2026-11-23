import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assessments, candidates, candidateSubmissions, evaluationReports, jobProfiles } from "@/lib/schema";
import { parseAssessment } from "@/lib/jobs";
import { fmtDate, safeJson, userLocale, userT } from "@/lib/view";
import { secondsUsed, type Answers } from "@/lib/core/room";
import { balance } from "@/lib/core/credits";
import { ReportView, type ReportData } from "@/components/report-view";
import { PendingWatcher, PrintButton, RetryButton, UnlockButton } from "@/components/forms/report-actions";
import { ScoreRing } from "@/components/ui";
import { deleteCandidateAction } from "@/app/actions";
import { LOCALE_NAMES, isLocale } from "@/i18n";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const t = userT(user);
  const locale = userLocale(user);
  const db = await getDb();
  const [row] = await db
    .select({ s: candidateSubmissions, c: candidates, j: jobProfiles, a: assessments })
    .from(candidateSubmissions)
    .innerJoin(candidates, eq(candidates.id, candidateSubmissions.candidateId))
    .innerJoin(jobProfiles, eq(jobProfiles.id, candidateSubmissions.jobProfileId))
    .innerJoin(assessments, eq(assessments.id, candidateSubmissions.assessmentId))
    .where(eq(candidateSubmissions.id, id))
    .limit(1);
  if (!row || row.j.userId !== user.id) notFound();
  const { s, c, j, a } = row;
  const [r] = await db.select().from(evaluationReports).where(eq(evaluationReports.submissionId, id)).limit(1);
  const langName = isLocale(c.locale) ? LOCALE_NAMES[c.locale] : c.locale;
  const top = (
    <div className="no-print flex flex-wrap items-center justify-between gap-3">
      <Link href={`/app/jobs/${j.id}`} className="text-sm text-ink/50 hover:underline">← {j.title}</Link>
      {r?.isUnlocked && <PrintButton label={t("print")} />}
    </div>
  );
  const delForm = (
    <form action={deleteCandidateAction} className="no-print mt-8 text-center">
      <input type="hidden" name="id" value={s.id} />
      <button className="btn-danger text-xs">{t("deleteCandidate")}</button>
    </form>
  );

  // Not finished or no report yet
  if (!r) {
    let body: React.ReactNode;
    if (s.status === "IN_PROGRESS") body = <p className="text-ink/60">{t("stInProgress")}</p>;
    else if (s.status === "EXPIRED") body = <p className="text-ink/60">{t("stExpired")}</p>;
    else if (s.evalStatus === "DEFERRED")
      body = (
        <div className="space-y-3">
          <p className="text-ink/65">{t("lockedD")}</p>
          <UnlockButton subId={s.id} label={t("unlock")} noCredits={t("noCredits")} />
          {balance(user) === 0 && <Link href="/app/wallet" className="block text-sm font-semibold text-brand hover:underline">{t("buyCredits")}</Link>}
        </div>
      );
    else if (s.evalStatus === "FAILED" && s.evalAttempts >= 3)
      body = (
        <div className="space-y-3">
          <p className="text-ink/65">{t("evalFailed")}</p>
          <RetryButton subId={s.id} label={t("retryEval")} />
        </div>
      );
    else
      body = (
        <div className="flex items-center gap-3">
          <PendingWatcher subId={s.id} />
          <p className="text-ink/65">{t("evaluating")}</p>
        </div>
      );
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        {top}
        <div className="card">
          <h1 className="h1">{c.fullName}</h1>
          <p className="mt-1 text-sm text-ink/55">{j.title} · {t("answeredIn", { lang: langName })}</p>
          <div className="mt-6">{body}</div>
        </div>
        {delForm}
      </div>
    );
  }

  // Locked: teaser only. Nothing beyond name and match is sent to the browser.
  if (!r.isUnlocked) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        {top}
        <div className="card">
          <div className="flex flex-wrap items-center gap-6">
            <ScoreRing value={r.overallScore} label={t("overall")} size={112} />
            <div>
              <h1 className="h1">{c.fullName}</h1>
              <p className="mt-1 text-sm text-ink/55">{j.title} · {t("answeredIn", { lang: langName })} · {fmtDate(s.completedAt, locale)}</p>
            </div>
          </div>
          <div className="relative mt-6 overflow-hidden rounded-xl border border-ink/[0.07]">
            <div className="blur-lock space-y-3 p-5" aria-hidden>
              <div className="h-4 w-2/3 rounded bg-ink/10" />
              <div className="h-4 w-5/6 rounded bg-ink/10" />
              <div className="h-4 w-1/2 rounded bg-ink/10" />
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="h-16 rounded-xl bg-ink/[0.06]" /><div className="h-16 rounded-xl bg-ink/[0.06]" /><div className="h-16 rounded-xl bg-ink/[0.06]" />
              </div>
              <div className="h-4 w-3/4 rounded bg-red-200" />
              <div className="h-4 w-2/3 rounded bg-ink/10" />
            </div>
            <div className="absolute inset-0 grid place-items-center bg-white/40 p-4 text-center">
              <div className="max-w-sm space-y-3">
                <h2 className="h2">🔒 {t("lockedTitle")}</h2>
                <p className="text-sm text-ink/65">{t("lockedD")}</p>
                <div className="flex justify-center"><UnlockButton subId={s.id} label={t("unlock")} noCredits={t("noCredits")} /></div>
                {balance(user) === 0 && <Link href="/app/wallet" className="block text-sm font-semibold text-brand hover:underline">{t("buyCredits")}</Link>}
              </div>
            </div>
          </div>
        </div>
        {delForm}
      </div>
    );
  }

  const qs = parseAssessment(a).questions;
  const answers = safeJson<Answers>(s.answers, {});
  const perQ = safeJson<{ id: string; score: number; note: string }[]>(r.perQuestion, []);
  const data: ReportData = {
    name: c.fullName,
    role: j.title,
    answeredIn: t("answeredIn", { lang: langName }),
    submitted: t("submittedAt", { date: fmtDate(s.completedAt, locale) }),
    overall: r.overallScore, competence: r.competenceScore, culture: r.cultureFitScore, reliability: r.reliabilityScore,
    summary: r.executiveSummary,
    strengths: safeJson(r.strengths, []),
    redFlags: safeJson(r.redFlags, []),
    interview: safeJson(r.recommendedInterviewQuestions, []),
    integrity: safeJson(r.integrity, { level: "clean", flags: [] }),
    questions: qs.map((q) => ({ id: q.id, title: q.title, prompt: q.prompt, answer: answers[q.id]?.text || "", seconds: secondsUsed(answers[q.id]), timedOut: answers[q.id]?.timedOut, score: perQ.find((p) => p.id === q.id)?.score, note: perQ.find((p) => p.id === q.id)?.note })),
  };
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {top}
      <ReportView t={t} r={data} />
      {delForm}
    </div>
  );
}
