// deb-025a: the debate config loader (src/format/load-config.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadDebateConfig } from "../../src/format/index.ts";

const dir = mkdtempSync(join(tmpdir(), "deb-025a-"));

/** Writes `text` to a new file in the temporary folder and returns its path. */
function file(name: string, text: string): string {
  const path = join(dir, name);
  writeFileSync(path, text);
  return path;
}

/** A valid two-sided sample config, without rebuttal_rounds. */
function sample(): Record<string, unknown> {
  return {
    question: "Should the city build a new library?",
    sides: [
      { id: "pro", name: "Pro", position: "The city should build it." },
      { id: "con", name: "Con", position: "The city should not build it." },
    ],
    opening_order: ["pro", "con"],
    closing_order: ["con", "pro"],
  };
}

test("1. a valid config file returns ok with the parsed config, rebuttal_rounds 3 when left out", () => {
  const result = loadDebateConfig(file("valid.json", JSON.stringify(sample())));
  assert.deepEqual(result, { ok: true, config: { ...sample(), rebuttal_rounds: 3 } });
});

test("2. a rebuttal_rounds in the file wins over the default", () => {
  const result = loadDebateConfig(file("rounds.json", JSON.stringify({ ...sample(), rebuttal_rounds: 1 })));
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.config.rebuttal_rounds, 1);
});

test("3. a file with one side returns not ok with error.path sides", () => {
  const c = sample();
  c.sides = (c.sides as unknown[]).slice(0, 1);
  const result = loadDebateConfig(file("one-side.json", JSON.stringify(c)));
  assert.deepEqual(result, { ok: false, error: { path: "sides", message: "expected exactly 2, got 1" } });
});

test("4. only the first error is returned", () => {
  const c = sample();
  delete c.question;
  c.opening_order = ["pro", "neutral"];
  const result = loadDebateConfig(file("two-errors.json", JSON.stringify(c)));
  assert.deepEqual(result, { ok: false, error: { path: "question", message: "missing" } });
});

test("5. a file that isn't JSON returns not ok without throwing, naming the file", () => {
  const path = file("broken.json", "{ question: ");
  const result = loadDebateConfig(path);
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.path, "");
  assert.match(!result.ok ? result.error.message : "", new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} is not valid JSON`));
});

test("6. a missing file returns not ok without throwing, naming the file", () => {
  const path = join(dir, "absent.json");
  const result = loadDebateConfig(path);
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.path, "");
  assert.ok(!result.ok && result.error.message.includes(path));
});

test("7. JSON that isn't an object fails at the root, with no defaults filled in", () => {
  for (const text of ["[]", "null", "3"]) {
    assert.deepEqual(loadDebateConfig(file("not-object.json", text)), { ok: false, error: { path: "", message: "expected an object" } }, text);
  }
});
