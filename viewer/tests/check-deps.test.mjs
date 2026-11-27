// deb-015a: the viewer's import boundary (viewer/scripts/check-deps.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findViewerViolations } from "../scripts/check-deps.mjs";

const VIEWER = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * A source line importing spec. Built at run time so this file holds no literal import of a
 * forbidden spec: the real-viewer case (1) scans this file too.
 */
const importing = (spec) => `import x from ${JSON.stringify(spec)};\n`;
const reExporting = (spec) => `export { x } from ${JSON.stringify(spec)};\n`;

/** Stand-ins for src/judge/ (deb-075a), shaped like the real files' imports. */
const JUDGE = {
  "verdict.ts": 'import { mkdirSync } from "node:fs";\nexport function validateVerdict() {}\n',
  "reasons.ts": 'import type { TurnRecord } from "../format/turn.ts";\nimport type { Verdict } from "./verdict.ts";\n',
  "index.ts": 'export * from "./verdict.ts";\nexport * from "./scripted.ts";\n',
  "scripted.ts": "export function scriptedJudge() {}\n",
  "rubric.ts": "export const RUBRIC = {};\n",
};

/**
 * A temporary repo root holding viewer/app/x.tsx (the given source), viewer/package.json,
 * src/format/index.ts and the given src/judge/ files; returns the viewer folder and its root.
 */
function repoWith({ source = "", pkg = { name: "v", private: true }, index = 'export const FORMAT_MODULE = "format";\n', judge = JUDGE } = {}) {
  const root = mkdtempSync(join(tmpdir(), "viewer-boundary-"));
  const viewer = join(root, "viewer");
  mkdirSync(join(viewer, "app"), { recursive: true });
  mkdirSync(join(root, "src", "format"), { recursive: true });
  mkdirSync(join(root, "src", "judge"), { recursive: true });
  writeFileSync(join(viewer, "app", "x.tsx"), source);
  writeFileSync(join(viewer, "package.json"), JSON.stringify(pkg));
  writeFileSync(join(root, "src", "format", "index.ts"), index);
  for (const [name, text] of Object.entries(judge)) writeFileSync(join(root, "src", "judge", name), text);
  return { viewer, root, done: () => rmSync(root, { recursive: true, force: true }) };
}

/** The specs findViewerViolations reports for a temporary repo built by repoWith. */
function specsFor(opts) {
  const { viewer, root, done } = repoWith(opts);
  try {
    return findViewerViolations(viewer, root).map((v) => v.spec);
  } finally { done(); }
}

test("1. the real viewer/ passes", () => {
  assert.deepEqual(findViewerViolations(VIEWER), []);
});

test("2. an engine import fails", () => {
  assert.deepEqual(specsFor({ source: importing("../../src/debater/config.ts") }), ["../../src/debater/config.ts"]);
});

test("3. a runner import fails", () => {
  assert.deepEqual(specsFor({ source: importing("../../src/format/runner.ts") }), ["../../src/format/runner.ts"]);
});

test("4. an openai import fails", () => {
  assert.deepEqual(specsFor({ source: importing("openai") }), ["openai"]);
});

test("5. a package.json listing @anthropic-ai/sdk fails", () => {
  const pkg = { name: "v", private: true, dependencies: { "@anthropic-ai/sdk": "^1.0.0" } };
  assert.deepEqual(specsFor({ pkg }), ["@anthropic-ai/sdk"]);
});

test("6. an import of the format layer's public export passes", () => {
  assert.deepEqual(specsFor({ source: importing("../../src/format/index.ts") }), []);
});

test("7. an index.ts that re-exports ./runner.ts fails", () => {
  assert.deepEqual(specsFor({ index: reExporting("./runner.ts") }), ["./runner.ts"]);
});

test("8. an extensionless runner import fails too", () => {
  assert.deepEqual(specsFor({ source: importing("../../src/format/runner") }), ["../../src/format/runner"]);
});

// deb-075a: from src/judge/ the viewer may import only verdict.ts and reasons.ts.

test("9. imports of the verdict types and the verdict validator pass", () => {
  const source = importing("../../src/judge/verdict.ts") + importing("../../src/judge/reasons.ts");
  assert.deepEqual(specsFor({ source }), []);
});

test("10. an import of the scripted judge fails", () => {
  assert.deepEqual(specsFor({ source: importing("../../src/judge/scripted.ts") }), ["../../src/judge/scripted.ts"]);
});

test("11. an import of the judge index fails, by file or by folder", () => {
  const source = importing("../../src/judge/index.ts") + importing("../../src/judge");
  assert.deepEqual(specsFor({ source }), ["../../src/judge/index.ts", "../../src/judge"]);
});

test("12. an import of the rubric fails", () => {
  assert.deepEqual(specsFor({ source: importing("../../src/judge/rubric.ts") }), ["../../src/judge/rubric.ts"]);
});

test("13. a reasons.ts that imports ./scripted.ts fails", () => {
  const judge = { ...JUDGE, "reasons.ts": JUDGE["reasons.ts"] + importing("./scripted.ts") };
  assert.deepEqual(specsFor({ judge }), ["./scripted.ts"]);
});

test("14. an openai import still fails with the judge files present", () => {
  const source = importing("../../src/judge/verdict.ts") + importing("openai");
  assert.deepEqual(specsFor({ source }), ["openai"]);
});

test("15. extensionless imports of the two allowed files pass", () => {
  const source = importing("../../src/judge/verdict") + importing("../../src/judge/reasons.js");
  assert.deepEqual(specsFor({ source }), []);
});

test("16. a verdict.ts that imports a package or the format runner fails; node: builtins pass", () => {
  const judge = { ...JUDGE, "verdict.ts": JUDGE["verdict.ts"] + importing("openai") + importing("../format/runner.ts") };
  assert.deepEqual(specsFor({ judge }), ["openai", "../format/runner.ts"]);
});
