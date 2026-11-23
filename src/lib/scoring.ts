import type { Submission } from "./schema";
import { integrity } from "./core/integrity";
import { secondsUsed, type Answers } from "./core/room";
import { effectiveLimit } from "./core/timing";

/** Integrity signals for one attempt (facts only, no AI) */
export function integrityOf(sub: Submission, qs: { id: string; timeLimitSec: number; kind?: string }[], accommodation: boolean) {
  const answers = JSON.parse(sub.answers || "{}") as Answers;
  return integrity({
    tabSwitches: sub.tabSwitchCount,
    pasteAttempts: sub.pasteAttemptCount,
    questions: qs.map((q) => {
      const a = answers[q.id];
      return { id: q.id, chars: (a?.text || "").trim().length, keystrokes: a?.keystrokes || 0, secondsUsed: secondsUsed(a), limitSec: effectiveLimit(q.timeLimitSec, accommodation), timedOut: Boolean(a?.timedOut), choice: q.kind === "choice", picked: Boolean(a?.choice?.most) };
    }),
  });
}
