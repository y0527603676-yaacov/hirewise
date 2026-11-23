import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { getDb, newId } from "./db";
import { assessments, candidateSubmissions, jobProfiles, managerQuestionnaires, type Assessment, type JobProfile, type Questionnaire, type User } from "./schema";
import { AssessmentSchema, type AssessmentContent } from "./core/schemas";
import { isJurisdiction, scan, type Jurisdiction } from "./core/compliance";
import { aiEnabled, generateAssessment, judgeCompliance, translateAssessment, type JobInput } from "./ai";
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

/** The assessment in the candidate's language: the base one, or a cached translation of it */
export async function assessmentFor(job: JobProfile, locale: Locale): Promise<Assessment | null> {
  const db = await getDb();
  const [have] = await db.select().from(assessments).where(and(eq(assessments.jobProfileId, job.id), eq(assessments.locale, locale))).limit(1);
  if (have) return have;
  const base = await baseAssessment(job.id);
  if (!base) return null;
  const translated = await translateAssessment(parseAssessment(base), base.locale as Locale, locale);
  const row = { id: newId(), jobProfileId: job.id, locale, isBase: false, questions: JSON.stringify(translated), createdAt: new Date() };
  await db.insert(assessments).values(row).onConflictDoNothing();
  const [saved] = await db.select().from(assessments).where(and(eq(assessments.jobProfileId, job.id), eq(assessments.locale, locale))).limit(1);
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
