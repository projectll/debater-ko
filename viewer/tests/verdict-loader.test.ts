// deb-078a: the viewer loads a transcript's verdict from the verdicts folder (viewer/lib/verdicts.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadVerdict, verdictsDir } from "../lib/verdicts.ts";
import { VERDICT_FORMAT_VERSION } from "../../src/judge/verdict.ts";
import type { Verdict } from "../../src/judge/verdict.ts";
import type { TurnRecord } from "../../src/format/turn.ts";

function turn(seq: number, side: string, kind: TurnRecord["kind"]): TurnRecord {
  return { turn_id: `t${seq}`, seq, side, speaker: side, kind, text: "We should.", points: [] };
}

/**
 * A stand-in for `fixture-full` (#39, not on main yet): a whole debate, opening to closing. Only its
 * header's transcript_id and its turn ids matter to the loader.
 */
const FULL = {
  header: { transcript_id: "fixture-full" },
  turns: [
    turn(1, "pro", "opening"), turn(2, "con", "opening"),
    turn(3, "pro", "rebuttal"), turn(4, "con", "rebuttal"),
    turn(5, "pro", "closing"), turn(6, "con", "closing"),
  ],
};

function verdict(over: Partial<Verdict> = {}): Verdict {
  return {
    verdict_id: "v1",
    transcript_id: "fixture-full",
    verdict_format_version: VERDICT_FORMAT_VERSION,
    rubric_version: "rubric-1",
    outcome: "win",
    winner: "pro",
    scores: {
      pro: { answer: 3, evidence: 2, consistency: 3, total: 8 },
      con: { answer: 2, evidence: 2, consistency: 2, total: 6 },
    },
    reasons: [{ side: "pro", dimension: "answer", text: "Pro answered every point.", turn_ids: ["t3", "t5"] }],
    judged_at: "2026-11-24T14:00:00Z",
    ...over,
  };
}

/** A fresh verdicts folder holding the given files (name → contents), removed after the test. */
function folder(t: { after: (fn: () => void) => void }, files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "verdicts-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

const FILE = "fixture-full.verdict.json";

test("P1: no verdict file is no verdict, not an error", (t) => {
  assert.deepEqual(loadVerdict(FULL, folder(t)), { kind: "none" });
});

test("P1: another transcript's verdict file is not this one's", (t) => {
  const dir = folder(t, { "other.verdict.json": JSON.stringify(verdict({ transcript_id: "other" })) });
  assert.deepEqual(loadVerdict(FULL, dir), { kind: "none" });
});

test("P2: a valid verdict loads", (t) => {
  const v = verdict();
  const dir = folder(t, { [FILE]: `${JSON.stringify(v, null, 2)}\n` });
  assert.deepEqual(loadVerdict(FULL, dir), { kind: "ok", verdict: v });
});

test("P3: a reason citing an unknown turn id is an error naming it", (t) => {
  const v = verdict({ reasons: [{ side: "con", dimension: "evidence", text: "Con cited sources.", turn_ids: ["t9"] }] });
  const result = loadVerdict(FULL, folder(t, { [FILE]: JSON.stringify(v) }));
  assert.equal(result.kind, "error");
  assert.match((result as { reason: string }).reason, /reason 0: turn_id "t9" is not a turn in the transcript/);
});

test("P3: a verdict whose transcript_id names another transcript is an error naming transcript_id", (t) => {
  const v = verdict({ transcript_id: "fixture-short" });
  const result = loadVerdict(FULL, folder(t, { [FILE]: JSON.stringify(v) }));
  assert.equal(result.kind, "error");
  assert.match((result as { reason: string }).reason, /transcript_id "fixture-short" does not match/);
});

test("P3: a verdict failing validateVerdict is an error with its reason", (t) => {
  const { winner: _, ...noWinner } = verdict();
  const result = loadVerdict(FULL, folder(t, { [FILE]: JSON.stringify(noWinner) }));
  assert.deepEqual(result, { kind: "error", reason: "missing winner" });
});

test("T1: a verdict file that isn't JSON is an error", (t) => {
  const result = loadVerdict(FULL, folder(t, { [FILE]: "{ not json" }));
  assert.equal(result.kind, "error");
  assert.match((result as { reason: string }).reason, /^verdict is not valid JSON/);
});

test("E1: verdictsDir reads VERDICTS_DIR, defaulting to ./verdicts", (t) => {
  const saved = process.env.VERDICTS_DIR;
  t.after(() => {
    if (saved === undefined) delete process.env.VERDICTS_DIR;
    else process.env.VERDICTS_DIR = saved;
  });
  delete process.env.VERDICTS_DIR;
  assert.equal(verdictsDir(), "./verdicts");
  process.env.VERDICTS_DIR = "/data/verdicts";
  assert.equal(verdictsDir(), "/data/verdicts");
});

test("E1: loadVerdict reads from VERDICTS_DIR when no folder is given", (t) => {
  const saved = process.env.VERDICTS_DIR;
  t.after(() => {
    if (saved === undefined) delete process.env.VERDICTS_DIR;
    else process.env.VERDICTS_DIR = saved;
  });
  const v = verdict();
  process.env.VERDICTS_DIR = folder(t, { [FILE]: JSON.stringify(v) });
  assert.deepEqual(loadVerdict(FULL), { kind: "ok", verdict: v });
});
