// The two-sided run order (deb-017a): the slots a debate's turns fill, in order. One function that
// later tickets extend: deb-020a adds the rebuttal slots and deb-024a the closing slots, always
// after the two opening slots, so no rebuttal turn is valid until both openings exist. The runner
// (deb-032a) works out the current slot from this list.

import { validateDebateConfig } from "./config.ts";
import type { DebateConfig } from "./config.ts";
import type { TurnKind } from "./turn.ts";

export interface Slot {
  /** 0-based position in the run order. */
  index: number;
  kind: TurnKind;
  /** The side id whose turn fills this slot. */
  side: string;
  /** The 1-based rebuttal round; set only on rebuttal slots. */
  round?: number;
}

/**
 * The run order for a debate config: for now the opening phase only, one opening slot per side in
 * `opening_order`, so the first side presents its case first. Throws a `RangeError` naming the
 * config's errors when it isn't valid, so no run order names an unknown side.
 */
export function runOrder(config: DebateConfig): Slot[] {
  const errors = validateDebateConfig(config);
  if (errors.length) {
    throw new RangeError(`invalid debate config: ${errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`);
  }
  return config.opening_order.map((side, index) => ({ index, kind: "opening", side }));
}
