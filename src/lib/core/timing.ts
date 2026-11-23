/** Assessment timing: 5-7 questions, 120-180 seconds each, at most 15 minutes in total. */
export const MIN_Q = 5;
export const MAX_Q = 7;
export const MIN_SEC = 120;
export const MAX_SEC = 180;
export const TOTAL_SEC = 15 * 60;
/** Network grace after a question's deadline, so an answer typed at the last second is still saved */
export const GRACE_SEC = 8;
/** Extended-time accommodation multiplier (accessibility) */
export const ACCOMMODATION_FACTOR = 1.5;

/** Clamps each question's limit to 120-180 s, then scales down (not below 120) so the total fits 15 minutes. */
export function normalizeLimits(limits: number[]): number[] {
  let out = limits.map((s) => Math.min(MAX_SEC, Math.max(MIN_SEC, Math.round(Number(s) || 150))));
  const total = out.reduce((a, b) => a + b, 0);
  if (total > TOTAL_SEC) {
    const f = TOTAL_SEC / total;
    out = out.map((s) => Math.max(MIN_SEC, Math.floor((s * f) / 5) * 5));
  }
  return out;
}

export const effectiveLimit = (limitSec: number, accommodation: boolean) => Math.round(limitSec * (accommodation ? ACCOMMODATION_FACTOR : 1));

/** Seconds left for a question served at servedAt (ms). Negative after the deadline. */
export const remaining = (servedAt: number, limitSec: number, now = Date.now()) => Math.ceil((servedAt + limitSec * 1000 - now) / 1000);

/** May an answer still be saved for this question? */
export const canSave = (servedAt: number, limitSec: number, now = Date.now()) => remaining(servedAt, limitSec, now) > -GRACE_SEC;
