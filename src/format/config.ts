// The two-sided debate config (deb-016a): one schema, so a debate can't start from a malformed
// config. Plain TypeScript with no dependency for now; a JSON Schema checked by ajv waits for the
// engine package (docs/DESIGN.md §1). Keys are snake_case, as in src/config/default.json, and
// unknown keys are errors, as in DESIGN §3.3.

import defaults from "./debate.default.json" with { type: "json" };

export interface DebateSide {
  /** Non-empty, distinct from the other side's id. Later records name sides by this id. */
  id: string;
  /** Non-empty display name. */
  name: string;
  /** Non-empty position statement. */
  position: string;
}

export interface DebateConfig {
  /** Non-empty question text. */
  question: string;
  /** Exactly two sides. */
  sides: DebateSide[];
  /** The two side ids, each once. */
  opening_order: string[];
  /** An integer ≥ 1; the shipped default is DEFAULT_REBUTTAL_ROUNDS. */
  rebuttal_rounds: number;
  /** The two side ids, each once. */
  closing_order: string[];
}

export interface ConfigError {
  /** The field path, e.g. `sides`, `sides[1].name`, `opening_order`. */
  path: string;
  message: string;
}

/** The shipped default rebuttal round count, read from src/format/debate.default.json. */
export const DEFAULT_REBUTTAL_ROUNDS: number = defaults.rebuttal_rounds;

const CONFIG_KEYS = ["question", "sides", "opening_order", "rebuttal_rounds", "closing_order"] as const;
const SIDE_KEYS = ["id", "name", "position"] as const;
const ORDER_KEYS = ["opening_order", "closing_order"] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

/**
 * Every problem in a debate config, empty when it's valid. Each error names the field path:
 * `{ path: "sides", message: "expected exactly 2, got 1" }`, `{ path: "question", message: "missing" }`.
 */
export function validateDebateConfig(c: unknown): ConfigError[] {
  if (!isObject(c)) return [{ path: "", message: "expected an object" }];
  const errors: ConfigError[] = [];
  const err = (path: string, message: string) => errors.push({ path, message });

  for (const key of Object.keys(c)) {
    if (!(CONFIG_KEYS as readonly string[]).includes(key)) err(key, "unknown key");
  }

  if (!("question" in c)) err("question", "missing");
  else if (!isNonEmptyString(c.question)) err("question", "expected a non-empty string");

  // The side ids the order fields are checked against; undefined when sides is too broken to say.
  let sideIds: string[] | undefined;
  if (!("sides" in c)) err("sides", "missing");
  else if (!Array.isArray(c.sides)) err("sides", "expected a list");
  else if (c.sides.length !== 2) err("sides", `expected exactly 2, got ${c.sides.length}`);
  else {
    const ids: string[] = [];
    c.sides.forEach((side, i) => {
      const at = `sides[${i}]`;
      if (!isObject(side)) {
        err(at, "expected an object");
        return;
      }
      for (const key of Object.keys(side)) {
        if (!(SIDE_KEYS as readonly string[]).includes(key)) err(`${at}.${key}`, "unknown key");
      }
      for (const key of SIDE_KEYS) {
        if (!(key in side)) err(`${at}.${key}`, "missing");
        else if (!isNonEmptyString(side[key])) err(`${at}.${key}`, "expected a non-empty string");
      }
      if (isNonEmptyString(side.id)) ids.push(side.id);
    });
    if (ids.length === 2 && ids[0] === ids[1]) err("sides[1].id", `${JSON.stringify(ids[1])} repeats sides[0].id`);
    if (ids.length === 2 && ids[0] !== ids[1]) sideIds = ids;
  }

  for (const key of ORDER_KEYS) {
    const order = c[key];
    if (!(key in c)) err(key, "missing");
    else if (!Array.isArray(order) || !order.every((id) => typeof id === "string")) err(key, "expected a list of side ids");
    else if (sideIds) {
      const unknown = order.filter((id) => !sideIds.includes(id));
      if (unknown.length) err(key, `unknown side id ${unknown.map((id) => JSON.stringify(id)).join(", ")}`);
      else if (order.length !== 2 || order[0] === order[1]) err(key, `expected each side id once: ${sideIds.map((id) => JSON.stringify(id)).join(", ")}`);
    }
  }

  if (!("rebuttal_rounds" in c)) err("rebuttal_rounds", "missing");
  else if (typeof c.rebuttal_rounds !== "number" || !Number.isInteger(c.rebuttal_rounds) || c.rebuttal_rounds < 1) {
    err("rebuttal_rounds", "expected an integer of at least 1");
  }

  return errors;
}
