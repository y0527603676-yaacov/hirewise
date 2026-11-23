import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { getDb, newId } from "./db";
import { assessments, candidateSubmissions, jobProfiles, managerQuestionnaires, type Assessment, type JobProfile, type Questionnaire, type User } from "./schema";
import { AssessmentSchema, type AssessmentContent } from "./core/schemas";
import { isJurisdiction, scan, type Jurisdiction } from "./core/compliance";
import { aiEnabled, GENDERED, generateAssessment, judgeCompliance, translateAssessment, type Address, type JobInput } from "./ai";
import { isLocale, type Locale } from "@/i18n";

export const EMPLOYMENT_TYPES = ["full", "part", "contract", "intern"] as const;
export const LOCATION_TYPES = ["onsite", "hybrid", "remote"] as const;
export const PACE = ["steady", "dynamic", "intense"] as const;
export const PRESSURE = ["low", "medium", "high"] as const;
export const AUTONOMY = ["close", "balanced", "full"] as const;

export const TEXT_FIELDS = ["title", "department", "responsibilities", "requiredSkills", "teamDynamics", "criticalTraits", "nonNegotiables", "behavioralRedLines"] as const;
export type TextField = (typeof TEXT_FIELDS)[number];
const REQUIRED: TextField[] = ["title", "responsibilities", "requiredSkills", "criticalTraits", "behavioralRedLines"];
const MAX_LEN: Record<TextField, number> = { title: 120, department: 80, responsibilities: 2000, requiredSkills: 1500, teamDynamics: 1500, criticalTraits: 1500, nonNegotiables: 1500, behavioralRedLines: 1500 };

export type JobForm = Record<TextField, string> & {
  employmentType: string; locationType: string; jurisdiction: string; paceOfWork: string; pressureLevel: string; autonomyVsSupervision: string;
};

export type JobFormResult =
  | { ok: true; jobId: string }
  | { ok: false; code: "missing"; fields: TextField[] }
  | { ok: false; code: "compliance"; issues: { field: string; quote: string; category: string; explanation: string; suggestion: string }[]; jurisdiction: Jurisdiction }
  | { ok: false; code: "ai_off" | "ai_failed" };

const pick = <T extends readonly string[]>(list: T, v: string, dflt: T[number]): T[number] => (list.includes(v) ? v : dflt);

export function cleanForm(raw: Record<string, unknown>): JobForm {
  const f = {} as JobForm;
  for (const k of TEXT_FIELDS) f[k] = String(raw[k] ?? "").replace(/\s+\n/g, "\n").trim().slice(0, MAX_LEN[k]);
  f.employmentType = pick(EMPLOYMENT_TYPES, String(raw.employmentType), "full");
  f.locationType = pick(LOCATION_TYPES, String(raw.locationType), "onsite");
  f.jurisdiction = isJurisdiction(raw.jurisdiction) ? String(raw.jurisdiction) : "GLOBAL";
  f.paceOfWork = pick(PACE, String(raw.paceOfWork), "dynamic");
  f.pressureLevel = pick(PRESSURE, String(raw.pressureLevel), "medium");
  f.autonomyVsSupervision = pick(AUTONOMY, String(raw.autonomyVsSupervision), "balanced");
  return f;
}

export const toJobInput = (f: JobForm | (JobProfile & Questionnaire)): JobInput => ({
  title: f.title, department: f.department, employmentType: f.employmentType, locationType: f.locationType, jurisdiction: f.jurisdiction as Jurisdiction,
  responsibilities: f.responsibilities, requiredSkills: f.requiredSkills, paceOfWork: f.paceOfWork, pressureLevel: f.pressureLevel,
  autonomyVsSupervision: f.autonomyVsSupervision, teamDynamics: f.teamDynamics || "-", criticalTraits: f.criticalTraits, nonNegotiables: f.nonNegotiables || "-", behavioralRedLines: f.behavioralRedLines,
});

/** Compliance check: keyword scan, then (only on hits) an AI judgement in context. Fails closed without AI. */
export async function checkCompliance(f: JobForm, locale: Locale) {
  const fields: Record<string, string> = {};
  for (const k of TEXT_FIELDS) fields[k] = f[k];
  const hits = scan(fields);
  if (!hits.length) return [];
  if (!aiEnabled()) return hits.map((h) => ({ field: h.field, quote: h.term, category: h.category, explanation: "", suggestion: "" }));
  try {
    return (await judgeCompliance(fields, hits, f.jurisdiction as Jurisdiction, locale)).issues.filter((i) => (TEXT_FIELDS as readonly string[]).includes(i.field));
  } catch {
    return hits.map((h) => ({ field: h.field, quote: h.term, category: h.category, explanation: "", suggestion: "" }));
  }
}

const newSlug = () => randomBytes(6).toString("base64url").replace(/[-_]/g, "x").toLowerCase();

/** Creates a role: validation → compliance → AI-written assessment (in the employer's language) → saved */
export async function createJob(user: User, raw: Record<string, unknown>): Promise<JobFormResult> {
  const f = cleanForm(raw);
  const missing = REQUIRED.filter((k) => f[k].length < 2);
  if (missing.length) return { ok: false, code: "missing", fields: missing };
  const locale = (isLocale(user.locale) ? user.locale : "en") as Locale;
  const issues = await checkCompliance(f, locale);
  if (issues.length) return { ok: false, code: "compliance", issues, jurisdiction: f.jurisdiction as Jurisdiction };
  if (!aiEnabled()) return { ok: false, code: "ai_off" };
  let content: AssessmentContent;
  try {
    content = await generateAssessment(toJobInput(f), locale);
  } catch {
    return { ok: false, code: "ai_failed" };
  }
  const db = await getDb();
  const jobId = newId();
  const now = new Date();
  await db.insert(jobProfiles).values({
    id: jobId, userId: user.id, title: f.title, department: f.department || null, employmentType: f.employmentType, locationType: f.locationType,
    jurisdiction: f.jurisdiction, responsibilities: f.responsibilities, requiredSkills: f.requiredSkills, uniqueSlug: newSlug(), baseLocale: locale, createdAt: now,
  });
  await db.insert(managerQuestionnaires).values({
    id: newId(), jobProfileId: jobId, paceOfWork: f.paceOfWork, pressureLevel: f.pressureLevel, autonomyVsSupervision: f.autonomyVsSupervision,
    teamDynamics: f.teamDynamics, criticalTraits: f.criticalTraits, nonNegotiables: f.nonNegotiables, behavioralRedLines: f.behavioralRedLines,
  });
  await db.insert(assessments).values({ id: newId(), jobProfileId: jobId, locale, isBase: true, questions: JSON.stringify(content), createdAt: now });
  return { ok: true, jobId };
}

export async function getJobFull(jobId: string) {
  const db = await getDb();
  const [job] = await db.select().from(jobProfiles).where(eq(jobProfiles.id, jobId)).limit(1);
  if (!job) return null;
  const [q] = await db.select().from(managerQuestionnaires).where(eq(managerQuestionnaires.jobProfileId, jobId)).limit(1);
  if (!q) return null;
  return { job, q };
}

export async function getOwnedJob(user: User, jobId: string) {
  const full = await getJobFull(jobId);
  return full && full.job.userId === user.id ? full : null;
}

export const parseAssessment = (a: Assessment): AssessmentContent => AssessmentSchema.parse(JSON.parse(a.questions));

export async function baseAssessment(jobId: string): Promise<Assessment | null> {
  const db = await getDb();
  const [a] = await db.select().from(assessments).where(and(eq(assessments.jobProfileId, jobId), eq(assessments.isBase, true))).limit(1);
  return a ?? null;
}

/**
 * The assessment in the candidate's language: the base one, or a cached translation of it.
 * In gendered languages (Hebrew, Arabic) a candidate may choose masculine or feminine wording: cached as "he-m" / "he-f".
 * The choice only changes grammar; it is never passed to the evaluation.
 */
export async function assessmentFor(job: JobProfile, locale: Locale, address?: Address | null): Promise<Assessment | null> {
  const gendered = Boolean(address && GENDERED.includes(locale));
  const key = gendered ? `${locale}-${address}` : locale;
  const db = await getDb();
  const [have] = await db.select().from(assessments).where(and(eq(assessments.jobProfileId, job.id), eq(assessments.locale, key))).limit(1);
  if (have) return have;
  const base = await baseAssessment(job.id);
  if (!base) return null;
  if (!gendered && base.locale === locale) return base;
  const translated = await translateAssessment(parseAssessment(base), base.locale as Locale, locale, gendered ? address! : undefined);
  const row = { id: newId(), jobProfileId: job.id, locale: key, isBase: false, questions: JSON.stringify(translated), createdAt: new Date() };
  await db.insert(assessments).values(row).onConflictDoNothing();
  const [saved] = await db.select().from(assessments).where(and(eq(assessments.jobProfileId, job.id), eq(assessments.locale, key))).limit(1);
  return saved ?? null;
}

export async function hasSubmissions(jobId: string) {
  const db = await getDb();
  const r = await db.select({ id: candidateSubmissions.id }).from(candidateSubmissions).where(eq(candidateSubmissions.jobProfileId, jobId)).limit(1);
  return r.length > 0;
}

/** Rewrites the questions, only while no candidate has started (so reports stay comparable) */
export async function regenerate(user: User, jobId: string): Promise<"ok" | "locked" | "ai_failed" | "not_found"> {
  const full = await getOwnedJob(user, jobId);
  if (!full) return "not_found";
  if (await hasSubmissions(jobId)) return "locked";
  const locale = (isLocale(user.locale) ? user.locale : full.job.baseLocale) as Locale;
  let content: AssessmentContent;
  try {
    content = await generateAssessment(toJobInput({ ...full.job, ...full.q }), locale);
  } catch {
    return "ai_failed";
  }
  const db = await getDb();
  await db.delete(assessments).where(eq(assessments.jobProfileId, jobId));
  await db.insert(assessments).values({ id: newId(), jobProfileId: jobId, locale, isBase: true, questions: JSON.stringify(content), createdAt: new Date() });
  await db.update(jobProfiles).set({ baseLocale: locale }).where(eq(jobProfiles.id, jobId));
  return "ok";
}

// ---------- Roles created without waiting (partner API): questions are written in the background ----------

/** Validates and checks compliance now; the AI writes the questions in the background (see generateForJob). */
export async function createJobPending(user: User, raw: Record<string, unknown>, roleKey?: string): Promise<JobFormResult> {
  const f = cleanForm(raw);
  const missing = REQUIRED.filter((k) => f[k].length < 2);
  if (missing.length) return { ok: false, code: "missing", fields: missing };
  const locale = (isLocale(user.locale) ? user.locale : "he") as Locale;
  const issues = await checkCompliance(f, locale);
  if (issues.length) return { ok: false, code: "compliance", issues, jurisdiction: f.jurisdiction as Jurisdiction };
  if (!aiEnabled()) return { ok: false, code: "ai_off" };
  const db = await getDb();
  const jobId = newId();
  await db.insert(jobProfiles).values({
    id: jobId, userId: user.id, title: f.title, department: f.department || null, employmentType: f.employmentType, locationType: f.locationType,
    jurisdiction: f.jurisdiction, responsibilities: f.responsibilities, requiredSkills: f.requiredSkills, uniqueSlug: newSlug(), baseLocale: locale,
    status: "GENERATING", roleKey: roleKey ? String(roleKey).slice(0, 40) : null, createdAt: new Date(),
  });
  await db.insert(managerQuestionnaires).values({
    id: newId(), jobProfileId: jobId, paceOfWork: f.paceOfWork, pressureLevel: f.pressureLevel, autonomyVsSupervision: f.autonomyVsSupervision,
    teamDynamics: f.teamDynamics, criticalTraits: f.criticalTraits, nonNegotiables: f.nonNegotiables, behavioralRedLines: f.behavioralRedLines,
  });
  // Written by the scheduler within a minute (background work after a response is cut off at 30 seconds)
  return { ok: true, jobId };
}

const GEN_MAX_ATTEMPTS = 3;

/** Writes the questions for a GENERATING role. Only one caller claims it; a claim older than 2.5 minutes may be retaken. */
export async function generateForJob(jobId: string): Promise<"done" | "skipped" | "failed"> {
  const { rawDb } = await import("./db");
  const DB = await rawDb();
  const now = Date.now();
  const claim = await DB.prepare(
    `UPDATE job_profiles SET gen_started_at = ?, gen_attempts = gen_attempts + 1
     WHERE id = ? AND status = 'GENERATING' AND gen_attempts < ? AND (gen_started_at IS NULL OR gen_started_at < ?)`,
  )
    .bind(now, jobId, GEN_MAX_ATTEMPTS, now - 150_000)
    .run();
  if (!claim.meta?.changes) return "skipped";
  const full = await getJobFull(jobId);
  if (!full) return "skipped";
  const db = await getDb();
  try {
    const content = await generateAssessment(toJobInput({ ...full.job, ...full.q }), (isLocale(full.job.baseLocale) ? full.job.baseLocale : "he") as Locale);
    await db.delete(assessments).where(eq(assessments.jobProfileId, jobId));
    await db.insert(assessments).values({ id: newId(), jobProfileId: jobId, locale: full.job.baseLocale, isBase: true, questions: JSON.stringify(content), createdAt: new Date() });
    await db.update(jobProfiles).set({ status: "ACTIVE" }).where(eq(jobProfiles.id, jobId));
    return "done";
  } catch {
    const [j] = await db.select().from(jobProfiles).where(eq(jobProfiles.id, jobId)).limit(1);
    // Let the next run retry right away; after the last attempt the role is marked as failed
    await db.update(jobProfiles).set({ genStartedAt: null, status: (j?.genAttempts ?? GEN_MAX_ATTEMPTS) >= GEN_MAX_ATTEMPTS ? "FAILED" : "GENERATING" }).where(eq(jobProfiles.id, jobId));
    return "failed";
  }
}

/** Scheduler: writes questions for roles still waiting */
export async function processPendingJobs(limit = 3) {
  const db = await getDb();
  const rows = await db.select({ id: jobProfiles.id }).from(jobProfiles).where(eq(jobProfiles.status, "GENERATING")).limit(limit);
  const out: string[] = [];
  for (const r of rows) out.push(await generateForJob(r.id));
  return out;
}

/** Retry a role whose question writing failed */
export async function retryGeneration(jobId: string) {
  const db = await getDb();
  await db.update(jobProfiles).set({ status: "GENERATING", genAttempts: 0, genStartedAt: null }).where(and(eq(jobProfiles.id, jobId), eq(jobProfiles.status, "FAILED")));
  return generateForJob(jobId);
}
