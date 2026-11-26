// deb-011a: the format layer's import boundary (scripts/check-format-deps.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findViolations } from "../../scripts/check-format-deps.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** A temporary src/format/ holding one file with the given source; returns the folder. */
function formatDirWith(source) {
  const root = mkdtempSync(join(tmpdir(), "format-boundary-"));
  const dir = join(root, "src", "format");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "x.ts"), source);
  return { dir, done: () => rmSync(root, { recursive: true, force: true }) };
}

test("1. the real src/format/ has no violations", () => {
  assert.deepEqual(findViolations(join(ROOT, "src", "format")), []);
});

test("2. an engine import is a violation", () => {
  const { dir, done } = formatDirWith('import { load } from "../debater/config.ts";\n');
  try {
    const v = findViolations(dir);
    assert.equal(v.length, 1);
    assert.equal(v[0].spec, "../debater/config.ts");
  } finally { done(); }
});

test("3. an @anthropic-ai/sdk import is a violation", () => {
  const { dir, done } = formatDirWith('import Anthropic from "@anthropic-ai/sdk";\n');
  try {
    assert.deepEqual(findViolations(dir).map((v) => v.spec), ["@anthropic-ai/sdk"]);
  } finally { done(); }
});

test("4. an openai import is a violation", () => {
  const { dir, done } = formatDirWith('const OpenAI = require("openai");\n');
  try {
    assert.deepEqual(findViolations(dir).map((v) => v.spec), ["openai"]);
  } finally { done(); }
});

test("5. a node:fs import is fine", () => {
  const { dir, done } = formatDirWith('import { readFileSync } from "node:fs";\n');
  try {
    assert.deepEqual(findViolations(dir), []);
  } finally { done(); }
});
