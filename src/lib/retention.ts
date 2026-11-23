/** Data retention: candidate data is deleted after RETENTION_MONTHS; expired login data is cleaned. Runs once a day. */
import { lt, or, isNotNull, and } from "drizzle-orm";
import { getDb, getSetting, putSetting, rawDb } from "./db";
import { candidateSubmissions, loginTokens, sessions } from "./schema";
import { retentionMonths } from "./constants";
import { deleteSubmission } from "./evaluation";

export async function dailyCleanup(force = false) {
  const last = Number(await getSetting("cleanup.last")) || 0;
  if (!force && Date.now() - last < 20 * 3600_000) return { skipped: true };
  await putSetting("cleanup.last", String(Date.now()));
  const db = await getDb();
  const cutoff = new Date(Date.now() - retentionMonths() * 30.44 * 86400_000);
  const old = await db.select({ id: candidateSubmissions.id }).from(candidateSubmissions).where(lt(candidateSubmissions.briefingAgreedAt, cutoff)).limit(500);
  for (const o of old) await deleteSubmission(o.id);
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  await db.delete(loginTokens).where(or(lt(loginTokens.expiresAt, new Date(Date.now() - 86400_000)), and(isNotNull(loginTokens.usedAt), lt(loginTokens.createdAt, new Date(Date.now() - 86400_000)))));
  // Abandoned checkouts older than 30 days
  const DB = await rawDb();
  await DB.prepare(`DELETE FROM transactions WHERE status = 'PENDING' AND created_at < ?`).bind(Date.now() - 30 * 86400_000).run();
  return { deleted: old.length };
}

/** Deletes an employer account and everything under it */
export async function deleteAccount(userId: string) {
  const DB = await rawDb();
  const subs = await DB.prepare(`SELECT s.id FROM candidate_submissions s JOIN job_profiles j ON j.id = s.job_profile_id WHERE j.user_id = ?`).bind(userId).all<{ id: string }>();
  for (const s of subs.results) await deleteSubmission(s.id);
  await DB.batch([
    DB.prepare(`DELETE FROM assessments WHERE job_profile_id IN (SELECT id FROM job_profiles WHERE user_id = ?)`).bind(userId),
    DB.prepare(`DELETE FROM manager_questionnaires WHERE job_profile_id IN (SELECT id FROM job_profiles WHERE user_id = ?)`).bind(userId),
    DB.prepare(`DELETE FROM job_profiles WHERE user_id = ?`).bind(userId),
    DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(userId),
    DB.prepare(`DELETE FROM users WHERE id = ?`).bind(userId),
  ]);
  // Transactions are kept (accounting), without the link to a person beyond the internal id
}
