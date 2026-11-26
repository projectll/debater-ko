// deb-013a: the judge's import boundary (scripts/check-judge-deps.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findJudgeViolations } from "../../scripts/check-judge-deps.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** A temporary src/ holding one file at rel (e.g. "judge/x.ts") with the given source; returns the src folder. */
function srcWith(rel, source) {
  const root = mkdtempSync(join(tmpdir(), "judge-boundary-"));
  const src = join(root, "src");
  const file = join(src, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, source);
  return { src, done: () => rmSync(root, { recursive: true, force: true }) };
}

test("1. the real src/ has no violations", () => {
  assert.deepEqual(findJudgeViolations(join(ROOT, "src")), []);
});

test("2. an engine file importing src/judge/ is a violation", () => {
  const { src, done } = srcWith("debater/config.ts", 'import { JUDGE_MODULE } from "../judge/index.ts";\n');
  try {
    assert.deepEqual(findJudgeViolations(src).map((v) => v.spec), ["../judge/index.ts"]);
  } finally { done(); }
});

test("3. a judge file importing the engine's tally is a violation", () => {
  const { src, done } = srcWith("judge/x.ts", 'import { tally } from "../debater/tally.ts";\n');
  try {
    assert.deepEqual(findJudgeViolations(src).map((v) => v.spec), ["../debater/tally.ts"]);
  } finally { done(); }
});

test("4. a judge file importing an engine pass is a violation", () => {
  const { src, done } = srcWith("judge/x.ts", 'import { run } from "../debater/passes/x.ts";\n');
  try {
    assert.deepEqual(findJudgeViolations(src).map((v) => v.spec), ["../debater/passes/x.ts"]);
  } finally { done(); }
});

test("5. a judge file importing the engine's GitHub client is a violation", () => {
  const { src, done } = srcWith("judge/x.ts", 'import { setLabels } from "../debater/github.ts";\n');
  try {
    assert.deepEqual(findJudgeViolations(src).map((v) => v.spec), ["../debater/github.ts"]);
  } finally { done(); }
});

test("6. a judge file importing the format layer is fine", () => {
  const { src, done } = srcWith("judge/x.ts", 'import { FORMAT_MODULE } from "../format/index.ts";\n');
  try {
    assert.deepEqual(findJudgeViolations(src), []);
  } finally { done(); }
});
