/**
 * The candidate room's clock, as pure functions (tested in tests/room.test.ts).
 * The clock never pauses: when a question times out, the next one starts at that deadline, not when the
 * candidate comes back. So closing the tab and returning later cannot buy extra time.
 */
import { effectiveLimit, GRACE_SEC, canSave } from "./timing";

export type AnswerRec = { text: string; keystrokes: number; servedAt: number; savedAt?: number; submittedAt?: number; timedOut?: boolean };
export type Answers = Record<string, AnswerRec>;
export type RoomQ = { id: string; timeLimitSec: number };
export type RoomState = { answers: Answers; index: number; done: boolean };

const deadline = (a: AnswerRec, limit: number) => a.servedAt + limit * 1000;

/** Brings the room up to date at `now`: serves the current question, and closes every question whose time ran out. */
export function sync(qs: RoomQ[], s: RoomState, now: number, accommodation: boolean): RoomState {
  const answers: Answers = { ...s.answers };
  let index = s.index;
  let carry: number | null = null; // start time handed over from a timed-out question
  while (index < qs.length) {
    const q = qs[index];
    const limit = effectiveLimit(q.timeLimitSec, accommodation);
    const cur = answers[q.id];
    if (!cur) {
      answers[q.id] = { text: "", keystrokes: 0, servedAt: carry ?? now };
      carry = null;
      continue; // re-check: a carried start may already be past its deadline
    }
    if (cur.submittedAt) {
      index++;
      continue;
    }
    if (now > deadline(cur, limit) + GRACE_SEC * 1000) {
      answers[q.id] = { ...cur, submittedAt: deadline(cur, limit), timedOut: true };
      carry = deadline(cur, limit);
      index++;
      continue;
    }
    break;
  }
  return { answers, index, done: index >= qs.length };
}

/** Saves a draft of the current question (ignored after its deadline) */
export function saveDraft(qs: RoomQ[], s: RoomState, qid: string, text: string, keystrokes: number, now: number, accommodation: boolean): RoomState {
  const q = qs[s.index];
  if (!q || q.id !== qid) return s;
  const cur = s.answers[qid];
  if (!cur || cur.submittedAt || !canSave(cur.servedAt, effectiveLimit(q.timeLimitSec, accommodation), now)) return s;
  return { ...s, answers: { ...s.answers, [qid]: { ...cur, text: text.slice(0, 6000), keystrokes: Math.max(cur.keystrokes, Math.min(100000, keystrokes | 0)), savedAt: now } } };
}

/** Submits the current question and moves on. The next question starts now. */
export function submit(qs: RoomQ[], s: RoomState, qid: string, text: string, keystrokes: number, now: number, accommodation: boolean): RoomState {
  const saved = saveDraft(qs, s, qid, text, keystrokes, now, accommodation);
  const q = qs[saved.index];
  if (!q || q.id !== qid) return saved;
  const cur = saved.answers[qid];
  const limit = effectiveLimit(q.timeLimitSec, accommodation);
  const late = now > deadline(cur, limit);
  const answers = { ...saved.answers, [qid]: { ...cur, submittedAt: Math.min(now, deadline(cur, limit)), timedOut: late || undefined } };
  return sync(qs, { answers, index: saved.index + 1, done: false }, now, accommodation);
}

export const secondsUsed = (a: AnswerRec | undefined) => (a && a.submittedAt ? Math.max(0, Math.round((a.submittedAt - a.servedAt) / 1000)) : 0);
