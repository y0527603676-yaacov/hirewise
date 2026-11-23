/** The candidate side: starting an assessment, the timed room, integrity events, and finishing. */
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { getDb, newId, rawDb } from "./db";
import { sha } from "./auth";
import { candidates, candidateSubmissions, jobProfiles, users, type Candidate, type JobProfile, type Submission } from "./schema";
import { assessmentFor, parseAssessment } from "./jobs";
import { sync, saveDraft, submit, secondsUsed, type Answers, type RoomState } from "./core/room";
import { effectiveLimit, remaining } from "./core/timing";
import { integrityOf } from "./scoring";
import { background } from "./cf";
import { scheduleEvaluation } from "./evaluation";
import { mailConfigured, mailHtml, sendMail } from "./mail";
import { appUrl } from "./constants";
import { getT, isLocale, type Locale } from "@/i18n";

export const CAND_COOKIE = "hw_cand";
const COOKIE = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 86400 };

export async function jobBySlug(slug: string) {
  if (!/^[a-z0-9]{4,16}$/.test(slug)) return null;
  const db = await getDb();
  const [job] = await db.select().from(jobProfiles).where(eq(jobProfiles.uniqueSlug, slug)).limit(1);
  if (!job) return null;
  const [owner] = await db.select().from(users).where(eq(users.id, job.userId)).limit(1);
  return owner ? { job, owner } : null;
}

export type StartResult = { ok: true } | { ok: false; code: "closed" | "already" | "invalid" | "ai_failed"; fields?: string[] };

/** Starts (or resumes) the assessment for a candidate. One attempt per email per role. */
export async function startAssessment(slug: string, raw: { fullName: string; email: string; phone: string; locale: string; accommodation: boolean; consent: boolean }): Promise<StartResult> {
  const found = await jobBySlug(slug);
  if (!found || found.job.status !== "ACTIVE" || !found.owner.company || !found.owner.contactEmail) return { ok: false, code: "closed" };
  const fullName = raw.fullName.trim().replace(/\s+/g, " ").slice(0, 100);
  const email = raw.email.trim().toLowerCase().slice(0, 160);
  const bad: string[] = [];
  if (fullName.length < 2) bad.push("fullName");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) bad.push("email");
  if (!raw.consent) bad.push("consent");
  if (bad.length) return { ok: false, code: "invalid", fields: bad };
  const locale = (isLocale(raw.locale) ? raw.locale : "en") as Locale;

  const db = await getDb();
  // One attempt per email for this role
  const prev = await db
    .select({ s: candidateSubmissions })
    .from(candidates)
    .innerJoin(candidateSubmissions, eq(candidateSubmissions.candidateId, candidates.id))
    .where(and(eq(candidates.jobProfileId, found.job.id), eq(candidates.email, email)))
    .limit(1);
  if (prev.length) {
    const s = prev[0].s;
    if (s.status !== "IN_PROGRESS") return { ok: false, code: "already" };
    // Resume on this device: issue a fresh cookie for the same attempt (the clock kept running)
    const tok = randomBytes(24).toString("hex");
    await db.update(candidateSubmissions).set({ token: sha(tok) }).where(eq(candidateSubmissions.id, s.id));
    (await cookies()).set(CAND_COOKIE, tok, COOKIE);
    return { ok: true };
  }

  let assessment;
  try {
    assessment = await assessmentFor(found.job, locale);
  } catch {
    return { ok: false, code: "ai_failed" };
  }
  if (!assessment) return { ok: false, code: "closed" };
  const candidateId = newId();
  const now = new Date();
  await db.insert(candidates).values({ id: candidateId, assessmentId: assessment.id, jobProfileId: found.job.id, fullName, email, phone: raw.phone.trim().slice(0, 30) || null, locale, accommodation: raw.accommodation, createdAt: now });
  const tok = randomBytes(24).toString("hex");
  await db.insert(candidateSubmissions).values({ id: newId(), candidateId, assessmentId: assessment.id, jobProfileId: found.job.id, token: sha(tok), briefingAgreedAt: now, status: "IN_PROGRESS" });
  (await cookies()).set(CAND_COOKIE, tok, COOKIE);
  return { ok: true };
}

type Ctx = { sub: Submission; cand: Candidate; job: JobProfile; qs: ReturnType<typeof parseAssessment>["questions"]; intro: string };

async function loadCtx(slug: string): Promise<Ctx | null> {
  const tok = (await cookies()).get(CAND_COOKIE)?.value;
  if (!tok) return null;
  const db = await getDb();
  const [sub] = await db.select().from(candidateSubmissions).where(eq(candidateSubmissions.token, sha(tok))).limit(1);
  if (!sub) return null;
  const [job] = await db.select().from(jobProfiles).where(eq(jobProfiles.id, sub.jobProfileId)).limit(1);
  if (!job || job.uniqueSlug !== slug) return null;
  const [cand] = await db.select().from(candidates).where(eq(candidates.id, sub.candidateId)).limit(1);
  const { assessments } = await import("./schema");
  const [a] = await db.select().from(assessments).where(eq(assessments.id, sub.assessmentId)).limit(1);
  if (!cand || !a) return null;
  const content = parseAssessment(a);
  return { sub, cand, job, qs: content.questions, intro: content.intro || "" };
}

const roomOf = (sub: Submission): RoomState => ({ answers: JSON.parse(sub.answers || "{}") as Answers, index: sub.currentIndex, done: sub.status !== "IN_PROGRESS" });

async function persist(ctx: Ctx, s: RoomState) {
  const db = await getDb();
  const used = ctx.qs.reduce((n, q) => n + secondsUsed(s.answers[q.id]), 0);
  await db
    .update(candidateSubmissions)
    .set({ answers: JSON.stringify(s.answers), currentIndex: s.index, timeSpentSeconds: used, startedAt: ctx.sub.startedAt ?? new Date() })
    .where(and(eq(candidateSubmissions.id, ctx.sub.id), eq(candidateSubmissions.status, "IN_PROGRESS")));
  if (s.done) await finish(ctx, s);
}

export type RoomView =
  | { state: "none" }
  | { state: "done"; name: string; company: string }
  | { state: "question"; index: number; total: number; question: { id: string; title: string; scenario: string; prompt: string }; limit: number; remaining: number; draft: string; keystrokes: number; intro: string };

async function view(ctx: Ctx, s: RoomState): Promise<RoomView> {
  if (s.done || ctx.sub.status !== "IN_PROGRESS") {
    const db = await getDb();
    const [owner] = await db.select().from(users).where(eq(users.id, ctx.job.userId)).limit(1);
    return { state: "done", name: ctx.cand.fullName.split(" ")[0], company: owner?.company || "" };
  }
  const q = ctx.qs[s.index];
  const a = s.answers[q.id];
  const limit = effectiveLimit(q.timeLimitSec, ctx.cand.accommodation);
  return { state: "question", index: s.index, total: ctx.qs.length, question: { id: q.id, title: q.title, scenario: q.scenario, prompt: q.prompt }, limit, remaining: Math.max(0, remaining(a.servedAt, limit)), draft: a.text, keystrokes: a.keystrokes, intro: s.index === 0 ? ctx.intro : "" };
}

export async function roomState(slug: string): Promise<RoomView> {
  const ctx = await loadCtx(slug);
  if (!ctx) return { state: "none" };
  if (ctx.sub.status !== "IN_PROGRESS") return view(ctx, roomOf(ctx.sub));
  const before = roomOf(ctx.sub);
  const s = sync(ctx.qs, before, Date.now(), ctx.cand.accommodation);
  if (JSON.stringify(s) !== JSON.stringify(before) || !ctx.sub.startedAt) await persist(ctx, s);
  return view(ctx, s);
}

export async function roomSave(slug: string, qid: string, text: string, keystrokes: number): Promise<{ ok: boolean }> {
  const ctx = await loadCtx(slug);
  if (!ctx || ctx.sub.status !== "IN_PROGRESS") return { ok: false };
  const now = Date.now();
  const s0 = sync(ctx.qs, roomOf(ctx.sub), now, ctx.cand.accommodation);
  const s = saveDraft(ctx.qs, s0, qid, String(text || ""), Number(keystrokes) || 0, now, ctx.cand.accommodation);
  await persist(ctx, s);
  return { ok: s.answers[qid]?.savedAt === now };
}

export async function roomNext(slug: string, qid: string, text: string, keystrokes: number): Promise<RoomView> {
  const ctx = await loadCtx(slug);
  if (!ctx) return { state: "none" };
  if (ctx.sub.status !== "IN_PROGRESS") return view(ctx, roomOf(ctx.sub));
  const now = Date.now();
  const s0 = sync(ctx.qs, roomOf(ctx.sub), now, ctx.cand.accommodation);
  const s = submit(ctx.qs, s0, qid, String(text || ""), Number(keystrokes) || 0, now, ctx.cand.accommodation);
  await persist(ctx, s);
  return view(ctx, s);
}

export async function roomEvent(slug: string, type: string) {
  const ctx = await loadCtx(slug);
  if (!ctx || ctx.sub.status !== "IN_PROGRESS") return;
  const col = type === "blur" ? "tab_switch_count" : type === "paste" ? "paste_attempt_count" : null;
  if (!col) return;
  const DB = await rawDb();
  await DB.prepare(`UPDATE candidate_submissions SET ${col} = MIN(${col} + 1, 999) WHERE id = ? AND status = 'IN_PROGRESS'`).bind(ctx.sub.id).run();
}

/** Completes the attempt once: integrity flags, employer alert, evaluation scheduling */
async function finish(ctx: Ctx, s: RoomState) {
  const DB = await rawDb();
  const r = await DB.prepare(`UPDATE candidate_submissions SET status = 'COMPLETED', completed_at = ? WHERE id = ? AND status = 'IN_PROGRESS'`).bind(Date.now(), ctx.sub.id).run();
  if (!r.meta?.changes) return;
  const db = await getDb();
  const [fresh] = await db.select().from(candidateSubmissions).where(eq(candidateSubmissions.id, ctx.sub.id)).limit(1);
  const integ = integrityOf(fresh, ctx.qs, ctx.cand.accommodation);
  // Abandoned attempts (fewer than 2 real answers) are kept but not evaluated
  const answered = ctx.qs.filter((q) => (s.answers[q.id]?.text || "").trim().length >= 15).length;
  await db.update(candidateSubmissions).set({ suspiciousActivityFlags: JSON.stringify(integ.flags), status: answered < 2 ? "EXPIRED" : "COMPLETED" }).where(eq(candidateSubmissions.id, ctx.sub.id));
  if (answered < 2) return;
  await scheduleEvaluation(ctx.sub.id);
  const [owner] = await db.select().from(users).where(eq(users.id, ctx.job.userId)).limit(1);
  if (owner && mailConfigured()) {
    const loc = (isLocale(owner.locale) ? owner.locale : "en") as Locale;
    const t = getT(loc);
    const vars = { name: ctx.cand.fullName, role: ctx.job.title };
    background(sendMail({ to: owner.email, subject: t("mailDoneSubject", vars), html: mailHtml(loc, { lines: [t("mailDoneBody", vars)], button: { label: t("mailDoneBtn"), href: `${appUrl()}/app/jobs/${ctx.job.id}` } }) }));
  }
}

/** Scheduler: attempts left open for over 3 hours are closed (their clock ran out long ago) */
export async function closeStaleAttempts() {
  const db = await getDb();
  const stale = await db
    .select()
    .from(candidateSubmissions)
    .where(and(eq(candidateSubmissions.status, "IN_PROGRESS"), sql`${candidateSubmissions.briefingAgreedAt} < ${Date.now() - 3 * 3600_000}`))
    .limit(20);
  for (const sub of stale) {
    const [job] = await db.select().from(jobProfiles).where(eq(jobProfiles.id, sub.jobProfileId)).limit(1);
    const [cand] = await db.select().from(candidates).where(eq(candidates.id, sub.candidateId)).limit(1);
    const { assessments } = await import("./schema");
    const [a] = await db.select().from(assessments).where(eq(assessments.id, sub.assessmentId)).limit(1);
    if (!job || !cand || !a) continue;
    const ctx: Ctx = { sub, cand, job, qs: parseAssessment(a).questions, intro: "" };
    const s = sync(ctx.qs, roomOf(sub), Date.now(), cand.accommodation);
    await persist(ctx, s.done ? s : { ...s, done: true });
  }
}
