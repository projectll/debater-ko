// The judge seat (deb-013a): a product feature of debater-ko in its own module, beside the engine
// (src/debater/) and the format layer (src/format/), not under the engine. The engine never imports it,
// and it never imports the engine's passes, tally, GitHub client or CLI; it may use src/format/.
// scripts/check-judge-deps.mjs enforces that. The verdict record is deb-014a; later judge tickets add the runner here.

export const JUDGE_MODULE = "judge";

export { DEFAULT_VERDICTS_DIR, VERDICT_FORMAT_VERSION, VERDICT_OUTCOMES, validateVerdict, writeVerdict } from "./verdict.ts";
export type { SideScores, Verdict, VerdictOutcome } from "./verdict.ts";
