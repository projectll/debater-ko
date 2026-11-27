// The point record inside a turn (deb-018a): each turn holds an ordered list of points, and each
// point id is its turn's id plus its 1-based position (`t1.p2`), so it is unique across the
// transcript and resolves to exactly one turn. Rebuttals cite these ids (#19); the viewer anchors
// on them (#46).

import type { TurnRecord } from "./turn.ts";

export interface Point {
  /** `<turn_id>.p<n>`, where `n` is the point's 1-based position in its turn. */
  point_id: string;
  /** Non-empty short claim text. */
  claim: string;
}

/** The id of the point at a 1-based `position` in the turn `turnId`: `pointId("t1", 2)` is `t1.p2`. */
export function pointId(turnId: string, position: number): string {
  if (!Number.isInteger(position) || position < 1) throw new RangeError(`point position must be a positive integer, got ${position}`);
  return `${turnId}.p${position}`;
}

/**
 * Every problem in the turns' points, one string each, empty when they're valid. Each error names
 * the turn and the point by their 0-based indexes: `turn 1 point 0: missing claim`. A turn that
 * isn't an object or has no `points` list is left to `validateTurns`, which reports it.
 */
export function validatePoints(turns: TurnRecord[]): string[] {
  if (!Array.isArray(turns)) return ["turns: not a list"];
  const errors: string[] = [];
  const firstAt = new Map<string, string>();
  turns.forEach((turn, i) => {
    if (typeof turn !== "object" || turn === null || !Array.isArray(turn.points)) return;
    const turnId = (turn as { turn_id?: unknown }).turn_id;
    (turn.points as unknown[]).forEach((point, j) => {
      const at = `turn ${i} point ${j}`;
      if (typeof point !== "object" || point === null || Array.isArray(point)) {
        errors.push(`${at}: not an object`);
        return;
      }
      const record = point as Record<string, unknown>;

      const id = record.point_id;
      if (!("point_id" in record)) errors.push(`${at}: missing point_id`);
      else if (typeof id !== "string" || id === "") errors.push(`${at}: point_id must be a non-empty string`);
      else {
        if (typeof turnId === "string" && turnId !== "") {
          const expected = pointId(turnId, j + 1);
          if (id !== expected) errors.push(`${at}: point_id ${JSON.stringify(id)} should be ${JSON.stringify(expected)}`);
        }
        const first = firstAt.get(id);
        if (first === undefined) firstAt.set(id, at);
        else errors.push(`${at}: point_id ${JSON.stringify(id)} repeats ${first}`);
      }

      if (!("claim" in record)) errors.push(`${at}: missing claim`);
      else if (typeof record.claim !== "string" || record.claim === "") errors.push(`${at}: claim must be a non-empty string`);
    });
  });
  return errors;
}

/** The one turn holding the point `id`, or `undefined` when no turn holds it or more than one does. */
export function turnOfPoint(turns: TurnRecord[], id: string): TurnRecord | undefined {
  const holders = turns.filter((turn) => Array.isArray(turn?.points) && turn.points.some((point) => point?.point_id === id));
  return holders.length === 1 ? holders[0] : undefined;
}
