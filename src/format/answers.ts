// The answers link on rebuttal turns (deb-019a): each rebuttal lists the opposing points it
// answers, so the exchange is a chain the viewer can draw. A rebuttal answers only the qualifying
// turn: the other side's latest earlier turn (highest `seq` before it) that carries points,
// skipping forfeits (`forfeited: true`, #35) and other empty-points turns. `submitTurn` (#36)
// runs this validator.

import type { TurnRecord } from "./turn.ts";

/** The other side's latest turn before `turn` (highest earlier `seq`) with a non-empty `points` list. */
export function qualifyingTurn(turns: TurnRecord[], turn: TurnRecord): TurnRecord | undefined {
  let best: TurnRecord | undefined;
  for (const other of turns) {
    if (other.side === turn.side || other.seq >= turn.seq) continue;
    if (other.forfeited === true || !Array.isArray(other.points) || other.points.length === 0) continue;
    if (best === undefined || other.seq > best.seq) best = other;
  }
  return best;
}

/**
 * Every problem in the turns' `answers` links, one string each, empty when they're valid. Turns are
 * checked in `seq` order; each error names the turn's `seq` and, where there is one, the offending
 * id: `seq 4: answers "t1.p1" is not a point of t3, the other side's latest turn with points`.
 */
export function validateAnswers(turns: TurnRecord[]): string[] {
  if (!Array.isArray(turns)) return ["turns: not a list"];
  const errors: string[] = [];
  const ordered = turns
    .filter((turn) => typeof turn === "object" && turn !== null && typeof turn.seq === "number")
    .sort((a, b) => a.seq - b.seq);
  for (const turn of ordered) {
    const at = `seq ${turn.seq}`;
    const hasAnswers = "answers" in turn;
    if (turn.kind !== "rebuttal") {
      if (hasAnswers) errors.push(`${at}: ${turn.kind} turns may not carry answers`);
      continue;
    }
    // A forfeited rebuttal says nothing, so it answers nothing (#35's record has no answers key).
    if (turn.forfeited === true) {
      if (hasAnswers) errors.push(`${at}: forfeited turns may not carry answers`);
      continue;
    }

    const answers = (turn as { answers?: unknown }).answers;
    if (!hasAnswers) {
      errors.push(`${at}: a rebuttal turn must carry answers`);
      continue;
    }
    if (!Array.isArray(answers) || answers.some((id) => typeof id !== "string")) {
      errors.push(`${at}: answers must be a list of point ids`);
      continue;
    }
    if (answers.length === 0) {
      errors.push(`${at}: answers must not be empty`);
      continue;
    }

    const target = qualifyingTurn(ordered, turn);
    if (target === undefined) {
      errors.push(`${at}: no earlier turn from the other side carries points to answer`);
      continue;
    }
    const allowed = new Set(target.points.map((point) => point?.point_id));
    const seen = new Set<string>();
    for (const id of answers as string[]) {
      if (seen.has(id)) errors.push(`${at}: answers ${JSON.stringify(id)} is listed twice`);
      else if (!allowed.has(id)) {
        errors.push(`${at}: answers ${JSON.stringify(id)} is not a point of ${target.turn_id}, the other side's latest turn with points`);
      }
      seen.add(id);
    }
  }
  return errors;
}
