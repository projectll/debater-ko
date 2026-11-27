// deb-014a: the verdict record, validateVerdict and writeVerdict (src/judge/verdict.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VERDICT_FORMAT_VERSION, validateVerdict, writeVerdict } from "../../src/judge/index.ts";
import type { Verdict } from "../../src/judge/index.ts";

const FIELDS = [
  "verdict_id",
  "transcript_id",
  "verdict_format_version",
  "rubric_version",
  "outcome",
  "winner",
  "scores",
  "reasons",
  "judged_at",
];

/** A valid win verdict, built by hand (the scripted judge is #22). */
function win(): Verdict {
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
    reasons: [],
    judged_at: "2026-11-26T18:30:00.000Z",
  };
}

function tie(): Verdict {
  return { ...win(), verdict_id: "v2", outcome: "tie", winner: null };
}

function forfeit(): Verdict {
  return {
    ...win(),
    verdict_id: "v3",
    outcome: "forfeit",
    winner: "con",
    scores: {
      pro: { answer: 0, evidence: 0, consistency: 0, total: 0 },
      con: { answer: 1, evidence: 1, consistency: 1, total: 3 },
    },
  };
}

function tempDir(t: { after: (fn: () => void) => void }): string {
  const dir = mkdtempSync(join(tmpdir(), "deb-014a-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

test("1. a win verdict written with writeVerdict reads back with every named field", (t) => {
  const dir = tempDir(t);
  const path = writeVerdict(win(), { verdictsDir: dir });
  const text = readFileSync(path, "utf8");
  assert.ok(text.endsWith("}\n"), "pretty JSON ending with a newline");
  assert.ok(text.includes('\n  "verdict_id"'), "pretty-printed");
  const back = JSON.parse(text);
  assert.deepEqual(Object.keys(back).sort(), [...FIELDS].sort());
  assert.deepEqual(back, win());
  assert.equal(back.verdict_format_version, 1);
  assert.equal(back.transcript_id, "debate-001");
  assert.equal(back.rubric_version, "2026-11-20-judge-rubric-document.md");
  assert.deepEqual(validateVerdict(back), []);
});

test("2. a tie has winner null; a tie with a non-null winner fails validateVerdict", () => {
  assert.equal(tie().winner, null);
  assert.deepEqual(validateVerdict(tie()), []);
  assert.deepEqual(validateVerdict({ ...tie(), winner: "pro" }), ["winner must be null when outcome is tie"]);
});

test("3. a forfeit verdict still carries scores for both sides, and must", (t) => {
  const dir = tempDir(t);
  const back = JSON.parse(readFileSync(writeVerdict(forfeit(), { verdictsDir: dir }), "utf8"));
  assert.deepEqual(Object.keys(back.scores).sort(), ["con", "pro"]);
  for (const side of ["pro", "con"]) {
    assert.deepEqual(Object.keys(back.scores[side]).sort(), ["answer", "consistency", "evidence", "total"]);
  }
  const noScores: Record<string, unknown> = forfeit();
  delete noScores.scores;
  assert.deepEqual(validateVerdict(noScores), ["missing scores"]);
  // A both-sides forfeit is a tie in winner terms: winner null is allowed on a forfeit.
  assert.deepEqual(validateVerdict({ ...forfeit(), winner: null }), []);
});

test("4. the file lands at <verdictsDir>/<transcript_id>.verdict.json, creating the folder", (t) => {
  const dir = join(tempDir(t), "nested", "verdicts");
  const path = writeVerdict(win(), { verdictsDir: dir });
  assert.equal(path, join(dir, "debate-001.verdict.json"));
  assert.ok(existsSync(path));
});

test("5. with no option the file lands at ./verdicts/ relative to the working folder", (t) => {
  const dir = tempDir(t);
  const before = process.cwd();
  process.chdir(dir);
  t.after(() => process.chdir(before));
  const path = writeVerdict(win());
  assert.equal(path, join("verdicts", "debate-001.verdict.json"));
  assert.ok(existsSync(join(dir, "verdicts", "debate-001.verdict.json")));
});

test("6. a transcript file in the same folder has the same bytes before and after writeVerdict", (t) => {
  const dir = tempDir(t);
  const transcript = join(dir, "debate-001.jsonl");
  writeFileSync(transcript, '{"turn_id":"t1","seq":1,"side":"pro","speaker":"Pro","kind":"opening","text":"We should."}\n');
  const before = sha256(transcript);
  writeVerdict(win(), { verdictsDir: dir });
  assert.equal(sha256(transcript), before);
});

test("7. validateVerdict names each missing field", () => {
  for (const field of FIELDS) {
    const v: Record<string, unknown> = win();
    delete v[field];
    assert.deepEqual(validateVerdict(v), [`missing ${field}`], field);
  }
});

test("8. validateVerdict names each ill-typed field", () => {
  const cases: [string, unknown, string][] = [
    ["verdict_id", "", "verdict_id must be a non-empty string"],
    ["transcript_id", 7, "transcript_id must be a non-empty string"],
    ["rubric_version", null, "rubric_version must be a non-empty string"],
    ["verdict_format_version", 2, "verdict_format_version must be 1"],
    ["outcome", "draw", 'outcome "draw" is not one of win, tie, forfeit'],
    ["winner", 3, "winner must be a non-empty string or null"],
    ["scores", [], "scores must be an object of sides"],
    ["reasons", "none", "reasons must be an array"],
    ["judged_at", "yesterday", "judged_at must be an ISO 8601 date-time"],
  ];
  for (const [field, value, error] of cases) {
    assert.deepEqual(validateVerdict({ ...win(), [field]: value }), [error], field);
  }
  const badScore = win();
  (badScore.scores.con as Record<string, unknown>).total = "6";
  assert.deepEqual(validateVerdict(badScore), ["scores.con.total must be a number"]);
  assert.deepEqual(validateVerdict(null), ["verdict: not an object"]);
});

test("9. extra: a win needs a winner, and transcript_id can't be a path", () => {
  assert.deepEqual(validateVerdict({ ...win(), winner: null }), ["winner must be a side id when outcome is win"]);
  assert.deepEqual(validateVerdict({ ...win(), transcript_id: "../escape" }), ["transcript_id must not be a path"]);
});

test("10. writeVerdict throws on an invalid verdict and writes nothing", (t) => {
  const dir = join(tempDir(t), "verdicts");
  assert.throws(() => writeVerdict({ ...tie(), winner: "pro" }, { verdictsDir: dir }), /winner must be null when outcome is tie/);
  assert.equal(existsSync(dir), false);
});
