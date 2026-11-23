import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { Clock, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { candidates, candidateSubmissions, evaluationReports } from "@/lib/schema";
import { baseAssessment, getOwnedJob, parseAssessment } from "@/lib/jobs";
import { fmtDate, safeJson, userLocale, userT } from "@/lib/view";
import { appUrl } from "@/lib/constants";
import { toggleJobAction } from "@/app/actions";
import { CandidateLink, RegenerateButton } from "@/components/forms/job-tools";
import { StatusBadge } from "@/components/status";
import { Notice } from "@/components/ui";
import type { IntegrityLevel } from "@/lib/core/integrity";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const full = await getOwnedJob(user, id);
  if (!full) notFound();
  const { job } = full;
  const t = userT(user);
  const locale = userLocale(user);
  const base = await baseAssessment(job.id);
  const content = base ? parseAssessment(base) : null;
  const db = await getDb();
  const rows = await db
    .select({ s: candidateSubmissions, c: candidates, r: evaluationReports })
    .from(candidateSubmissions)
    .innerJoin(candidates, eq(candidates.id, candidateSubmissions.candidateId))
    .leftJoin(evaluationReports, eq(evaluationReports.submissionId, candidateSubmissions.id))
    .where(eq(candidateSubmissions.jobProfileId, job.id))
    .orderBy(desc(candidateSubmissions.briefingAgreedAt));
  const setup = !user.company || !user.contactEmail;
  const intTone: Record<IntegrityLevel, string> = { clean: "bg-mint/10 text-mint", minor: "bg-amber-50 text-amber-700", review: "bg-red-50 text-red-700" };
  const intLabel: Record<IntegrityLevel, Parameters<typeof t>[0]> = { clean: "intClean", minor: "intMinor", review: "intReview" };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/app" className="text-sm text-ink/50 hover:underline">← {t("navJobs")}</Link>
          <h1 className="h1 mt-1">{job.title}</h1>
          <p className="mt-1 text-sm text-ink/55">{[job.department, t(`j${job.jurisdiction}` as never)].filter(Boolean).join(" · ")}</p>
        </div>
        <form action={toggleJobAction}>
          <input type="hidden" name="id" value={job.id} />
          <button className="btn-outline">{job.status === "ACTIVE" ? t("closeJob") : t("reopenJob")}</button>
        </form>
      </div>

      <section className="card">
        <h2 className="h2">{t("jobLinkTitle")}</h2>
        <p className="mt-1 text-sm text-ink/60">{t("jobLinkHint")}</p>
        {setup ? (
          <div className="mt-4"><Notice tone="warn">{t("setupNeeded")} <Link className="font-semibold underline" href="/app/settings">{t("goSettings")}</Link></Notice></div>
        ) : job.status !== "ACTIVE" ? (
          <div className="mt-4"><Notice tone="warn">{t("cClosed")}</Notice></div>
        ) : (
          <div className="mt-4"><CandidateLink base={`${appUrl()}/a/${job.uniqueSlug}`} defaultLang={locale} labels={{ linkLang: t("linkLang"), copy: t("copy"), copied: t("copied") }} /></div>
        )}
      </section>

      <section className="card p-0">
        <h2 className="h2 px-5 pt-5">{t("candidatesTitle")}</h2>
        {rows.length === 0 ? (
          <p className="px-5 pb-6 pt-2 text-sm text-ink/55">{t("noCandidates")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-mist text-xs text-ink/55">
                <tr>
                  <th className="px-5 py-2 text-start font-semibold">{t("colName")}</th>
                  <th className="px-3 py-2 text-start font-semibold">{t("colMatch")}</th>
                  <th className="px-3 py-2 text-start font-semibold">{t("colIntegrity")}</th>
                  <th className="px-3 py-2 text-start font-semibold">{t("colStatus")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/[0.06]">
                {rows.map(({ s, c, r }) => {
                  const level = r ? safeJson<{ level?: IntegrityLevel }>(r.integrity, {}).level : undefined;
                  return (
                    <tr key={s.id} className="hover:bg-mist/60">
                      <td className="px-5 py-3">
                        <Link href={`/app/reports/${s.id}`} className="font-semibold text-ink hover:text-brand">{c.fullName}</Link>
                        <div className="text-xs text-ink/45">{fmtDate(s.completedAt ?? s.briefingAgreedAt, locale)}</div>
                      </td>
                      <td className="px-3 py-3 font-bold">{r ? `${r.overallScore}%` : "—"}</td>
                      <td className="px-3 py-3">
                        {level ? r?.isUnlocked ? <span className={`badge ${intTone[level]}`}>{t(intLabel[level])}</span> : <Lock className="h-4 w-4 text-ink/30" /> : "—"}
                      </td>
                      <td className="px-3 py-3"><StatusBadge t={t} sub={s} report={r} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {content && (
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="h2">{t("questionsTitle")}</h2>
            {rows.length === 0 ? <RegenerateButton jobId={job.id} label={t("regenerate")} errLocked={t("regenLocked")} errGeneric={t("errGeneric")} /> : <span className="text-xs text-ink/45">{t("regenLocked")}</span>}
          </div>
          <ol className="mt-4 space-y-4">
            {content.questions.map((q, i) => (
              <li key={q.id} className="rounded-xl border border-ink/[0.07] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold">{i + 1}. {q.title}</h3>
                  <span className="flex items-center gap-2 text-xs text-ink/50">
                    <span className="badge bg-brand/10 text-brand">{q.competency}</span>
                    <Clock className="h-3.5 w-3.5" />{t("minutes", { n: Math.round((q.timeLimitSec / 60) * 10) / 10 })}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink/75">{q.scenario}</p>
                <p className="mt-2 text-sm font-semibold">{q.prompt}</p>
                <ul className="mt-2 list-disc space-y-0.5 ps-5 text-xs text-ink/55">
                  {q.criteria.map((c) => <li key={c.name}><b>{c.name}:</b> {c.lookFor}</li>)}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
