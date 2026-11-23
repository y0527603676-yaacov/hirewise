import { z } from "zod";
import { MAX_Q, MIN_Q } from "./timing";

/** A situational-judgement question as stored in an assessment */
export const QuestionSchema = z.object({
  id: z.string().min(1).max(12),
  title: z.string().min(2).max(300),
  scenario: z.string().min(40).max(4000),
  prompt: z.string().min(10).max(1000),
  kind: z.preprocess((v) => (String(v).toLowerCase() === "experience" ? "experience" : "scenario"), z.enum(["scenario", "experience"])),
  competency: z.string().min(2).max(160),
  timeLimitSec: z.coerce.number().transform((n) => Math.round(n)),
  criteria: z.array(z.object({ name: z.string().min(1).max(200), lookFor: z.string().min(2).max(1000) })).min(1).transform((a) => a.slice(0, 5)),
});
export type Question = z.infer<typeof QuestionSchema>;

export const AssessmentSchema = z.object({
  intro: z.string().max(2000).default(""),
  questions: z.array(QuestionSchema).min(MIN_Q).transform((a) => a.slice(0, MAX_Q)),
});
export type AssessmentContent = z.infer<typeof AssessmentSchema>;

const score = z.coerce.number().transform((n) => Math.max(0, Math.min(100, Math.round(n))));
export const ReportSchema = z.object({
  overallScore: score,
  competenceScore: score,
  cultureFitScore: score,
  reliabilityScore: score,
  executiveSummary: z.string().min(20).max(5000),
  strengths: z.array(z.object({ title: z.string().max(300), evidence: z.string().max(1500) })).transform((a) => a.slice(0, 6)),
  redFlags: z.array(z.object({ title: z.string().max(300), evidence: z.string().max(1500), severity: z.preprocess((v) => String(v).toLowerCase(), z.enum(["low", "medium", "high"])) })).transform((a) => a.slice(0, 6)),
  recommendedInterviewQuestions: z.array(z.object({ question: z.string().max(1000), why: z.string().max(800) })).min(1).transform((a) => a.slice(0, 6)),
  perQuestion: z.array(z.object({ id: z.string(), score, note: z.string().max(1500) })).transform((a) => a.slice(0, MAX_Q)),
  integrityNote: z.string().max(1500).default(""),
});
export type ReportContent = z.infer<typeof ReportSchema>;

export const ComplianceSchema = z.object({
  issues: z.array(z.object({ field: z.string(), quote: z.string().max(1000), category: z.string(), explanation: z.string().max(1500), suggestion: z.string().max(1500) })).transform((a) => a.slice(0, 20)),
});
export type ComplianceResult = z.infer<typeof ComplianceSchema>;

// JSON schemas handed to the model as tool input schemas (kept in step with the zod schemas above)
const str = { type: "string" };
const num = { type: "number" };
const obj = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: "object", properties, required, additionalProperties: false });
const arr = (items: unknown) => ({ type: "array", items });

export const QUESTION_JSON = obj({
  id: str, kind: { type: "string", enum: ["scenario", "experience"] }, title: str, scenario: str, prompt: str, competency: str, timeLimitSec: { type: "integer" },
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
