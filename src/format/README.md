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
