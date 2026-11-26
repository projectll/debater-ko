// deb-012a: the transcript turn record and validateTurns (src/format/turn.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { TURN_KINDS, validateTurns } from "../../src/format/index.ts";
import type { TurnRecord } from "../../src/format/index.ts";

/** A valid three-turn sample: seq 1, 2, 3, all six base fields. */
function sample(): TurnRecord[] {
  return [
    { turn_id: "t1", seq: 1, side: "pro", speaker: "Pro", kind: "opening", text: "We should." },
    { turn_id: "t2", seq: 2, side: "con", speaker: "Con", kind: "rebuttal", text: "We should not." },
    { turn_id: "t3", seq: 3, side: "pro", speaker: "Pro", kind: "closing", text: "In closing." },
  ];
}

test("1. a valid three-turn sample gives no errors", () => {
  assert.deepEqual(validateTurns(sample()), []);
});

test("2. seq 1, 2, 4 gives an error naming the gap", () => {
  const turns = sample();
  turns[2].seq = 4;
  assert.deepEqual(validateTurns(turns), ["turn 2: seq 4, expected 3"]);
});

test("3. a turn missing a base field gives an error naming that field", () => {
  for (const field of ["turn_id", "seq", "side", "speaker", "kind", "text"]) {
    const turns: Record<string, unknown>[] = sample();
    delete turns[1][field];
    assert.deepEqual(validateTurns(turns), [`turn 1: missing ${field}`], field);
  }
});

test('4. kind "summary" gives an error naming kind', () => {
  const turns: Record<string, unknown>[] = sample();
  turns[0].kind = "summary";
  assert.deepEqual(validateTurns(turns), ['turn 0: kind "summary" is not one of opening, rebuttal, closing']);
});

test("5. the turn kinds are opening, rebuttal and closing", () => {
  assert.deepEqual([...TURN_KINDS], ["opening", "rebuttal", "closing"]);
});

test("6. an empty text is valid (a forfeited turn)", () => {
  const turns = sample();
  turns[1].text = "";
  assert.deepEqual(validateTurns(turns), []);
});

test("7. unknown extra fields are not an error", () => {
  const turns: Record<string, unknown>[] = sample();
  turns[1].points = [];
  turns[1].answers = ["t1"];
  turns[2].forfeited = false;
  assert.deepEqual(validateTurns(turns), []);
});

test("8. a repeated turn_id is an error naming both turns", () => {
  const turns = sample();
  turns[2].turn_id = "t1";
  assert.deepEqual(validateTurns(turns), ['turn 2: turn_id "t1" repeats turn 0']);
});

test("9. a transcript must start at seq 1, and one gap is reported once", () => {
  const turns = sample().map((t) => ({ ...t, seq: t.seq + 1 }));
  assert.deepEqual(validateTurns(turns), ["turn 0: seq 2, expected 1"]);
  const gap = sample();
  gap.push({ turn_id: "t4", seq: 4, side: "con", speaker: "Con", kind: "closing", text: "" });
  gap[2].seq = 5;
  gap[3].seq = 6;
  assert.deepEqual(validateTurns(gap), ["turn 2: seq 5, expected 3"]);
});

test("10. a repeated seq is an error", () => {
  const turns = sample();
  turns[2].seq = 2;
  assert.deepEqual(validateTurns(turns), ["turn 2: seq 2, expected 3"]);
});

test("11. wrong types and empty strings are errors naming the field", () => {
  const turns: Record<string, unknown>[] = sample();
  turns[0].seq = 1.5;
  turns[0].side = "";
  turns[1].speaker = 7;
  turns[2].text = null;
  assert.deepEqual(validateTurns(turns), [
    "turn 0: side must be a non-empty string",
    "turn 0: seq must be an integer",
    "turn 1: speaker must be a non-empty string",
    "turn 2: text must be a string",
  ]);
});

test("12. a non-object turn and a non-list input are errors, not crashes", () => {
  assert.deepEqual(validateTurns([null, "t", sample()[2]]), ["turn 0: not an object", "turn 1: not an object"]);
  assert.deepEqual(validateTurns("nope" as unknown as unknown[]), ["turns: not a list"]);
  assert.deepEqual(validateTurns([]), []);
});
