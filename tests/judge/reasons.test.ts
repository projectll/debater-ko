// deb-023a: each verdict reason cites turn ids from the judged transcript (src/judge/reasons.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { VERDICT_FORMAT_VERSION, validateReasons } from "../../src/judge/index.ts";
import type { Verdict, VerdictReason } from "../../src/judge/index.ts";
import type { TurnRecord } from "../../src/format/turn.ts";

function turn(seq: number, side: string): TurnRecord {
  return { turn_id: `t${seq}`, seq, side, speaker: side, kind: "opening", text: "We should.", points: [] };
}

const TURNS: TurnRecord[] = [turn(1, "pro"), turn(2, "con"), turn(3, "pro")];

function reason(over: Partial<VerdictReason> = {}): VerdictReason {
  return { side: "pro", dimension: "answer", text: "Pro answered every point.", turn_ids: ["t1", "t3"], ...over };
}

/** A valid win verdict, built by hand (the scripted judge is #22), with the given reasons. */
function verdict(reasons: unknown[]): Verdict {
  return {
    verdict_id: "v1",
    transcript_id: "debate-001",
    verdict_format_version: VERDICT_FORMAT_VERSION,
    rubric_version: "2026-11-20-judge-rubric-document.md",
    outcome: "win",
    winner: "pro",
    scores: {
      pro: { answer: 3, evidence: 2, consistency: 3, total: 8 },
      con: { answer: 2, evidence: 2, consistency: 2, total: 6 },
    },
    reasons,
    judged_at: "2026-11-26T18:30:00.000Z",
  };
}

test("1. a verdict whose every reason cites at least one existing turn id gives no errors", () => {
  const reasons = [
    reason(),
    reason({ side: "con", dimension: "evidence", turn_ids: ["t2"] }),
    reason({ dimension: "consistency", turn_ids: ["t1"] }),
  ];
  assert.deepEqual(validateReasons(verdict(reasons), TURNS), []);
  assert.deepEqual(validateReasons(verdict([]), TURNS), [], "no reasons: nothing to cite");
});

test("2. a reason citing [] is rejected, with its index named", () => {
  const reasons = [reason(), reason({ turn_ids: [] })];
  assert.deepEqual(validateReasons(verdict(reasons), TURNS), ["reason 1: turn_ids must not be empty"]);
});

test("3. a reason citing an unknown turn id is rejected, with that id named", () => {
  const reasons = [reason(), reason(), reason({ turn_ids: ["t1", "t9"] })];
  assert.deepEqual(validateReasons(verdict(reasons), TURNS), ['reason 2: turn_id "t9" is not a turn in the transcript']);
  // A turn id from some other transcript is unknown here.
  assert.deepEqual(validateReasons(verdict([reason({ turn_ids: ["t3"] })]), TURNS.slice(0, 2)), [
    'reason 0: turn_id "t3" is not a turn in the transcript',
  ]);
});

test("4. extra: each missing field is named with the reason's index", () => {
  for (const field of ["side", "dimension", "text", "turn_ids"]) {
    const r: Record<string, unknown> = reason();
    delete r[field];
    assert.deepEqual(validateReasons(verdict([r]), TURNS), [`reason 0: missing ${field}`], field);
  }
});

test("5. extra: a dimension outside the three, and ill-typed fields, are rejected", () => {
  const cases: [Record<string, unknown>, string][] = [
    [{ dimension: "style" }, 'reason 0: dimension "style" is not one of answer, evidence, consistency'],
    [{ dimension: "total" }, 'reason 0: dimension "total" is not one of answer, evidence, consistency'],
    [{ side: "" }, "reason 0: side must be a non-empty string"],
    [{ text: 7 }, "reason 0: text must be a non-empty string"],
    [{ turn_ids: "t1" }, "reason 0: turn_ids must be a list"],
    [{ turn_ids: [1] }, "reason 0: turn_id 1 is not a turn in the transcript"],
  ];
  for (const [over, error] of cases) {
    assert.deepEqual(validateReasons(verdict([{ ...reason(), ...over }]), TURNS), [error], error);
  }
  assert.deepEqual(validateReasons(verdict(["because"]), TURNS), ["reason 0: not an object"]);
  assert.deepEqual(validateReasons({ ...verdict([]), reasons: "none" as unknown as unknown[] }, TURNS), ["reasons must be an array"]);
});
