// The judge seat (deb-013a): a product feature of debater-ko in its own module, beside the engine
// (src/debater/) and the format layer (src/format/), not under the engine. The engine never imports it,
// and it never imports the engine's passes, tally, GitHub client or CLI; it may use src/format/.
// scripts/check-judge-deps.mjs enforces that. Later judge tickets add the verdict and the runner here.

export const JUDGE_MODULE = "judge";
