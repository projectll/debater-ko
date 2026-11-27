// deb-016a: the two-sided debate config schema (src/format/config.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_REBUTTAL_ROUNDS, validateDebateConfig } from "../../src/format/index.ts";
import type { DebateConfig } from "../../src/format/index.ts";

/** A valid two-sided sample config. */
function sample(): DebateConfig {
  return {
    question: "Should the city build a new library?",
    sides: [
      { id: "pro", name: "Pro", position: "The city should build it." },
      { id: "con", name: "Con", position: "The city should not build it." },
    ],
    opening_order: ["pro", "con"],
    rebuttal_rounds: 3,
    closing_order: ["con", "pro"],
  };
}

const paths = (c: unknown) => validateDebateConfig(c).map((e) => e.path);

test("1. a sample two-sided config passes with no errors", () => {
  assert.deepEqual(validateDebateConfig(sample()), []);
});

test("2. a config with one side fails on sides", () => {
  const c = sample();
  c.sides = c.sides.slice(0, 1);
  assert.deepEqual(validateDebateConfig(c), [{ path: "sides", message: "expected exactly 2, got 1" }]);
});

test("3. a config with three sides fails on sides", () => {
  const c = sample();
  c.sides.push({ id: "third", name: "Third", position: "Neither." });
  assert.deepEqual(validateDebateConfig(c), [{ path: "sides", message: "expected exactly 2, got 3" }]);
});

test("4. a config with no question fails on question", () => {
  const c: Record<string, unknown> = sample();
  delete c.question;
  assert.deepEqual(validateDebateConfig(c), [{ path: "question", message: "missing" }]);
});

test("5. an opening_order naming an unknown side id fails on opening_order", () => {
  const c = sample();
  c.opening_order = ["pro", "neutral"];
  assert.deepEqual(validateDebateConfig(c), [{ path: "opening_order", message: 'unknown side id "neutral"' }]);
});

test("6. each missing top-level field is named by its path", () => {
  for (const key of ["question", "sides", "opening_order", "rebuttal_rounds", "closing_order"]) {
    const c: Record<string, unknown> = sample();
    delete c[key];
    assert.deepEqual(validateDebateConfig(c), [{ path: key, message: "missing" }], key);
  }
});

test("7. a side missing a field, or with an empty one, is named by its path", () => {
  const c: Record<string, unknown>[] = sample().sides as unknown as Record<string, unknown>[];
  const config = { ...sample(), sides: c };
  delete c[1].position;
  c[0].name = "";
  assert.deepEqual(paths(config), ["sides[0].name", "sides[1].position"]);
});

test("8. repeated side ids fail on the second side's id", () => {
  const c = sample();
  c.sides[1].id = "pro";
  assert.deepEqual(paths(c), ["sides[1].id"]);
});

test("9. an order listing one side twice, or only once, fails on that order", () => {
  const c = sample();
  c.closing_order = ["pro", "pro"];
  c.opening_order = ["pro"];
  assert.deepEqual(paths(c), ["opening_order", "closing_order"]);
});

test("10. rebuttal_rounds must be an integer of at least 1", () => {
  for (const value of [0, -1, 1.5, "3", null]) {
    const c: Record<string, unknown> = sample();
    c.rebuttal_rounds = value;
    assert.deepEqual(paths(c), ["rebuttal_rounds"], String(value));
  }
  const c = sample();
  c.rebuttal_rounds = 1;
  assert.deepEqual(validateDebateConfig(c), []);
});

test("11. unknown keys are errors, at the top level and in a side", () => {
  const c: Record<string, unknown> = { ...sample(), judge: "x" };
  (c.sides as Record<string, unknown>[])[0].colour = "red";
  assert.deepEqual(paths(c), ["judge", "sides[0].colour"]);
});

test("12. a value that is not an object fails at the root", () => {
  for (const value of [null, [], "config", 3]) {
    assert.deepEqual(validateDebateConfig(value), [{ path: "", message: "expected an object" }], String(value));
  }
});

test("13. the shipped default rebuttal round count is 3, read from debate.default.json", () => {
  const file = JSON.parse(readFileSync(new URL("../../src/format/debate.default.json", import.meta.url), "utf8"));
  assert.deepEqual(file, { rebuttal_rounds: 3 });
  assert.equal(DEFAULT_REBUTTAL_ROUNDS, 3);
});

test("14. the format README has a row for each key in debate.default.json", () => {
  const readme = readFileSync(new URL("../../src/format/README.md", import.meta.url), "utf8");
  const file = JSON.parse(readFileSync(new URL("../../src/format/debate.default.json", import.meta.url), "utf8"));
  for (const key of Object.keys(file)) assert.match(readme, new RegExp(`^\\| \`${key}\` \\|`, "m"), key);
});
