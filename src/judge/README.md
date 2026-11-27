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

## The verdict record

`verdict.ts` (deb-014a) defines the `Verdict` record, `validateVerdict` and `writeVerdict`. A
verdict is its own file, `<verdictsDir>/<transcript_id>.verdict.json` (`verdictsDir` defaults to
`./verdicts`; an option, not an environment variable, per `docs/DESIGN.md` §3.2), and the judge never
appends to or changes the transcript. `node --experimental-strip-types --test "tests/judge/*.test.ts"`
tests it.

## The entrypoint and the budget gate

`judge.ts` (deb-021a) defines the `Judge` interface (`kind`, `callsModel`, `judge(transcript)`) and
`runJudge(transcript, judge, { config, verdictsDir })`, which calls the judge and writes its verdict
with `writeVerdict`. Nothing spends without a budget from Lou: a judge with `callsModel: true` runs
only when `judge.budget_authorized` is exactly `true` in the config passed in. Otherwise `runJudge`
returns `{ status: "not_run", reason: "no_budget" }`, makes no model call and writes no verdict. A
present API key or other secret is not authorization; `runJudge` never reads `process.env`. A judge
that calls no model (the scripted judge, #22) runs with no budget. No model client is built here.

| Key (`judge.default.json`) | Default | Meaning |
| --- | --- | --- |
| `judge.budget_authorized` | `false` | `true` only once Lou has set a budget; lets a judge that calls a model run. Absent or anything but `true` means no budget. |
