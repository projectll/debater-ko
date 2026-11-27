// deb-019a: the answers link on rebuttal turns, validateAnswers and qualifyingTurn (src/format/answers.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { qualifyingTurn, validateAnswers, validatePoints, validateTurns } from "../../src/format/index.ts";
import type { TurnRecord } from "../../src/format/index.ts";

/** A valid four-turn sample: two openings, then a rebuttal from each side. */
function sample(): TurnRecord[] {
  return [
    { turn_id: "t1", seq: 1, side: "pro", speaker: "Pro", kind: "opening", text: "We should.", points: [
      { point_id: "t1.p1", claim: "It is cheaper." },
      { point_id: "t1.p2", claim: "It is faster." },
    ] },
    { turn_id: "t2", seq: 2, side: "con", speaker: "Con", kind: "opening", text: "We should not.", points: [
      { point_id: "t2.p1", claim: "It is riskier." },
    ] },
    { turn_id: "t3", seq: 3, side: "pro", speaker: "Pro", kind: "rebuttal", text: "Risk is managed.", answers: ["t2.p1"], points: [
      { point_id: "t3.p1", claim: "Risk has a plan." },
    ] },
    { turn_id: "t4", seq: 4, side: "con", speaker: "Con", kind: "rebuttal", text: "The plan fails.", answers: ["t3.p1"], points: [
      { point_id: "t4.p1", claim: "The plan is untested." },
    ] },
  ];
}

/** A hand-made forfeited turn, the shape #35 defines. */
function forfeit(turn_id: string, seq: number, side: string): TurnRecord {
  return { turn_id, seq, side, speaker: side, kind: "rebuttal", text: "", points: [], forfeited: true };
}

test("1. a rebuttal answering a point from the other side's last turn with points is accepted", () => {
  const turns = sample();
  assert.deepEqual(validateTurns(turns), []);
  assert.deepEqual(validatePoints(turns), []);
  assert.deepEqual(validateAnswers(turns), []);
  assert.equal(qualifyingTurn(turns, turns[3]), turns[2]);
});

test("2. after a forfeit, a rebuttal answers the other side's last point-carrying turn", () => {
  const turns = sample();
  // t4 (con) forfeits; pro's rebuttal t5 answers t2, con's last turn with points.
  turns[3] = forfeit("t4", 4, "con");
  turns.push({ turn_id: "t5", seq: 5, side: "pro", speaker: "Pro", kind: "rebuttal", text: "Still no answer.", answers: ["t2.p1"], points: [] });
  assert.deepEqual(validateTurns(turns), []);
  assert.deepEqual(validateAnswers(turns), []);
  assert.equal(qualifyingTurn(turns, turns[4]), turns[1]);
  // Answering the forfeit's own (empty) turn or pro's own t3 is still rejected.
  turns[4].answers = ["t3.p1"];
  assert.deepEqual(validateAnswers(turns), [
    'seq 5: answers "t3.p1" is not a point of t2, the other side\'s latest turn with points',
  ]);
});

test("2b. a forfeited rebuttal needs no answers, and may not carry any", () => {
  const turns = sample();
  turns[3] = forfeit("t4", 4, "con");
  assert.deepEqual(validateAnswers(turns), []);
  turns[3].answers = ["t3.p1"];
  assert.deepEqual(validateAnswers(turns), ["seq 4: forfeited turns may not carry answers"]);
});

test("3. a rebuttal answering its own side's point is rejected, naming the seq and the id", () => {
  const turns = sample();
  turns[3].answers = ["t2.p1"];
  assert.deepEqual(validateAnswers(turns), [
    'seq 4: answers "t2.p1" is not a point of t3, the other side\'s latest turn with points',
  ]);
});

test("4. a rebuttal answering a point from a turn earlier than the qualifying one is rejected", () => {
  const turns = sample();
  turns[3].answers = ["t1.p2"];
  assert.deepEqual(validateAnswers(turns), [
    'seq 4: answers "t1.p2" is not a point of t3, the other side\'s latest turn with points',
  ]);
});

test("5. a rebuttal with no answers, or with an empty or malformed list, is rejected", () => {
  const turns = sample();
  delete turns[2].answers;
  turns[3].answers = [];
  assert.deepEqual(validateAnswers(turns), [
    "seq 3: a rebuttal turn must carry answers",
    "seq 4: answers must not be empty",
  ]);
  (turns[3] as unknown as Record<string, unknown>).answers = "t3.p1";
  assert.deepEqual(validateAnswers(turns.slice(3)), ["seq 4: answers must be a list of point ids"]);
});

test("6. an opening turn and a closing turn that carry an answers field are rejected", () => {
  const turns = sample();
  turns[0].answers = [];
  turns.push({ turn_id: "t5", seq: 5, side: "pro", speaker: "Pro", kind: "closing", text: "In closing.", answers: ["t4.p1"], points: [] });
  assert.deepEqual(validateAnswers(turns), [
    "seq 1: opening turns may not carry answers",
    "seq 5: closing turns may not carry answers",
  ]);
});

test("7. turns are checked in seq order, whatever their list order", () => {
  const turns = sample().reverse();
  assert.deepEqual(validateAnswers(turns), []);
});

test("8. a repeated id, a point no turn holds, and a rebuttal with nothing to answer are rejected", () => {
  const turns = sample();
  turns[3].answers = ["t3.p1", "t3.p1", "t9.p1"];
  assert.deepEqual(validateAnswers(turns), [
    'seq 4: answers "t3.p1" is listed twice',
    'seq 4: answers "t9.p1" is not a point of t3, the other side\'s latest turn with points',
  ]);
  const first: TurnRecord[] = [{ turn_id: "t1", seq: 1, side: "pro", speaker: "Pro", kind: "rebuttal", text: "x", answers: ["t0.p1"], points: [] }];
  assert.deepEqual(validateAnswers(first), ["seq 1: no earlier turn from the other side carries points to answer"]);
  assert.deepEqual(validateAnswers("nope" as unknown as TurnRecord[]), ["turns: not a list"]);
});
