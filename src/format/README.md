# src/format: the two-sided debate format

The format layer for two-sided debates: the debate config, the run order, the turn and point
records, the transcript header and its JSON Lines stored form, the reader, replay, the runner and
the end rule. It sits beside the engine, not inside it (topic 006, core-product#1068), so the
engine's never-judges, never-calls-a-model boundary (`docs/DESIGN.md` §2.1) stays intact.

## Boundary

- No import from the engine (`src/debater/`) or the judge (`src/judge/`).
- No model client package (`@anthropic-ai/*`, `openai`, `@google/generative-ai`, `@google/genai`,
  `cohere-ai`, `@mistralai/mistralai`, `ollama`, `@langchain/*`, `langchain*`).
- It shares only config conventions with the engine: JSON files and snake_case keys.

`node scripts/check-format-deps.mjs` checks this and fails on any such import;
`node --test "tests/format/*.test.mjs"` tests the check.

## Records

- **Turn** (`turn.ts`): `turn_id`, `seq`, `side`, `speaker`, `kind` (`opening`, `rebuttal` or
  `closing`) and `text`. `validateTurns(turns)` returns one error string per problem, naming the
  turn's 0-based index and the field or the sequence gap. Extra fields aren't an error, so later
  tickets can add theirs. Every turn also has `points`, a list (possibly empty; deb-018a).
- **Point** (`point.ts`): `point_id` and `claim`, in order on its turn. `point_id` is
  `<turn_id>.p<n>`, `n` the 1-based position (`pointId(turnId, n)`), so it is unique across the
  transcript and resolves to one turn. `validatePoints(turns)` reports a repeated `point_id`, one
  that doesn't match its turn and position, and a missing or empty `claim`, naming the turn and
  point indexes; `turnOfPoint(turns, id)` returns the one turn holding the point, or `undefined`.

`node --experimental-strip-types --test "tests/format/*.test.ts"` tests the records.
