import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "crypto";
import { mergePrices, DEFAULT_PRICES, PACK_CREDITS } from "../src/lib/core/pricing";
import { evalDecision, autoUnlockSource, manualUnlockSource, LOCKED_EVAL_CAP } from "../src/lib/core/credits";
import { normalizeLimits, TOTAL_SEC, MIN_SEC, MAX_SEC, canSave, GRACE_SEC } from "../src/lib/core/timing";
import { sync, saveDraft, submit, secondsUsed } from "../src/lib/core/room";
import { integrity } from "../src/lib/core/integrity";
import { scan } from "../src/lib/core/compliance";
import { verifyPaddleSignature } from "../src/lib/core/paddle";
import { AssessmentSchema, ReportSchema } from "../src/lib/core/schemas";
import { DICTS, LOCALES, getT, fromAcceptLanguage } from "../src/i18n";

test("prices: defaults, packs and safe merging", () => {
  assert.deepEqual(PACK_CREDITS, { s: 10, m: 30, l: 100 });
  assert.equal(DEFAULT_PRICES.USD.s, 29);
  assert.equal(DEFAULT_PRICES.USD.m, 69);
  assert.equal(DEFAULT_PRICES.USD.l, 199);
  const m = mergePrices({ ILS: { s: 99, m: -5, l: "abc" }, XXX: { s: 1 } });
  assert.equal(m.ILS.s, 99);
  assert.equal(m.ILS.m, DEFAULT_PRICES.ILS.m);
  assert.equal(m.ILS.l, DEFAULT_PRICES.ILS.l);
  assert.deepEqual(mergePrices("garbage"), DEFAULT_PRICES);
});

test("credits: free first, then purchased; automatic unlock only with free credits", () => {
  const w = { freeCredits: 2, purchasedCredits: 0, lockedEvals: 0, everPurchased: false };
  assert.equal(autoUnlockSource(w), "FREE");
  assert.equal(autoUnlockSource({ ...w, freeCredits: 0, purchasedCredits: 5 }), null);
  assert.equal(manualUnlockSource({ ...w, freeCredits: 0, purchasedCredits: 5 }), "CREDIT");
  assert.equal(manualUnlockSource({ ...w, freeCredits: 1, purchasedCredits: 5 }), "FREE");
  assert.equal(manualUnlockSource({ ...w, freeCredits: 0 }), null);
});

test("credits: cost cap defers evaluations for employers who never paid", () => {
  const broke = { freeCredits: 0, purchasedCredits: 0, lockedEvals: LOCKED_EVAL_CAP, everPurchased: false };
  assert.equal(evalDecision(broke), "defer");
  assert.equal(evalDecision({ ...broke, lockedEvals: LOCKED_EVAL_CAP - 1 }), "evaluate");
  assert.equal(evalDecision({ ...broke, everPurchased: true }), "evaluate");
  assert.equal(evalDecision({ ...broke, freeCredits: 1 }), "evaluate");
});

test("timing: limits clamped to 2-3 minutes and total ≤ 15 minutes", () => {
  const l = normalizeLimits([30, 999, 180, 180, 180, 180, 180]);
  assert.ok(l.every((s) => s >= MIN_SEC && s <= MAX_SEC));
  assert.ok(l.reduce((a, b) => a + b, 0) <= TOTAL_SEC + 5 * 7, `total ${l.reduce((a, b) => a + b, 0)}`);
  assert.deepEqual(normalizeLimits([150, 150, 150, 150, 150]), [150, 150, 150, 150, 150]);
  assert.equal(canSave(0, 120, 120_000 + (GRACE_SEC - 1) * 1000), true);
  assert.equal(canSave(0, 120, 120_000 + (GRACE_SEC + 1) * 1000), false);
});

const QS = [
  { id: "q1", timeLimitSec: 120 },
  { id: "q2", timeLimitSec: 150 },
  { id: "q3", timeLimitSec: 180 },
];

test("room: serving, drafting and submitting in order", () => {
  let s = sync(QS, { answers: {}, index: 0, done: false }, 1000, false);
  assert.equal(s.index, 0);
  assert.equal(s.answers.q1.servedAt, 1000);
  s = saveDraft(QS, s, "q1", "draft", 5, 2000, false);
  assert.equal(s.answers.q1.text, "draft");
  // a draft for a question that isn't current is ignored
  assert.equal(saveDraft(QS, s, "q2", "x", 1, 2000, false).answers.q2, undefined);
  s = submit(QS, s, "q1", "final answer", 12, 61_000, false);
  assert.equal(s.index, 1);
  assert.equal(secondsUsed(s.answers.q1), 60);
  assert.equal(s.answers.q2.servedAt, 61_000);
});

test("room: the clock never pauses — returning late cascades timeouts", () => {
  let s = sync(QS, { answers: {}, index: 0, done: false }, 0, false);
  // candidate disappears for an hour
  s = sync(QS, s, 3600_000, false);
  assert.equal(s.done, true);
  assert.equal(s.answers.q1.timedOut, true);
  assert.equal(s.answers.q2.servedAt, 120_000, "q2 starts when q1 ran out, not when the candidate returned");
  assert.equal(s.answers.q3.servedAt, 270_000);
});

test("room: late answers are not saved; accommodation gives +50%", () => {
  let s = sync(QS, { answers: {}, index: 0, done: false }, 0, false);
  s = saveDraft(QS, s, "q1", "too late", 9, 140_000, false);
  assert.equal(s.answers.q1.text, "");
  let a = sync(QS, { answers: {}, index: 0, done: false }, 0, true);
  a = saveDraft(QS, a, "q1", "in time", 7, 170_000, true);
  assert.equal(a.answers.q1.text, "in time");
});

test("integrity: clean, minor and review levels", () => {
  const q = (id: string, chars: number, keystrokes: number, secondsUsed = 100) => ({ id, chars, keystrokes, secondsUsed, limitSec: 150, timedOut: false });
  assert.equal(integrity({ tabSwitches: 0, pasteAttempts: 0, questions: [q("q1", 300, 320)] }).level, "clean");
  assert.equal(integrity({ tabSwitches: 1, pasteAttempts: 0, questions: [q("q1", 300, 320)] }).level, "minor");
  const r = integrity({ tabSwitches: 0, pasteAttempts: 0, questions: [q("q1", 900, 20, 30), q("q2", 300, 320)] });
  assert.equal(r.level, "review");
  assert.ok(r.flags.some((f) => f.code === "NO_TYPING"));
  assert.ok(r.flags.some((f) => f.code === "VERY_FAST"));
});

test("compliance: finds protected characteristics in several languages, ignores clean text", () => {
  const hits = scan({
    criticalTraits: "Young and energetic, no mothers of small children",
    nonNegotiables: "רק גבר, לא דתי, בלי מילואים",
    behavioralRedLines: "Pas de femmes enceintes",
    responsibilities: "Manage the warehouse team and handle customer escalations",
  });
  const cats = new Set(hits.map((h) => h.category));
  for (const c of ["age", "family", "sex", "religion", "military"]) assert.ok(cats.has(c as never), `missing ${c}`);
  assert.ok(!hits.some((h) => h.field === "responsibilities"), "manage/handle must not match 'man'/'age'");
  assert.equal(scan({ x: "Stays calm with angry customers and owns mistakes" }).length, 0);
  assert.ok(scan({ x: "הצעירה" }).some((h) => h.category === "age"), "Hebrew prefix");
});

test("paddle: webhook signature", () => {
  const body = '{"event_type":"transaction.completed"}';
  const ts = Math.floor(Date.now() / 1000);
  const h1 = createHmac("sha256", "sec").update(`${ts}:${body}`).digest("hex");
  assert.equal(verifyPaddleSignature(`ts=${ts};h1=${h1}`, body, "sec"), true);
  assert.equal(verifyPaddleSignature(`ts=${ts};h1=${h1}`, body + " ", "sec"), false);
  assert.equal(verifyPaddleSignature(`ts=${ts - 3600};h1=${h1}`, body, "sec"), false);
  assert.equal(verifyPaddleSignature(null, body, "sec"), false);
});

test("schemas: report scores are clamped to 0-100; an assessment needs at least 5 questions", () => {
  const base = { overallScore: 70, competenceScore: 70, cultureFitScore: 70, reliabilityScore: 70, executiveSummary: "A solid candidate overall with clear reasoning.", strengths: [], redFlags: [], recommendedInterviewQuestions: [{ question: "a", why: "b" }, { question: "c", why: "d" }], perQuestion: [], integrityNote: "" };
  assert.equal(ReportSchema.safeParse(base).success, true);
  const clamped = ReportSchema.safeParse({ ...base, overallScore: 140, competenceScore: "-3", redFlags: [{ title: "x", evidence: "y", severity: "High" }] });
  assert.equal(clamped.success, true);
  if (clamped.success) {
    assert.equal(clamped.data.overallScore, 100);
    assert.equal(clamped.data.competenceScore, 0);
    assert.equal(clamped.data.redFlags[0].severity, "high");
  }
  assert.equal(AssessmentSchema.safeParse({ intro: "", questions: [] }).success, false);
});

test("i18n: all six languages have every key, filled", () => {
  const keys = Object.keys(DICTS.en);
  for (const l of LOCALES) {
    for (const k of keys) assert.ok(String((DICTS[l] as Record<string, string>)[k] || "").trim(), `${l}.${k} is empty`);
    // placeholders must survive translation
    for (const k of keys) {
      const ph = (DICTS.en as Record<string, string>)[k].match(/\{\w+\}/g) || [];
      for (const p of ph) assert.ok((DICTS[l] as Record<string, string>)[k].includes(p), `${l}.${k} lost ${p}`);
    }
  }
  assert.equal(getT("he")("creditsLeft", { n: 3 }), "נותרו 3 דו״חות");
  assert.equal(fromAcceptLanguage("he-IL,he;q=0.9"), "he");
  assert.equal(fromAcceptLanguage("iw"), "he");
  assert.equal(fromAcceptLanguage("ja,zh"), "en");
});
