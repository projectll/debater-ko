// The two-sided debate format layer (docs/DESIGN.md §2.1 stays intact: this module sits beside the engine).
// It imports nothing from the engine (src/debater/) or the judge (src/judge/), and no model client:
// scripts/check-format-deps.mjs enforces that. Later format tickets add the records and functions here.

export const FORMAT_MODULE = "format";

export { DEFAULT_REBUTTAL_ROUNDS, validateDebateConfig } from "./config.ts";
export type { ConfigError, DebateConfig, DebateSide } from "./config.ts";
export { TURN_KINDS, validateTurns } from "./turn.ts";
export type { TurnKind, TurnRecord } from "./turn.ts";
export { pointId, turnOfPoint, validatePoints } from "./point.ts";
export type { Point } from "./point.ts";
export { runOrder } from "./run-order.ts";
export type { Slot } from "./run-order.ts";
