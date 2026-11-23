/**
 * Partner connection: another platform of ours (first: TileVision) opens Hirewise accounts for its businesses and
 * runs hiring from inside its own dashboard. Each business = one Hirewise account, found by (partner, externalId).
 * Authentication: headers "x-partner: <name>" and "Authorization: Bearer <key>", the key being the secret
 * PARTNER_KEY_<NAME> on this Worker. Nothing here is reachable without it.
 */
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, getSetting, newId, putSetting } from "./db";
import { candidates, candidateSubmissions, evaluationReports, jobProfiles, loginTokens, users, type User } from "./schema";
import { FREE_REPORTS, balance } from "./core/credits";
import { isJurisdiction } from "./core/compliance";
import { appUrl, PARTNER_EMAIL_DOMAIN } from "./constants";
import { parseAssessment } from "./jobs";
import { secondsUsed, type Answers } from "./core/room";
import { choiceSummary } from "./core/choice";
import { getT, isLocale, LOCALE_NAMES, type Locale } from "@/i18n";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export function partnerFrom(req: Request): string | null {
  const name = String(req.headers.get("x-partner") || "").trim().toLowerCase();
  if (!/^[a-z0-9]{2,20}$/.test(name)) return null;
  const expected = (process.env[`PARTNER_KEY_${name.toUpperCase()}`] || "").trim();
  const got = String(req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!expected || expected.length < 24 || !got) return null;
  const a = Buffer.from(sha(got));
  const b = Buffer.from(sha(expected));
  return timingSafeEqual(a, b) ? name : null;
}

const validExt = (x: unknown) => typeof x === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(x);

export async function findAccount(partner: string, externalId: unknown): Promise<User | null> {
  if (!validExt(externalId)) return null;
  const db = await getDb();
  const [u] = await db.select().from(users).where(and(eq(users.partner, partner), eq(users.externalId, String(externalId)))).limit(1);
  return u ?? null;
}

/** Creates or updates a business's account. Free reports are granted once per business. */
export async function upsertAccount(partner: string, b: { externalId?: unknown; company?: unknown; contactEmail?: unknown; locale?: unknown; jurisdiction?: unknown }): Promise<User | null> {
  if (!validExt(b.externalId)) return null;
  const db = await getDb();
  const company = String(b.company || "").trim().slice(0, 100) || null;
  const contactRaw = String(b.contactEmail || "").trim().toLowerCase();
  const contactEmail = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(contactRaw) ? contactRaw.slice(0, 160) : null;
  const locale = isLocale(b.locale) ? b.locale : "he";
  const jurisdiction = isJurisdiction(b.jurisdiction) ? b.jurisdiction : "IL";
  let u = await findAccount(partner, b.externalId);
  if (!u) {
    const email = `${partner}-${sha(`${partner}|${b.externalId}`).slice(0, 20)}@${PARTNER_EMAIL_DOMAIN}`;
    const grantKey = `free.granted.${sha(email)}`;
    const already = Boolean(await getSetting(grantKey));
    await db.insert(users).values({
      id: newId(), email, partner, externalId: String(b.externalId), company, contactEmail, locale,
      preferredCurrency: locale === "he" ? "ILS" : "USD", defaultJurisdiction: jurisdiction, freeCredits: already ? 0 : FREE_REPORTS, createdAt: new Date(),
    }).onConflictDoNothing();
    if (!already) await putSetting(grantKey, "1");
    u = await findAccount(partner, b.externalId);
  } else {
    const patch: Partial<User> = {};
    if (company && company !== u.company) patch.company = company;
    if (contactEmail && contactEmail !== u.contactEmail) patch.contactEmail = contactEmail;
    if (Object.keys(patch).length) {
      await db.update(users).set(patch).where(eq(users.id, u.id));
      u = { ...u, ...patch };
    }
  }
  return u;
}

export const accountView = (u: User) => ({
  company: u.company,
  contactEmail: u.contactEmail,
  ready: Boolean(u.company && u.contactEmail),
  credits: { free: u.freeCredits, purchased: u.purchasedCredits, left: balance(u), used: u.totalUsedCredits },
});

const link = (slug: string, locale: string) => `${appUrl()}/a/${slug}?lang=${locale}`;

/** All roles of the business with their candidates (teaser data only: name, status, match) */
export async function listJobs(u: User) {
  const db = await getDb();
  const jobs = await db.select().from(jobProfiles).where(eq(jobProfiles.userId, u.id)).orderBy(desc(jobProfiles.createdAt));
  const ids = jobs.map((j) => j.id);
  const rows = ids.length
    ? await db
        .select({ s: candidateSubmissions, c: candidates, r: evaluationReports })
        .from(candidateSubmissions)
        .innerJoin(candidates, eq(candidates.id, candidateSubmissions.candidateId))
        .leftJoin(evaluationReports, eq(evaluationReports.submissionId, candidateSubmissions.id))
        .where(inArray(candidateSubmissions.jobProfileId, ids))
        .orderBy(desc(candidateSubmissions.briefingAgreedAt))
    : [];
  return jobs.map((j) => ({
    id: j.id,
    title: j.title,
    roleKey: j.roleKey,
    status: j.status,
    createdAt: j.createdAt.toISOString(),
    link: j.status === "ACTIVE" ? link(j.uniqueSlug, j.baseLocale) : null,
    candidates: rows
      .filter((x) => x.s.jobProfileId === j.id)
      .map(({ s, c, r }) => ({
        id: s.id,
        name: c.fullName,
        status: s.status,
        evalStatus: s.evalStatus === "FAILED" && s.evalAttempts < 4 ? "PENDING" : s.evalStatus,
        completedAt: s.completedAt?.toISOString() ?? null,
        overall: r?.overallScore ?? null,
        unlocked: Boolean(r?.isUnlocked),
      })),
  }));
}

/** One candidate's report. Locked: name and match only. Unlocked: everything, with labels in the account's language. */
export async function reportView(u: User, subId: string) {
  const db = await getDb();
  const { assessments } = await import("./schema");
  const [row] = await db
    .select({ s: candidateSubmissions, c: candidates, j: jobProfiles, a: assessments })
    .from(candidateSubmissions)
    .innerJoin(candidates, eq(candidates.id, candidateSubmissions.candidateId))
    .innerJoin(jobProfiles, eq(jobProfiles.id, candidateSubmissions.jobProfileId))
    .innerJoin(assessments, eq(assessments.id, candidateSubmissions.assessmentId))
    .where(eq(candidateSubmissions.id, subId))
    .limit(1);
  if (!row || row.j.userId !== u.id) return null;
  const { s, c, j, a } = row;
  const [r] = await db.select().from(evaluationReports).where(eq(evaluationReports.submissionId, subId)).limit(1);
  const loc = (isLocale(u.locale) ? u.locale : "he") as Locale;
  const t = getT(loc);
  const base = {
    id: s.id, name: c.fullName, role: j.title, jobId: j.id,
    answeredIn: isLocale(c.locale) ? LOCALE_NAMES[c.locale] : c.locale,
    status: s.status,
    evalStatus: s.evalStatus === "FAILED" && s.evalAttempts < 4 ? "PENDING" : s.evalStatus,
    completedAt: s.completedAt?.toISOString() ?? null,
    overall: r?.overallScore ?? null,
    unlocked: Boolean(r?.isUnlocked),
  };
  if (!r || !r.isUnlocked) return base;
  const parse = <T,>(x: string, d: T): T => {
    try {
      return JSON.parse(x) as T;
    } catch {
      return d;
    }
  };
  const integ = parse<{ level: "clean" | "minor" | "review"; flags: { code: string; count: number }[]; note?: string; accommodation?: boolean }>(r.integrity, { level: "clean", flags: [] });
  const answers = parse<Answers>(s.answers, {});
  const perQ = parse<{ id: string; score: number; note: string }[]>(r.perQuestion, []);
  const qs = parseAssessment(a).questions;
  return {
    ...base,
    scores: { overall: r.overallScore, competence: r.competenceScore, culture: r.cultureFitScore, reliability: r.reliabilityScore },
    summary: r.executiveSummary,
    strengths: parse<{ title: string; evidence: string }[]>(r.strengths, []),
    redFlags: parse<{ title: string; evidence: string; severity: string }[]>(r.redFlags, []),
    interview: parse<{ question: string; why: string }[]>(r.recommendedInterviewQuestions, []),
    integrity: {
      level: integ.level,
      label: t(integ.level === "clean" ? "intClean" : integ.level === "minor" ? "intMinor" : "intReview"),
      lines: integ.flags.map((f) => t(`flag${f.code}` as never, { n: f.count })),
      note: integ.note || "",
      accommodation: integ.accommodation ? t("accommodationUsed") : "",
      context: t("intContext"),
    },
    questions: qs.map((q) => ({
      id: q.id, kind: q.kind, title: q.title, prompt: q.prompt,
      choice: q.kind === "choice" ? choiceSummary(q.options, answers[q.id]?.choice) : null,
      answer: answers[q.id]?.text || "", seconds: secondsUsed(answers[q.id]), timedOut: Boolean(answers[q.id]?.timedOut),
      score: perQ.find((p) => p.id === q.id)?.score ?? null, note: perQ.find((p) => p.id === q.id)?.note ?? "",
    })),
    disclaimer: t("repHuman"),
  };
}

/** A one-time sign-in link to the business's full Hirewise account (buying reports, editing questions). 10 minutes, one use. */
export async function signInLink(u: User, next: string): Promise<string> {
  const token = randomBytes(24).toString("hex");
  const db = await getDb();
  await db.insert(loginTokens).values({ id: sha(token), email: u.email, locale: u.locale, expiresAt: new Date(Date.now() + 10 * 60_000), createdAt: new Date() });
  const safeNext = /^\/app(\/[A-Za-z0-9/_-]*)?$/.test(next) ? next : "/app";
  return `${appUrl()}/auth/${token}?next=${encodeURIComponent(safeNext)}`;
}
