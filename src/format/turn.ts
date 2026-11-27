// The transcript turn record (deb-012a): the six base fields every later format, viewer and judge
// ticket uses, plus the points list (deb-018a, `point.ts`). Later tickets add their own fields to
// this same record (answers #19, the forfeited marker #35), so unknown extra fields are never an
// error here.

import type { Point } from "./point.ts";

export type TurnKind = "opening" | "rebuttal" | "closing";

export const TURN_KINDS: readonly TurnKind[] = ["opening", "rebuttal", "closing"];

export interface TurnRecord {
  /** Non-empty, unique in the transcript. */
  turn_id: string;
  /** 1, 2, 3… in record order, with no gaps. */
  seq: number;
  /** Non-empty: a side id from the debate config (checking it against the config is a later ticket). */
  side: string;
  /** Non-empty speaker label. */
  speaker: string;
  kind: TurnKind;
  /** May be empty (a forfeited turn has empty text). */
  text: string;
  /** In order, possibly empty; `validatePoints` (`point.ts`) checks the points themselves. */
  points: Point[];
  /** Required on rebuttal turns, absent on the others: the opposing point ids it answers (`answers.ts`, deb-019a). */
  answers?: string[];
  /** Marks a forfeited turn: empty `text` and `points` (#35 defines it; the name is fixed in deb-019a). */
  forfeited?: true;
}

const NON_EMPTY_STRING_FIELDS = ["turn_id", "side", "speaker"] as const;

/**
 * Every problem in a list of turn records, one string each, empty when the list is valid. Each
 * error names the turn by its 0-based index in the list, and the field or the sequence gap:
 * `turn 2: seq 4, expected 3`, `turn 1: missing speaker`.
 */
export function validateTurns(turns: unknown[]): string[] {
  if (!Array.isArray(turns)) return ["turns: not a list"];
  const errors: string[] = [];
  const firstIndexOf = new Map<string, number>();
  let expectedSeq = 1;
  turns.forEach((turn, i) => {
    const at = `turn ${i}`;
    if (typeof turn !== "object" || turn === null || Array.isArray(turn)) {
      errors.push(`${at}: not an object`);
      expectedSeq += 1;
      return;
    }
    const record = turn as Record<string, unknown>;

    for (const field of NON_EMPTY_STRING_FIELDS) {
      if (!(field in record)) errors.push(`${at}: missing ${field}`);
      else if (typeof record[field] !== "string" || record[field] === "") errors.push(`${at}: ${field} must be a non-empty string`);
    }

    const id = record.turn_id;
    if (typeof id === "string" && id !== "") {
      const first = firstIndexOf.get(id);
      if (first === undefined) firstIndexOf.set(id, i);
      else errors.push(`${at}: turn_id ${JSON.stringify(id)} repeats turn ${first}`);
    }

    // Each gap or repeat is reported once: the next turn is expected to follow this one's seq.
    const seq = record.seq;
    if (!("seq" in record)) errors.push(`${at}: missing seq`);
    else if (typeof seq !== "number" || !Number.isInteger(seq)) errors.push(`${at}: seq must be an integer`);
    else if (seq !== expectedSeq) errors.push(`${at}: seq ${seq}, expected ${expectedSeq}`);
    expectedSeq = typeof seq === "number" && Number.isInteger(seq) ? seq + 1 : expectedSeq + 1;

    if (!("kind" in record)) errors.push(`${at}: missing kind`);
    else if (!TURN_KINDS.includes(record.kind as TurnKind)) {
      errors.push(`${at}: kind ${JSON.stringify(record.kind)} is not one of ${TURN_KINDS.join(", ")}`);
    }

    if (!("text" in record)) errors.push(`${at}: missing text`);
    else if (typeof record.text !== "string") errors.push(`${at}: text must be a string`);

    if (!("points" in record)) errors.push(`${at}: missing points`);
    else if (!Array.isArray(record.points)) errors.push(`${at}: points must be a list`);
  });
  return errors;
}
