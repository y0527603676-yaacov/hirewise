import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

const ts = (name: string) => integer(name, { mode: "timestamp_ms" });

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  company: text("company"),
  contactEmail: text("contact_email"),
  locale: text("locale").notNull().default("en"),
  preferredCurrency: text("preferred_currency").notNull().default("USD"),
  defaultJurisdiction: text("default_jurisdiction").notNull().default("GLOBAL"),
  freeCredits: integer("free_credits").notNull().default(2),
  purchasedCredits: integer("purchased_credits").notNull().default(0),
  totalUsedCredits: integer("total_used_credits").notNull().default(0),
  lockedEvals: integer("locked_evals").notNull().default(0),
  everPurchased: integer("ever_purchased", { mode: "boolean" }).notNull().default(false),
  createdAt: ts("created_at").notNull(),
  lastSeenAt: ts("last_seen_at"),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie value
  userId: text("user_id").notNull(),
  expiresAt: ts("expires_at").notNull(),
});

export const loginTokens = sqliteTable("login_tokens", {
  id: text("id").primaryKey(), // sha256 of the token
  email: text("email").notNull(),
  locale: text("locale").notNull().default("en"),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  createdAt: ts("created_at").notNull(),
});

export const jobProfiles = sqliteTable("job_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  department: text("department"),
  employmentType: text("employment_type").notNull(),
  locationType: text("location_type").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  responsibilities: text("responsibilities").notNull(),
  requiredSkills: text("required_skills").notNull(),
  uniqueSlug: text("unique_slug").notNull().unique(),
  status: text("status").notNull().default("ACTIVE"), // ACTIVE | CLOSED
  baseLocale: text("base_locale").notNull().default("en"),
  createdAt: ts("created_at").notNull(),
});

export const managerQuestionnaires = sqliteTable("manager_questionnaires", {
  id: text("id").primaryKey(),
  jobProfileId: text("job_profile_id").notNull().unique(),
  paceOfWork: text("pace_of_work").notNull(),
  pressureLevel: text("pressure_level").notNull(),
  autonomyVsSupervision: text("autonomy_vs_supervision").notNull(),
  teamDynamics: text("team_dynamics").notNull(),
  criticalTraits: text("critical_traits").notNull(),
  nonNegotiables: text("non_negotiables").notNull(),
  behavioralRedLines: text("behavioral_red_lines").notNull(),
});

export const assessments = sqliteTable(
  "assessments",
  {
    id: text("id").primaryKey(),
    jobProfileId: text("job_profile_id").notNull(),
    locale: text("locale").notNull(),
    isBase: integer("is_base", { mode: "boolean" }).notNull().default(false),
    questions: text("questions").notNull(), // JSON AssessmentContent
    createdAt: ts("created_at").notNull(),
  },
  (t) => [uniqueIndex("assessments_job_locale").on(t.jobProfileId, t.locale)],
);

export const candidates = sqliteTable("candidates", {
  id: text("id").primaryKey(),
  assessmentId: text("assessment_id").notNull(),
  jobProfileId: text("job_profile_id").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  locale: text("locale").notNull(),
  accommodation: integer("accommodation", { mode: "boolean" }).notNull().default(false),
  createdAt: ts("created_at").notNull(),
});

export const candidateSubmissions = sqliteTable("candidate_submissions", {
  id: text("id").primaryKey(),
  candidateId: text("candidate_id").notNull(),
  assessmentId: text("assessment_id").notNull(),
  jobProfileId: text("job_profile_id").notNull(),
  token: text("token").notNull().unique(), // sha256 of the candidate's cookie
  answers: text("answers").notNull().default("{}"), // JSON { [qid]: { text, keystrokes, servedAt, savedAt, submittedAt, timedOut } }
  currentIndex: integer("current_index").notNull().default(0),
  timeSpentSeconds: integer("time_spent_seconds").notNull().default(0),
  tabSwitchCount: integer("tab_switch_count").notNull().default(0),
  pasteAttemptCount: integer("paste_attempt_count").notNull().default(0),
  briefingAgreedAt: ts("briefing_agreed_at").notNull(),
  startedAt: ts("started_at"),
  completedAt: ts("completed_at"),
  suspiciousActivityFlags: text("suspicious_activity_flags").notNull().default("[]"),
  status: text("status").notNull().default("IN_PROGRESS"), // IN_PROGRESS | COMPLETED | EXPIRED
  evalStatus: text("eval_status").notNull().default("NONE"), // NONE | PENDING | RUNNING | DONE | FAILED | DEFERRED
  evalAttempts: integer("eval_attempts").notNull().default(0),
  evalStartedAt: ts("eval_started_at"),
});

export const evaluationReports = sqliteTable("evaluation_reports", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull().unique(),
  userId: text("user_id").notNull(),
  overallScore: integer("overall_score").notNull(),
  competenceScore: integer("competence_score").notNull(),
  cultureFitScore: integer("culture_fit_score").notNull(),
  reliabilityScore: integer("reliability_score").notNull(),
  executiveSummary: text("executive_summary").notNull(),
  strengths: text("strengths").notNull(),
  redFlags: text("red_flags").notNull(),
  recommendedInterviewQuestions: text("recommended_interview_questions").notNull(),
  perQuestion: text("per_question").notNull().default("[]"),
  integrity: text("integrity").notNull().default("{}"),
  reportLocale: text("report_locale").notNull(),
  isUnlocked: integer("is_unlocked", { mode: "boolean" }).notNull().default(false),
  unlockSource: text("unlock_source"),
  unlockedAt: ts("unlocked_at"),
  createdAt: ts("created_at").notNull(),
});

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  provider: text("provider").notNull(), // grow | make | paddle | demo
  stripeSessionId: text("provider_ref"), // the provider's reference (name kept from the spec)
  amount: integer("amount").notNull(), // minor units (cents / agorot)
  currency: text("currency").notNull(),
  pack: text("pack").notNull(),
  creditsAdded: integer("credits_added").notNull(),
  status: text("status").notNull().default("PENDING"), // PENDING | PAID | FAILED
  returnKey: text("return_key").notNull(),
  processId: text("process_id"),
  processToken: text("process_token"),
  createdAt: ts("created_at").notNull(),
  paidAt: ts("paid_at"),
});

export const settings = sqliteTable("settings", { key: text("key").primaryKey(), value: text("value").notNull() });

export type User = typeof users.$inferSelect;
export type JobProfile = typeof jobProfiles.$inferSelect;
export type Questionnaire = typeof managerQuestionnaires.$inferSelect;
export type Assessment = typeof assessments.$inferSelect;
export type Candidate = typeof candidates.$inferSelect;
export type Submission = typeof candidateSubmissions.$inferSelect;
export type Report = typeof evaluationReports.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
