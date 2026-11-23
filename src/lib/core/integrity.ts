/**
 * Integrity signals, computed from facts only (no AI). They are shown to the employer as context, never as a verdict:
 * leaving the tab can have innocent reasons (a phone call, a notification).
 */
export type QuestionStat = { id: string; chars: number; keystrokes: number; secondsUsed: number; limitSec: number; timedOut: boolean };
export type IntegrityInput = { tabSwitches: number; pasteAttempts: number; questions: QuestionStat[] };
export type IntegrityFlag = { code: "TAB_SWITCH" | "PASTE" | "NO_TYPING" | "VERY_FAST" | "TIMEOUTS" | "EMPTY"; count: number; questions?: string[] };
export type IntegrityLevel = "clean" | "minor" | "review";

export function integrity(input: IntegrityInput): { level: IntegrityLevel; flags: IntegrityFlag[] } {
  const flags: IntegrityFlag[] = [];
  if (input.tabSwitches > 0) flags.push({ code: "TAB_SWITCH", count: input.tabSwitches });
  if (input.pasteAttempts > 0) flags.push({ code: "PASTE", count: input.pasteAttempts });
  // Text that appeared without matching typing (drag and drop, autofill, an extension): far fewer keystrokes than characters
  const noTyping = input.questions.filter((q) => q.chars >= 80 && q.keystrokes < q.chars * 0.35).map((q) => q.id);
  if (noTyping.length) flags.push({ code: "NO_TYPING", count: noTyping.length, questions: noTyping });
  // Long answers written faster than ~12 characters per second are not humanly typed
  const fast = input.questions.filter((q) => q.chars >= 200 && q.secondsUsed > 0 && q.chars / q.secondsUsed > 12).map((q) => q.id);
  if (fast.length) flags.push({ code: "VERY_FAST", count: fast.length, questions: fast });
  const timeouts = input.questions.filter((q) => q.timedOut).map((q) => q.id);
  if (timeouts.length) flags.push({ code: "TIMEOUTS", count: timeouts.length, questions: timeouts });
  const empty = input.questions.filter((q) => q.chars < 15).map((q) => q.id);
  if (empty.length) flags.push({ code: "EMPTY", count: empty.length, questions: empty });

  const serious = (noTyping.length ? 2 : 0) + (fast.length ? 2 : 0) + (input.pasteAttempts >= 3 ? 1 : 0) + (input.tabSwitches >= 4 ? 1 : 0);
  const level: IntegrityLevel = serious >= 2 ? "review" : flags.some((f) => f.code !== "TIMEOUTS" && f.code !== "EMPTY") ? "minor" : "clean";
  return { level, flags };
}
