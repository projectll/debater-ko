# src/judge: the judge seat

The judge for two-sided debates: it reads a finished transcript and writes a verdict. It is a
product feature of debater-ko (topic 006, core-product#1068), not a team bot, and it sits beside the
engine and the format layer, not inside the engine, so the engine's never-judges, never-calls-a-model
boundary (`docs/DESIGN.md` §2.1) stays intact. It is not the optional quality eval of
`docs/DESIGN.md` §2.3.

## Boundary

- The engine (`src/debater/`) never imports anything under `src/judge/`.
- The judge never imports the engine's passes (`src/debater/passes/`), tally (`src/debater/tally.ts`),
  GitHub client (`src/debater/github.ts`) or CLI (`src/debater/cli.ts`): nothing that could move
  labels or write Issues.
- It may use the format layer (`src/format/`): its transcript types and reader.

`node scripts/check-judge-deps.mjs` checks this and fails on any such import;
`node --test "tests/judge/*.test.mjs"` tests the check.
