// The judge's import boundary (deb-013a): no file under src/debater/ may import src/judge/, and no file
// under src/judge/ may import the engine's passes, tally, GitHub client or CLI. Imports of src/format/
// are allowed. Reuses the import scanner of scripts/check-format-deps.mjs. Plain Node, no dependencies.
// Usage: node scripts/check-judge-deps.mjs   (exit 1 and one `file: spec` line per violation)

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { importSpecs, resolvesInto, sourceFiles } from "./check-format-deps.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The engine paths the judge may not import, under a src folder (docs/DESIGN.md §2.1). */
function engineTargets(src) {
  const engine = join(src, "debater");
  return ["passes", "tally.ts", "github.ts", "cli.ts"].map((p) => join(engine, p));
}

/** The source files under dir, or none when it doesn't exist (src/debater/ is only planned). */
function filesIn(dir) {
  return existsSync(dir) ? sourceFiles(dir) : [];
}

/** The judge boundary violations in a src folder: engine files importing judge/, judge files importing the engine. */
export function findJudgeViolations(src) {
  const judge = join(src, "judge");
  const violations = [];
  for (const file of filesIn(join(src, "debater"))) {
    for (const spec of importSpecs(readFileSync(file, "utf8"))) {
      if (resolvesInto(file, spec, judge)) violations.push({ file, spec });
    }
  }
  const forbidden = engineTargets(src);
  for (const file of filesIn(judge)) {
    for (const spec of importSpecs(readFileSync(file, "utf8"))) {
      if (forbidden.some((t) => resolvesInto(file, spec, t))) violations.push({ file, spec });
    }
  }
  return violations;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const violations = findJudgeViolations(join(ROOT, "src"));
  if (violations.length) {
    for (const v of violations) console.log(`${relative(ROOT, v.file)}: ${v.spec}`);
    process.exit(1);
  }
  console.log("judge boundary: ok");
}
