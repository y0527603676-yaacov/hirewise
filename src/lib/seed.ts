/** Demo data for testing (admin button): one employer, one role, three candidates with reports */
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { getDb, newId } from "./db";
import { assessments, candidates, candidateSubmissions, evaluationReports, jobProfiles, managerQuestionnaires, users } from "./schema";
import { SAMPLES } from "./sample";
import { sha } from "./auth";

export async function seedDemo() {
  const db = await getDb();
  const email = "demo@hire.clearwise.me";
  let [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!u) {
    await db.insert(users).values({ id: newId(), email, name: "Demo", company: "Demo Ltd", contactEmail: email, locale: "en", preferredCurrency: "USD", defaultJurisdiction: "GLOBAL", freeCredits: 0, purchasedCredits: 5, createdAt: new Date() });
    [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  }
  const s = SAMPLES.en;
  const jobId = newId();
  const now = Date.now();
  await db.insert(jobProfiles).values({ id: jobId, userId: u.id, title: s.job.title, department: s.job.department, employmentType: "full", locationType: "hybrid", jurisdiction: "GLOBAL", responsibilities: s.job.responsibilities, requiredSkills: s.job.requiredSkills, uniqueSlug: randomBytes(5).toString("hex"), baseLocale: "en", createdAt: new Date(now) });
  await db.insert(managerQuestionnaires).values({ id: newId(), jobProfileId: jobId, paceOfWork: "dynamic", pressureLevel: "high", autonomyVsSupervision: "balanced", teamDynamics: s.job.teamDynamics, criticalTraits: s.job.criticalTraits, nonNegotiables: s.job.nonNegotiables, behavioralRedLines: s.job.behavioralRedLines });
  const aId = newId();
  await db.insert(assessments).values({ id: aId, jobProfileId: jobId, locale: "en", isBase: true, questions: JSON.stringify(s.assessment), createdAt: new Date(now) });
  const people = [
    { name: "Maya Levin", delta: 0, unlocked: true, tabs: 0 },
    { name: "Daniel Cohen", delta: -22, unlocked: true, tabs: 3 },
    { name: "Sara Haddad", delta: -9, unlocked: false, tabs: 1 },
  ];
  for (const [i, p] of people.entries()) {
    const cid = newId();
    const sid = newId();
    let t = now - (i + 1) * 3600_000;
    const answers: Record<string, unknown> = {};
    s.assessment.questions.forEach((q, k) => {
      const text = s.answers[q.id];
      answers[q.id] = { text, keystrokes: text.length * 2, servedAt: t, submittedAt: t + s.seconds[k] * 1000 };
      t += s.seconds[k] * 1000;
    });
    await db.insert(candidates).values({ id: cid, assessmentId: aId, jobProfileId: jobId, fullName: p.name, email: `candidate${i}@example.com`, locale: "en", createdAt: new Date(now - (i + 1) * 3600_000) });
    await db.insert(candidateSubmissions).values({ id: sid, candidateId: cid, assessmentId: aId, jobProfileId: jobId, token: sha(randomBytes(16).toString("hex")), answers: JSON.stringify(answers), currentIndex: 5, timeSpentSeconds: 659, tabSwitchCount: p.tabs, briefingAgreedAt: new Date(now - (i + 1) * 3600_000), startedAt: new Date(now - (i + 1) * 3600_000), completedAt: new Date(t), status: "COMPLETED", evalStatus: "DONE", evalAttempts: 1 });
    const r = s.report;
    const adj = (n: number) => Math.max(0, Math.min(100, n + p.delta));
    await db.insert(evaluationReports).values({
      id: newId(), submissionId: sid, userId: u.id, overallScore: adj(r.overallScore), competenceScore: adj(r.competenceScore), cultureFitScore: adj(r.cultureFitScore), reliabilityScore: adj(r.reliabilityScore),
      executiveSummary: r.executiveSummary, strengths: JSON.stringify(r.strengths), redFlags: JSON.stringify(r.redFlags), recommendedInterviewQuestions: JSON.stringify(r.recommendedInterviewQuestions), perQuestion: JSON.stringify(r.perQuestion),
      integrity: JSON.stringify({ level: p.tabs >= 3 ? "minor" : p.tabs ? "minor" : "clean", flags: p.tabs ? [{ code: "TAB_SWITCH", count: p.tabs }] : [] }),
      reportLocale: "en", isUnlocked: p.unlocked, unlockSource: p.unlocked ? "CREDIT" : null, unlockedAt: p.unlocked ? new Date() : null, createdAt: new Date(),
    });
  }
  return jobId;
}
