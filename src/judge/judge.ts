// The judge entrypoint and its budget gate (deb-021a): nothing spends without a budget from Lou. A judge
// that calls a model runs only when `judge.budget_authorized` is exactly `true` in the config passed in;
// otherwise runJudge returns not_run/no_budget before calling it and writes nothing. A present API key or
// other secret is not authorization, so this never reads process.env. A judge that calls no model (the
// scripted judge, #22) runs with no budget.

import { writeVerdict } from "./verdict.ts";
import type { Verdict } from "./verdict.ts";

export interface Judge {
  kind: string;
  /** True when judging makes a model call, which needs an authorized budget. */
  callsModel: boolean;
  judge(transcript: unknown): Promise<Verdict>;
}

export interface JudgeConfig {
  judge?: { budget_authorized?: boolean };
}

export type RunJudgeResult = { status: "written"; path: string } | { status: "not_run"; reason: "no_budget" };

/**
 * Judge a transcript and write its verdict with writeVerdict. A judge with `callsModel` true is not
 * called unless `config.judge.budget_authorized` is exactly `true`: then it returns
 * `{ status: "not_run", reason: "no_budget" }` and writes no verdict.
 */
export async function runJudge(
  transcript: unknown,
  judge: Judge,
  opts: { config?: JudgeConfig; verdictsDir?: string } = {},
): Promise<RunJudgeResult> {
  if (judge.callsModel && opts.config?.judge?.budget_authorized !== true) {
    return { status: "not_run", reason: "no_budget" };
  }
  const verdict = await judge.judge(transcript);
  const path = writeVerdict(verdict, { verdictsDir: opts.verdictsDir });
  return { status: "written", path };
}
