/**
 * Assessment timing. A mixed assessment: 12-15 multiple-choice work situations (best + least effective action)
 * and 2-3 open experience questions, at most 30 minutes in total.
 * Older assessments with open scenario questions keep working with the open-question limits.
 */
export const MIN_Q = 5;
export const MAX_Q = 20;
/** Open questions (experience, and older open scenarios) */
export const MIN_SEC = 150;
export const MAX_SEC = 300;
/** Multiple-choice questions */
export const CHOICE_MIN_SEC = 45;
export const CHOICE_MAX_SEC = 120;
export const TOTAL_SEC = 30 * 60;
/** Network grace after a question's deadline, so an answer typed at the last second is still saved */
export const GRACE_SEC = 8;
/** Extended-time accommodation multiplier (accessibility) */
export const ACCOMMODATION_FACTOR = 1.5;

const range = (kind?: string): [number, number] => (kind === "choice" ? [CHOICE_MIN_SEC, CHOICE_MAX_SEC] : [MIN_SEC, MAX_SEC]);

/** Clamps each question's limit to its kind's range, then scales down (not below each minimum) so the total fits TOTAL_SEC. */
export function normalizeLimits(limits: number[], kinds: (string | undefined)[] = []): number[] {
  let out = limits.map((s, i) => {
    const [lo, hi] = range(kinds[i]);
    return Math.min(hi, Math.max(lo, Math.round(Number(s) || (kinds[i] === "choice" ? 75 : 240))));
  });
  const total = out.reduce((a, b) => a + b, 0);
  if (total > TOTAL_SEC) {
    const f = TOTAL_SEC / total;
    out = out.map((s, i) => Math.max(range(kinds[i])[0], Math.floor((s * f) / 5) * 5));
  }
  return out;
}

export const effectiveLimit = (limitSec: number, accommodation: boolean) => Math.round(limitSec * (accommodation ? ACCOMMODATION_FACTOR : 1));

/** Seconds left for a question served at servedAt (ms). Negative after the deadline. */
export const remaining = (servedAt: number, limitSec: number, now = Date.now()) => Math.ceil((servedAt + limitSec * 1000 - now) / 1000);

/** May an answer still be saved for this question? */
export const canSave = (servedAt: number, limitSec: number, now = Date.now()) => remaining(servedAt, limitSec, now) > -GRACE_SEC;
