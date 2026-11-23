/**
 * Scoring of a multiple-choice situation: the candidate picks the BEST and the LEAST effective action.
 * Each option has an effectiveness key 1-4. Half the item score comes from how good the "best" pick is,
 * half from how bad the "least effective" pick really is. 0-100 per item. Deterministic, the same for everyone.
 */
import type { Option } from "./schemas";

export type ChoicePick = { most?: string; least?: string };

export function scoreChoice(options: Pick<Option, "id" | "effectiveness">[], pick: ChoicePick | undefined): number {
  if (!options.length || !pick) return 0;
  const effs = options.map((o) => o.effectiveness);
  const hi = Math.max(...effs);
  const lo = Math.min(...effs);
  const span = hi - lo || 1;
  const most = options.find((o) => o.id === pick.most);
  const least = pick.least && pick.least !== pick.most ? options.find((o) => o.id === pick.least) : undefined;
  const partMost = most ? (most.effectiveness - lo) / span : 0;
  const partLeast = least ? (hi - least.effectiveness) / span : 0;
  return Math.round((partMost * 0.5 + partLeast * 0.5) * 100);
}

/** Average over the answered and unanswered choice items (an unanswered item counts as 0) */
export function choiceAverage(items: { options: Pick<Option, "id" | "effectiveness">[]; pick?: ChoicePick }[]): number | null {
  if (!items.length) return null;
  return Math.round(items.reduce((s, it) => s + scoreChoice(it.options, it.pick), 0) / items.length);
}

export const validPick = (options: Pick<Option, "id">[], p: unknown): ChoicePick | undefined => {
  if (!p || typeof p !== "object") return undefined;
  const ids = new Set(options.map((o) => o.id));
  const most = typeof (p as ChoicePick).most === "string" && ids.has((p as ChoicePick).most!) ? (p as ChoicePick).most : undefined;
  const least = typeof (p as ChoicePick).least === "string" && ids.has((p as ChoicePick).least!) && (p as ChoicePick).least !== most ? (p as ChoicePick).least : undefined;
  return most || least ? { most, least } : undefined;
};

/** For the report: the texts the candidate picked, and the best option by the key */
export function choiceSummary(options: Pick<Option, "id" | "text" | "effectiveness">[], pick: ChoicePick | undefined) {
  const byId = (id?: string) => options.find((o) => o.id === id);
  const key = [...options].sort((a, b) => b.effectiveness - a.effectiveness)[0];
  return { best: byId(pick?.most)?.text, worst: byId(pick?.least)?.text, key: key?.text };
}
