import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { Plus, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { candidates, candidateSubmissions, evaluationReports, jobProfiles } from "@/lib/schema";
import { fmtDate, userLocale, userT } from "@/lib/view";
import { Notice } from "@/components/ui";
import { StatusBadge } from "@/components/status";

export default async function Dashboard() {
  const user = await requireUser();
  const t = userT(user);
  const locale = userLocale(user);
  const db = await getDb();
  const jobs = await db.select().from(jobProfiles).where(eq(jobProfiles.userId, user.id)).orderBy(desc(jobProfiles.createdAt));
  const ids = jobs.map((j) => j.id);
  const subs = ids.length
    ? await db
        .select({ s: candidateSubmissions, c: candidates, r: evaluationReports })
        .from(candidateSubmissions)
        .innerJoin(candidates, eq(candidates.id, candidateSubmissions.candidateId))
        .leftJoin(evaluationReports, eq(evaluationReports.submissionId, candidateSubmissions.id))
        .where(inArray(candidateSubmissions.jobProfileId, ids))
        .orderBy(desc(candidateSubmissions.briefingAgreedAt))
    : [];
  const count = (jobId: string) => subs.filter((x) => x.s.jobProfileId === jobId).length;
  const setup = !user.company || !user.contactEmail;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="h1">{t("dashTitle")}</h1>
          <p className="mt-1 text-sm text-ink/55">
            {t("creditsFree", { n: user.freeCredits })} · {t("creditsPaid", { n: user.purchasedCredits })} ·{" "}
            <Link href="/app/wallet" className="font-semibold text-brand hover:underline">{t("buyCredits")}</Link>
          </p>
        </div>
        <Link href="/app/jobs/new" className="btn-primary"><Plus className="h-4 w-4" />{t("newJob")}</Link>
      </div>

      {setup && (
        <Notice tone="warn">
          {t("setupNeeded")} <Link href="/app/settings" className="font-semibold underline">{t("goSettings")}</Link>
        </Notice>
      )}

      {jobs.length === 0 ? (
        <div className="card py-12 text-center">
          <p className="mx-auto max-w-md text-ink/60">{t("noJobs")}</p>
          <Link href="/app/jobs/new" className="btn-primary mt-5"><Plus className="h-4 w-4" />{t("newJob")}</Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((j) => (
            <Link key={j.id} href={`/app/jobs/${j.id}`} className="card block transition hover:-translate-y-0.5 hover:border-brand/30">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-bold leading-snug">{j.title}</h2>
                <span className={`badge ${j.status === "ACTIVE" ? "bg-mint/10 text-mint" : j.status === "FAILED" ? "bg-red-50 text-red-700" : j.status === "GENERATING" ? "bg-indigo-50 text-brand" : "bg-ink/5 text-ink/50"}`}>{t(`jobStatus${j.status}` as never)}</span>
              </div>
              {j.department && <p className="mt-0.5 text-sm text-ink/50">{j.department}</p>}
              <p className="mt-4 flex items-center gap-1.5 text-sm text-ink/60"><Users className="h-4 w-4" />{t("jobCandidates", { n: count(j.id) })}</p>
            </Link>
          ))}
        </div>
      )}

      {subs.length > 0 && (
        <div className="card p-0">
          <h2 className="h2 px-5 pt-5">{t("recentTitle")}</h2>
          <ul className="mt-3 divide-y divide-ink/[0.06]">
            {subs.slice(0, 8).map(({ s, c, r }) => {
              const job = jobs.find((j) => j.id === s.jobProfileId)!;
              return (
                <li key={s.id}>
                  <Link href={`/app/reports/${s.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-mist">
                    <div>
                      <div className="font-semibold">{c.fullName}</div>
                      <div className="text-xs text-ink/50">{job.title} · {fmtDate(s.completedAt ?? s.briefingAgreedAt, locale)}</div>
                    </div>
                    <StatusBadge t={t} sub={s} report={r} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
