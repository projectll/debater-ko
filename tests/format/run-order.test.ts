// deb-017a: the opening phase of the two-sided run order (src/format/run-order.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { runOrder } from "../../src/format/index.ts";
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

test("1. for a sample config, runOrder starts with two opening slots, in opening_order", () => {
  const slots = runOrder(sample());
  assert.deepEqual(slots.slice(0, 2), [
    { index: 0, kind: "opening", side: "pro" },
    { index: 1, kind: "opening", side: "con" },
  ]);
});

test("2. with opening_order reversed, the two opening slots swap", () => {
  const c = sample();
  c.opening_order = ["con", "pro"];
  assert.deepEqual(runOrder(c).slice(0, 2), [
    { index: 0, kind: "opening", side: "con" },
    { index: 1, kind: "opening", side: "pro" },
  ]);
});

test("3. no slot of any other kind has an index lower than either opening slot's", () => {
  const slots = runOrder(sample());
  const openings = slots.filter((s) => s.kind === "opening");
  assert.equal(openings.length, 2);
  const lastOpening = Math.max(...openings.map((s) => s.index));
  for (const slot of slots.filter((s) => s.kind !== "opening")) {
    assert.ok(slot.index > lastOpening, `${slot.kind} slot ${slot.index} comes before an opening`);
  }
});

test("4. each slot's index is its position in the run order, and opening slots carry no round", () => {
  const slots = runOrder(sample());
  slots.forEach((slot, i) => assert.equal(slot.index, i));
  for (const slot of slots.filter((s) => s.kind === "opening")) assert.equal("round" in slot, false);
});

test("5. an invalid config throws a RangeError naming its errors", () => {
  const c = sample();
  c.opening_order = ["pro", "neutral"];
  assert.throws(() => runOrder(c), { name: "RangeError", message: /opening_order: unknown side id "neutral"/ });
});
