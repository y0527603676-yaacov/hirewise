/**
 * Credit rules.
 * - Every employer gets FREE_REPORTS free reports, granted once per email address (re-registering does not renew them).
 * - When a report finishes and free credits remain, it unlocks automatically.
 * - Otherwise the employer sees a teaser and unlocks with 1 purchased credit.
 * - Cost cap: an employer who never bought credits can have at most LOCKED_EVAL_CAP locked reports evaluated in advance.
 *   Beyond that, the evaluation waits until the employer unlocks (so unpaid AI cost is bounded).
 */
export const FREE_REPORTS = 2;
export const LOCKED_EVAL_CAP = 15;

export type Wallet = { freeCredits: number; purchasedCredits: number; lockedEvals: number; everPurchased: boolean };

export type EvalDecision = "evaluate" | "defer";

/** Should a just-completed submission be evaluated now, or wait for an unlock? */
export function evalDecision(w: Wallet): EvalDecision {
  if (w.freeCredits > 0 || w.purchasedCredits > 0 || w.everPurchased) return "evaluate";
  return w.lockedEvals < LOCKED_EVAL_CAP ? "evaluate" : "defer";
}

export type UnlockSource = "FREE" | "CREDIT" | null;

/** Which credit pays for an automatic unlock when a report finishes: only free credits unlock automatically. */
export const autoUnlockSource = (w: Wallet): UnlockSource => (w.freeCredits > 0 ? "FREE" : null);

/** Which credit pays for a manual unlock: free first, then purchased. */
export const manualUnlockSource = (w: Wallet): UnlockSource => (w.freeCredits > 0 ? "FREE" : w.purchasedCredits > 0 ? "CREDIT" : null);

export const balance = (w: Pick<Wallet, "freeCredits" | "purchasedCredits">) => Math.max(0, w.freeCredits) + Math.max(0, w.purchasedCredits);
