// A verdict's reasons (deb-023a): each reason names a side, a rubric dimension, a short text and the
// turns of the judged transcript it rests on. A reason citing no turn, or a turn that isn't in that
// transcript, makes the verdict invalid. The forfeit-citation check is added here by #38.

import type { TurnRecord } from "../format/turn.ts";
import type { Verdict } from "./verdict.ts";

/** The rubric dimensions: the score keys of `SideScores` (deb-014a), less `total`. */
export type ReasonDimension = "answer" | "evidence" | "consistency";

export const REASON_DIMENSIONS: readonly ReasonDimension[] = ["answer", "evidence", "consistency"];

export interface VerdictReason {
  /** A side id from the transcript header. */
  side: string;
  dimension: ReasonDimension;
  /** Short, non-empty. */
  text: string;
  /** Non-empty; each a `turn_id` of the judged transcript. */
  turn_ids: string[];
}

const NON_EMPTY_STRING_FIELDS = ["side", "text"] as const;

/**
 * Every problem in a verdict's reasons, checked against the judged transcript's turns, one string
 * each, empty when every reason is valid. Each error names the reason by its 0-based index:
 * `reason 1: turn_ids must not be empty`, `reason 2: turn_id "t9" is not a turn in the transcript`.
 */
export function validateReasons(verdict: Verdict, turns: TurnRecord[]): string[] {
  const reasons: unknown = verdict.reasons;
  if (!Array.isArray(reasons)) return ["reasons must be an array"];
  const turnIds = new Set(turns.map((t) => t.turn_id));
  const errors: string[] = [];
  reasons.forEach((reason, i) => {
    const at = `reason ${i}`;
    if (typeof reason !== "object" || reason === null || Array.isArray(reason)) {
      errors.push(`${at}: not an object`);
      return;
    }
    const r = reason as Record<string, unknown>;

    for (const field of NON_EMPTY_STRING_FIELDS) {
      if (!(field in r)) errors.push(`${at}: missing ${field}`);
      else if (typeof r[field] !== "string" || r[field] === "") errors.push(`${at}: ${field} must be a non-empty string`);
    }

    if (!("dimension" in r)) errors.push(`${at}: missing dimension`);
    else if (!REASON_DIMENSIONS.includes(r.dimension as ReasonDimension)) {
      errors.push(`${at}: dimension ${JSON.stringify(r.dimension)} is not one of ${REASON_DIMENSIONS.join(", ")}`);
    }

    if (!("turn_ids" in r)) errors.push(`${at}: missing turn_ids`);
    else if (!Array.isArray(r.turn_ids)) errors.push(`${at}: turn_ids must be a list`);
    else if (r.turn_ids.length === 0) errors.push(`${at}: turn_ids must not be empty`);
    else {
      for (const id of r.turn_ids) {
        if (typeof id !== "string" || !turnIds.has(id)) {
          errors.push(`${at}: turn_id ${JSON.stringify(id)} is not a turn in the transcript`);
        }
      }
    }
  });
  return errors;
}
