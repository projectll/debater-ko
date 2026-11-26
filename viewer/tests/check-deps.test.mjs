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

/**
 * A temporary repo root holding viewer/app/x.tsx (the given source), viewer/package.json and
 * src/format/index.ts; returns the viewer folder and its root.
 */
function repoWith({ source = "", pkg = { name: "v", private: true }, index = 'export const FORMAT_MODULE = "format";\n' } = {}) {
  const root = mkdtempSync(join(tmpdir(), "viewer-boundary-"));
  const viewer = join(root, "viewer");
  mkdirSync(join(viewer, "app"), { recursive: true });
  mkdirSync(join(root, "src", "format"), { recursive: true });
  writeFileSync(join(viewer, "app", "x.tsx"), source);
  writeFileSync(join(viewer, "package.json"), JSON.stringify(pkg));
  writeFileSync(join(root, "src", "format", "index.ts"), index);
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
