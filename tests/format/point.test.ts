// deb-018a: the point record inside a turn, pointId, validatePoints and turnOfPoint (src/format/point.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { pointId, turnOfPoint, validatePoints, validateTurns } from "../../src/format/index.ts";
import type { TurnRecord } from "../../src/format/index.ts";

/** A valid three-turn sample, two points each. */
function sample(): TurnRecord[] {
  return [
    { turn_id: "t1", seq: 1, side: "pro", speaker: "Pro", kind: "opening", text: "We should.", points: [
      { point_id: "t1.p1", claim: "It is cheaper." },
      { point_id: "t1.p2", claim: "It is faster." },
    ] },
    { turn_id: "t2", seq: 2, side: "con", speaker: "Con", kind: "rebuttal", text: "We should not.", points: [
      { point_id: "t2.p1", claim: "It is not cheaper." },
      { point_id: "t2.p2", claim: "Speed is not the goal." },
    ] },
    { turn_id: "t3", seq: 3, side: "pro", speaker: "Pro", kind: "closing", text: "In closing.", points: [
      { point_id: "t3.p1", claim: "Cost still wins." },
      { point_id: "t3.p2", claim: "Speed still matters." },
    ] },
  ];
}

test("1. a three-turn sample, two points each, has no errors, and turnOfPoint maps each point to one turn", () => {
  const turns = sample();
  assert.deepEqual(validateTurns(turns), []);
  assert.deepEqual(validatePoints(turns), []);
  for (const turn of turns) {
    for (const point of turn.points) assert.equal(turnOfPoint(turns, point.point_id), turn, point.point_id);
  }
});

test("2. the same point_id on two turns is rejected with an error naming that id", () => {
  const turns = sample();
  turns[1].points[0].point_id = "t1.p1";
  const errors = validatePoints(turns);
  assert.ok(errors.includes('turn 1 point 0: point_id "t1.p1" repeats turn 0 point 0'), errors.join("\n"));
  assert.equal(turnOfPoint(turns, "t1.p1"), undefined, "an id two turns hold resolves to no single turn");
});

test("3. a point whose id prefix isn't its own turn's turn_id is rejected", () => {
  const turns = sample();
  turns[2].points[1].point_id = "t9.p2";
  assert.deepEqual(validatePoints(turns), ['turn 2 point 1: point_id "t9.p2" should be "t3.p2"']);
});

test("4. a point whose position suffix doesn't match its place in the turn is rejected", () => {
  const turns = sample();
  turns[0].points.reverse();
  assert.deepEqual(validatePoints(turns), [
    'turn 0 point 0: point_id "t1.p2" should be "t1.p1"',
    'turn 0 point 1: point_id "t1.p1" should be "t1.p2"',
  ]);
});

test("5. a missing or empty claim is rejected", () => {
  const turns: TurnRecord[] = sample();
  delete (turns[0].points[1] as Partial<{ claim: string }>).claim;
  turns[1].points[0].claim = "";
  (turns[2].points[0] as unknown as Record<string, unknown>).claim = 3;
  assert.deepEqual(validatePoints(turns), [
    "turn 0 point 1: missing claim",
    "turn 1 point 0: claim must be a non-empty string",
    "turn 2 point 0: claim must be a non-empty string",
  ]);
});

test("6. a missing or non-string point_id and a non-object point are errors, not crashes", () => {
  const turns = sample();
  const points = turns[0].points as unknown[];
  delete (points[0] as Partial<{ point_id: string }>).point_id;
  points[1] = null;
  (turns[1].points[1] as unknown as Record<string, unknown>).point_id = 7;
  assert.deepEqual(validatePoints(turns), [
    "turn 0 point 0: missing point_id",
    "turn 0 point 1: not an object",
    "turn 1 point 1: point_id must be a non-empty string",
  ]);
});

test("7. a turn with no points is valid, and a turn validateTurns rejects is skipped", () => {
  const turns: unknown[] = sample();
  (turns[0] as TurnRecord).points = [];
  delete (turns[1] as Partial<TurnRecord>).points;
  turns[2] = null;
  assert.deepEqual(validatePoints(turns as TurnRecord[]), []);
  assert.deepEqual(validatePoints("nope" as unknown as TurnRecord[]), ["turns: not a list"]);
});

test("8. pointId builds <turn_id>.p<n> from a 1-based position and refuses any other position", () => {
  assert.equal(pointId("t1", 1), "t1.p1");
  assert.equal(pointId("open-pro", 12), "open-pro.p12");
  for (const bad of [0, -1, 1.5, Number.NaN]) assert.throws(() => pointId("t1", bad), RangeError, String(bad));
});

test("9. turnOfPoint returns undefined for an id no turn holds", () => {
  const turns = sample();
  assert.equal(turnOfPoint(turns, "t4.p1"), undefined);
  assert.equal(turnOfPoint(turns, ""), undefined);
  assert.equal(turnOfPoint([], "t1.p1"), undefined);
});
