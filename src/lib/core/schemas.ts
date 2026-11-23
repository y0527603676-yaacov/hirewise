import { z } from "zod";
import { MAX_Q, MIN_Q } from "./timing";

/** A situational-judgement question as stored in an assessment */
export const QuestionSchema = z.object({
  id: z.string().min(1).max(12),
  title: z.string().min(2).max(140),
  scenario: z.string().min(40).max(1600),
  prompt: z.string().min(10).max(400),
  competency: z.string().min(2).max(80),
  timeLimitSec: z.number().int().min(60).max(400),
  criteria: z.array(z.object({ name: z.string().min(2).max(80), lookFor: z.string().min(5).max(400) })).min(1).max(5),
});
export type Question = z.infer<typeof QuestionSchema>;

export const AssessmentSchema = z.object({
  intro: z.string().max(600).default(""),
  questions: z.array(QuestionSchema).min(MIN_Q).max(MAX_Q),
});
export type AssessmentContent = z.infer<typeof AssessmentSchema>;

const score = z.number().min(0).max(100);
export const ReportSchema = z.object({
  overallScore: score,
  competenceScore: score,
  cultureFitScore: score,
  reliabilityScore: score,
  executiveSummary: z.string().min(20).max(1800),
  strengths: z.array(z.object({ title: z.string().max(140), evidence: z.string().max(600) })).max(6),
  redFlags: z.array(z.object({ title: z.string().max(140), evidence: z.string().max(600), severity: z.enum(["low", "medium", "high"]) })).max(6),
  recommendedInterviewQuestions: z.array(z.object({ question: z.string().max(400), why: z.string().max(300) })).min(2).max(6),
  perQuestion: z.array(z.object({ id: z.string(), score, note: z.string().max(500) })).max(MAX_Q),
  integrityNote: z.string().max(500).default(""),
});
export type ReportContent = z.infer<typeof ReportSchema>;

export const ComplianceSchema = z.object({
  issues: z.array(z.object({ field: z.string(), quote: z.string().max(300), category: z.string(), explanation: z.string().max(500), suggestion: z.string().max(400) })).max(20),
});
export type ComplianceResult = z.infer<typeof ComplianceSchema>;

// JSON schemas handed to the model as tool input schemas (kept in step with the zod schemas above)
const str = { type: "string" };
const num = { type: "number" };
const obj = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: "object", properties, required, additionalProperties: false });
const arr = (items: unknown) => ({ type: "array", items });

export const QUESTION_JSON = obj({
  id: str, title: str, scenario: str, prompt: str, competency: str, timeLimitSec: { type: "integer" },
  criteria: arr(obj({ name: str, lookFor: str })),
});
export const ASSESSMENT_JSON = obj({ intro: str, questions: arr(QUESTION_JSON) });
export const REPORT_JSON = obj({
  overallScore: num, competenceScore: num, cultureFitScore: num, reliabilityScore: num, executiveSummary: str,
  strengths: arr(obj({ title: str, evidence: str })),
  redFlags: arr(obj({ title: str, evidence: str, severity: { type: "string", enum: ["low", "medium", "high"] } })),
  recommendedInterviewQuestions: arr(obj({ question: str, why: str })),
  perQuestion: arr(obj({ id: str, score: num, note: str })),
  integrityNote: str,
});
export const COMPLIANCE_JSON = obj({ issues: arr(obj({ field: str, quote: str, category: str, explanation: str, suggestion: str })) });
