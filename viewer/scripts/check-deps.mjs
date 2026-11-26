// The viewer's import boundary (deb-015a): the viewer stays on the transcript contract alone.
// No file under viewer/ may import the engine (src/debater/), the format runner (src/format/runner.ts)
// or a model client package; src/format/index.ts must not carry the runner in; and viewer/package.json
// must not list a model client. Reuses the format layer's scanner (scripts/check-format-deps.mjs).
// Usage: npm run check-deps   (exit 1 and one `file: spec` line per violation)

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { importSpecs, isModelClient, resolvesInto } from "../../scripts/check-format-deps.mjs";

const VIEWER = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_EXTENSIONS = new Set([".ts", ".mts", ".tsx", ".js", ".mjs", ".jsx"]);
const SKIP_DIRS = new Set(["node_modules", ".next"]);
const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

/** Every source file under dir, recursively, skipping node_modules/ and .next/. */
export function viewerFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...viewerFiles(path));
    } else if (SOURCE_EXTENSIONS.has(extname(entry.name))) out.push(path);
  }
  return out.sort();
}

/** Whether a relative spec imported from file names the runner module, with or without its extension. */
function namesRunner(file, spec, runner) {
  if (!spec.startsWith(".") && !spec.startsWith("/")) return false;
  const path = resolve(dirname(file), spec);
  return path === runner || path.replace(/\.(ts|mts|js|mjs)$/, "") === runner.replace(/\.ts$/, "");
}

/** The boundary violations for a viewer folder whose repo root is root (default: the folder's parent). */
export function findViewerViolations(viewerDir, root = resolve(viewerDir, "..")) {
  const engine = join(root, "src", "debater");
  const runner = join(root, "src", "format", "runner.ts");
  const index = join(root, "src", "format", "index.ts");
  const violations = [];
  for (const file of viewerFiles(viewerDir)) {
    for (const spec of importSpecs(readFileSync(file, "utf8"))) {
      if (isModelClient(spec) || resolvesInto(file, spec, engine) || namesRunner(file, spec, runner)) {
        violations.push({ file, spec });
      }
    }
  }
  if (existsSync(index)) {
    for (const spec of importSpecs(readFileSync(index, "utf8"))) {
      if (namesRunner(index, spec, runner)) violations.push({ file: index, spec });
    }
  }
  const pkgFile = join(viewerDir, "package.json");
  if (existsSync(pkgFile)) {
    const pkg = JSON.parse(readFileSync(pkgFile, "utf8"));
    for (const field of DEPENDENCY_FIELDS) {
      for (const name of Object.keys(pkg[field] ?? {})) {
        if (isModelClient(name)) violations.push({ file: pkgFile, spec: name });
      }
    }
  }
  return violations;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(VIEWER, "..");
  const violations = findViewerViolations(VIEWER, root);
  if (violations.length) {
    for (const v of violations) console.log(`${relative(root, v.file)}: ${v.spec}`);
    process.exit(1);
  }
  console.log("viewer boundary: ok");
}
