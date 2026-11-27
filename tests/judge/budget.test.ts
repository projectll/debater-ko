// deb-021a: runJudge's budget gate (src/judge/judge.ts). The model-backed judge here is a fake that only
// counts its calls: no model client, no network, no spending.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VERDICT_FORMAT_VERSION, runJudge, validateVerdict } from "../../src/judge/index.ts";
import type { Judge, JudgeConfig, Verdict } from "../../src/judge/index.ts";

// A present API key is not authorization: every test runs with one set.
process.env.ANTHROPIC_API_KEY = "fake-key";

function verdict(): Verdict {
  return {
    verdict_id: "v1",
    transcript_id: "debate-001",
    verdict_format_version: VERDICT_FORMAT_VERSION,
    rubric_version: "2026-11-20-judge-rubric-document.md",
    outcome: "win",
    winner: "pro",
    scores: {
      pro: { answer: 3, evidence: 2, consistency: 3, total: 8 },
      con: { answer: 2, evidence: 2, consistency: 2, total: 6 },
    },
    reasons: [],
    judged_at: "2026-11-27T12:00:00.000Z",
  };
}

/** A fake judge that counts its calls and returns a fixed verdict. */
function fakeJudge(callsModel: boolean): Judge & { calls: number } {
  const j = {
    kind: callsModel ? "fake-model" : "fake-scripted",
    callsModel,
    calls: 0,
    async judge(_transcript: unknown): Promise<Verdict> {
      j.calls += 1;
      return verdict();
    },
  };
  return j;
}

function tempDir(t: { after: (fn: () => void) => void }): string {
  const dir = mkdtempSync(join(tmpdir(), "deb-021a-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const TRANSCRIPT = [{ turn_id: "t1", seq: 1, side: "pro", speaker: "Pro", kind: "opening", text: "We should." }];

/** True when dir is missing or empty. */
function noFiles(dir: string): boolean {
  return !existsSync(dir) || readdirSync(dir).length === 0;
}

test("1. a model judge with budget_authorized unset is not run: no call, no file", async (t) => {
  assert.equal(process.env.ANTHROPIC_API_KEY, "fake-key");
  const dir = join(tempDir(t), "verdicts");
  for (const config of [undefined, {}, { judge: {} }] as (JudgeConfig | undefined)[]) {
    const judge = fakeJudge(true);
    const result = await runJudge(TRANSCRIPT, judge, { config, verdictsDir: dir });
    assert.deepEqual(result, { status: "not_run", reason: "no_budget" }, JSON.stringify(config));
    assert.equal(judge.calls, 0);
    assert.ok(noFiles(dir), "verdictsDir holds no file");
  }
});

test("2. a model judge with budget_authorized false is not run: no call, no file", async (t) => {
  const dir = join(tempDir(t), "verdicts");
  const judge = fakeJudge(true);
  const result = await runJudge(TRANSCRIPT, judge, { config: { judge: { budget_authorized: false } }, verdictsDir: dir });
  assert.deepEqual(result, { status: "not_run", reason: "no_budget" });
  assert.equal(judge.calls, 0);
  assert.ok(noFiles(dir), "verdictsDir holds no file");
});

test("3. a model judge with budget_authorized true is called once and its verdict is written", async (t) => {
  const dir = join(tempDir(t), "verdicts");
  const judge = fakeJudge(true);
  const result = await runJudge(TRANSCRIPT, judge, { config: { judge: { budget_authorized: true } }, verdictsDir: dir });
  const path = join(dir, "debate-001.verdict.json");
  assert.deepEqual(result, { status: "written", path });
  assert.equal(judge.calls, 1);
  assert.deepEqual(readdirSync(dir), ["debate-001.verdict.json"]);
  const back = JSON.parse(readFileSync(path, "utf8"));
  assert.deepEqual(back, verdict());
  assert.deepEqual(validateVerdict(back), []);
});

test("4. extra: only exactly true authorizes; a truthy non-boolean is no budget", async (t) => {
  const dir = join(tempDir(t), "verdicts");
  for (const value of ["true", 1, "yes"]) {
    const judge = fakeJudge(true);
    const config = { judge: { budget_authorized: value } } as unknown as JudgeConfig;
    const result = await runJudge(TRANSCRIPT, judge, { config, verdictsDir: dir });
    assert.deepEqual(result, { status: "not_run", reason: "no_budget" }, String(value));
    assert.equal(judge.calls, 0);
  }
  assert.ok(noFiles(dir));
});

test("5. extra: a judge that calls no model runs with no budget", async (t) => {
  const dir = join(tempDir(t), "verdicts");
  const judge = fakeJudge(false);
  const result = await runJudge(TRANSCRIPT, judge, { verdictsDir: dir });
  assert.deepEqual(result, { status: "written", path: join(dir, "debate-001.verdict.json") });
  assert.equal(judge.calls, 1);
});

test("6. extra: judge.default.json holds budget_authorized false and runJudge never reads process.env", async (t) => {
  const defaults = JSON.parse(readFileSync(new URL("../../src/judge/judge.default.json", import.meta.url), "utf8"));
  assert.deepEqual(defaults, { judge: { budget_authorized: false } });
  const dir = join(tempDir(t), "verdicts");
  const judge = fakeJudge(true);
  assert.deepEqual(await runJudge(TRANSCRIPT, judge, { config: defaults, verdictsDir: dir }), { status: "not_run", reason: "no_budget" });
  assert.equal(judge.calls, 0);
  const source = readFileSync(new URL("../../src/judge/judge.ts", import.meta.url), "utf8");
  const code = source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!code.includes("process.env"), "judge.ts code must not read process.env");
});
