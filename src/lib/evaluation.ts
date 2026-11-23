/** Candidate evaluation pipeline and credit accounting. */
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { delSetting, getDb, getSetting, newId, putSetting, rawDb } from "./db";
import { candidates, candidateSubmissions, evaluationReports, jobProfiles, users, type User } from "./schema";
import { evalDecision, manualUnlockSource } from "./core/credits";
import { secondsUsed, type Answers } from "./core/room";
import { evaluate } from "./ai";
import { getJobFull, parseAssessment, toJobInput } from "./jobs";
import { integrityOf } from "./scoring";
import { noteOps } from "./mail";
import { isLocale, type Locale } from "@/i18n";

const MAX_ATTEMPTS = 4;
/**
 * An evaluation takes about 30-60 seconds. Work started "in the background" after a response is cut off by
 * Cloudflare after 30 seconds, so evaluations run only where they can finish: the scheduler (every minute) or a
 * request that waits for the result (the employer's report page). A run that stopped midway is retaken after this:
 */
const STALE_MS = 150_000;
const wallet = (u: User) => ({ freeCredits: u.freeCredits, purchasedCredits: u.purchasedCredits, lockedEvals: u.lockedEvals, everPurchased: u.everPurchased });

/** Called once when an attempt completes: evaluate now, or wait for an unlock (cost cap) */
export async function scheduleEvaluation(subId: string) {
  const db = await getDb();
  const [sub] = await db.select().from(candidateSubmissions).where(eq(candidateSubmissions.id, subId)).limit(1);
  if (!sub) return;
  const [job] = await db.select().from(jobProfiles).where(eq(jobProfiles.id, sub.jobProfileId)).limit(1);
  const [owner] = job ? await db.select().from(users).where(eq(users.id, job.userId)).limit(1) : [];
  if (!owner) return;
  const decision = evalDecision(wallet(owner));
  // The scheduler picks it up within a minute; the employer's report page runs it at once if open
  await db.update(candidateSubmissions).set({ evalStatus: decision === "evaluate" ? "PENDING" : "DEFERRED" }).where(eq(candidateSubmissions.id, subId));
}

/** Atomically takes 1 credit of the given kind. Returns false when none is left. */
async function takeCredit(userId: string, kind: "FREE" | "CREDIT"): Promise<boolean> {
  const DB = await rawDb();
  const col = kind === "FREE" ? "free_credits" : "purchased_credits";
  const r = await DB.prepare(`UPDATE users SET ${col} = ${col} - 1, total_used_credits = total_used_credits + 1 WHERE id = ? AND ${col} > 0`).bind(userId).run();
  return Boolean(r.meta?.changes);
}
async function refundCredit(userId: string, kind: "FREE" | "CREDIT") {
  const DB = await rawDb();
  const col = kind === "FREE" ? "free_credits" : "purchased_credits";
  await DB.prepare(`UPDATE users SET ${col} = ${col} + 1, total_used_credits = MAX(total_used_credits - 1, 0) WHERE id = ?`).bind(userId).run();
}

/** Runs one evaluation. Safe to call concurrently: only one caller claims the attempt. */
export async function runEvaluation(subId: string): Promise<"done" | "skipped" | "failed"> {
  const DB = await rawDb();
  const claim = await DB.prepare(
    `UPDATE candidate_submissions SET eval_status = 'RUNNING', eval_started_at = ?, eval_attempts = eval_attempts + 1
     WHERE id = ? AND eval_attempts < ? AND (eval_status IN ('PENDING', 'FAILED') OR (eval_status = 'RUNNING' AND eval_started_at < ?))`,
  )
    .bind(Date.now(), subId, MAX_ATTEMPTS, Date.now() - STALE_MS)
    .run();
  if (!claim.meta?.changes) return "skipped";
  const db = await getDb();
  const [sub] = await db.select().from(candidateSubmissions).where(eq(candidateSubmissions.id, subId)).limit(1);
  const [cand] = sub ? await db.select().from(candidates).where(eq(candidates.id, sub.candidateId)).limit(1) : [];
  const full = sub ? await getJobFull(sub.jobProfileId) : null;
  const [owner] = full ? await db.select().from(users).where(eq(users.id, full.job.userId)).limit(1) : [];
  const { assessments } = await import("./schema");
  const [a] = sub ? await db.select().from(assessments).where(eq(assessments.id, sub.assessmentId)).limit(1) : [];
  if (!sub || !cand || !full || !owner || !a) return "skipped";
  try {
    const qs = parseAssessment(a).questions;
    const answers = JSON.parse(sub.answers || "{}") as Answers;
    const integ = integrityOf(sub, qs, cand.accommodation);
    const reportLocale = (isLocale(owner.locale) ? owner.locale : "en") as Locale;
    const content = await evaluate({
      job: toJobInput({ ...full.job, ...full.q }),
      questions: qs,
      answers: qs.map((q) => ({ id: q.id, text: answers[q.id]?.text || "", secondsUsed: secondsUsed(answers[q.id]), timedOut: Boolean(answers[q.id]?.timedOut) })),
      candidateLocale: (isLocale(cand.locale) ? cand.locale : "en") as Locale,
      reportLocale,
      integritySummary: JSON.stringify({ level: integ.level, flags: integ.flags, extendedTimeForAccessibility: cand.accommodation }),
    });

    // Who pays: a credit reserved at unlock time (deferred reports), else a free credit, else it stays locked
    const prepaid = (await getSetting(`prepaid.${subId}`)) as "FREE" | "CREDIT" | null;
    let unlockSource: "FREE" | "CREDIT" | null = prepaid;
    if (!unlockSource && (await takeCredit(owner.id, "FREE"))) unlockSource = "FREE";
    await db.insert(evaluationReports).values({
      id: newId(), submissionId: subId, userId: owner.id,
      overallScore: content.overallScore, competenceScore: content.competenceScore, cultureFitScore: content.cultureFitScore, reliabilityScore: content.reliabilityScore,
      executiveSummary: content.executiveSummary, strengths: JSON.stringify(content.strengths), redFlags: JSON.stringify(content.redFlags),
      recommendedInterviewQuestions: JSON.stringify(content.recommendedInterviewQuestions), perQuestion: JSON.stringify(content.perQuestion),
      integrity: JSON.stringify({ ...integ, note: content.integrityNote, accommodation: cand.accommodation }), reportLocale,
      isUnlocked: Boolean(unlockSource), unlockSource, unlockedAt: unlockSource ? new Date() : null, createdAt: new Date(),
    }).onConflictDoNothing();
    if (prepaid) await delSetting(`prepaid.${subId}`);
    if (!unlockSource && !owner.everPurchased) await DB.prepare(`UPDATE users SET locked_evals = locked_evals + 1 WHERE id = ?`).bind(owner.id).run();
    await db.update(candidateSubmissions).set({ evalStatus: "DONE" }).where(eq(candidateSubmissions.id, subId));
    return "done";
  } catch (e) {
    const [now] = await db.select().from(candidateSubmissions).where(eq(candidateSubmissions.id, subId)).limit(1);
    await db.update(candidateSubmissions).set({ evalStatus: "FAILED" }).where(eq(candidateSubmissions.id, subId));
    if ((now?.evalAttempts ?? MAX_ATTEMPTS) >= MAX_ATTEMPTS) {
      // Out of attempts: give back any credit reserved for this report
      const prepaid = (await getSetting(`prepaid.${subId}`)) as "FREE" | "CREDIT" | null;
      if (prepaid) {
        await refundCredit(owner.id, prepaid);
        await delSetting(`prepaid.${subId}`);
      }
      await noteOps("evaluation", `submission ${subId.slice(0, 8)}: ${String((e as Error)?.message || e).slice(0, 200)}`);
    }
    return "failed";
  }
}

export type UnlockResult = "ok" | "no_credits" | "not_found" | "already";

/** Opens a locked report (or a deferred evaluation) for 1 credit: free credits first, then purchased */
export async function unlockSubmission(user: User, subId: string): Promise<UnlockResult> {
  const db = await getDb();
  const [row] = await db
    .select({ sub: candidateSubmissions, job: jobProfiles })
    .from(candidateSubmissions)
    .innerJoin(jobProfiles, eq(jobProfiles.id, candidateSubmissions.jobProfileId))
    .where(eq(candidateSubmissions.id, subId))
    .limit(1);
  if (!row || row.job.userId !== user.id) return "not_found";
  const [report] = await db.select().from(evaluationReports).where(eq(evaluationReports.submissionId, subId)).limit(1);
  if (report?.isUnlocked) return "already";
  const [fresh] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  const source = manualUnlockSource(wallet(fresh));
  if (!source || !(await takeCredit(user.id, source))) return "no_credits";
  if (report) {
    const DB = await rawDb();
    const r = await DB.prepare(`UPDATE evaluation_reports SET is_unlocked = 1, unlock_source = ?, unlocked_at = ? WHERE id = ? AND is_unlocked = 0`).bind(source, Date.now(), report.id).run();
    if (!r.meta?.changes) await refundCredit(user.id, source);
    return "ok";
  }
  // No report yet (deferred or failed): reserve the credit and evaluate now
  if (await getSetting(`prepaid.${subId}`)) {
    await refundCredit(user.id, source);
    return "already";
  }
  await putSetting(`prepaid.${subId}`, source);
  await db.update(candidateSubmissions).set({ evalStatus: "PENDING", evalAttempts: 0 }).where(and(eq(candidateSubmissions.id, subId), inArray(candidateSubmissions.evalStatus, ["DEFERRED", "FAILED"])));
  return "ok";
}

/** Employer asks to retry a failed evaluation */
export async function retryEvaluation(user: User, subId: string) {
  const db = await getDb();
  const [row] = await db.select({ sub: candidateSubmissions, job: jobProfiles }).from(candidateSubmissions).innerJoin(jobProfiles, eq(jobProfiles.id, candidateSubmissions.jobProfileId)).where(eq(candidateSubmissions.id, subId)).limit(1);
  if (!row || row.job.userId !== user.id || row.sub.evalStatus !== "FAILED") return;
  await db.update(candidateSubmissions).set({ evalStatus: "PENDING", evalAttempts: 0 }).where(eq(candidateSubmissions.id, subId));
  return runEvaluation(subId);
}

/** Scheduler: re-queue evaluations stuck in RUNNING, retry failures, run pending ones */
export async function processPending(limit = 4) {
  const db = await getDb();
  await db
    .update(candidateSubmissions)
    .set({ evalStatus: "PENDING" })
    .where(and(eq(candidateSubmissions.evalStatus, "RUNNING"), lt(candidateSubmissions.evalStartedAt, new Date(Date.now() - STALE_MS))));
  const todo = await db
    .select({ id: candidateSubmissions.id })
    .from(candidateSubmissions)
    .where(and(inArray(candidateSubmissions.evalStatus, ["PENDING", "FAILED"]), sql`${candidateSubmissions.evalAttempts} < ${MAX_ATTEMPTS}`))
    .limit(limit);
  const out: string[] = [];
  for (const t of todo) out.push(await runEvaluation(t.id));
  return out;
}

/** Deletes one candidate's data (employer request or candidate request) */
export async function deleteSubmission(subId: string) {
  const db = await getDb();
  const [sub] = await db.select().from(candidateSubmissions).where(eq(candidateSubmissions.id, subId)).limit(1);
  if (!sub) return;
  await db.delete(evaluationReports).where(eq(evaluationReports.submissionId, subId));
  await db.delete(candidateSubmissions).where(eq(candidateSubmissions.id, subId));
  await db.delete(candidates).where(eq(candidates.id, sub.candidateId));
  await delSetting(`prepaid.${subId}`);
}
