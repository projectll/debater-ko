// The format layer's import boundary (deb-011a): no file under src/format/ may import the engine
// (src/debater/), the judge (src/judge/) or a model client package. Plain Node, no dependencies.
// Usage: node scripts/check-format-deps.mjs   (exit 1 and one `file: spec` line per violation)

import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_EXTENSIONS = new Set([".ts", ".mts", ".js", ".mjs"]);
const MODEL_CLIENTS = new Set(["@anthropic-ai/sdk", "openai", "@google/generative-ai", "@google/genai", "cohere-ai", "@mistralai/mistralai", "ollama"]);
const MODEL_CLIENT_PREFIXES = ["@anthropic-ai/", "@langchain/", "langchain"];

const SPEC_PATTERNS = [
  /\b(?:import|export)\s+(?:type\s+)?[^'";]*?\bfrom\s*['"]([^'"]+)['"]/g, // import x from "s", export { x } from "s"
  /\bimport\s*['"]([^'"]+)['"]/g, // import "s"
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // import("s")
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // require("s")
];

/** Every source file under dir, recursively. */
export function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(path));
    else if (SOURCE_EXTENSIONS.has(extname(entry.name))) out.push(path);
  }
  return out.sort();
}

/** The module specifiers a source text names, in order, each once. */
export function importSpecs(source) {
  const specs = new Set();
  for (const pattern of SPEC_PATTERNS) for (const m of source.matchAll(pattern)) specs.add(m[1]);
  return [...specs];
}

/** Whether a relative spec imported from file resolves to target or into it. */
export function resolvesInto(file, spec, target) {
  if (!spec.startsWith(".") && !spec.startsWith("/")) return false;
  const path = resolve(dirname(file), spec);
  return path === target || path.startsWith(target + sep);
}

/** Whether a spec names a model client package. */
export function isModelClient(spec) {
  const parts = spec.split("/");
  const pkg = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
  return MODEL_CLIENTS.has(pkg) || MODEL_CLIENT_PREFIXES.some((p) => spec.startsWith(p));
}

/** The boundary violations in a format folder: imports of its sibling debater/ or judge/, or a model client. */
export function findViolations(dir) {
  const forbidden = [resolve(dir, "..", "debater"), resolve(dir, "..", "judge")];
  const violations = [];
  for (const file of sourceFiles(dir)) {
    for (const spec of importSpecs(readFileSync(file, "utf8"))) {
      if (isModelClient(spec) || forbidden.some((t) => resolvesInto(file, spec, t))) violations.push({ file, spec });
    }
  }
  return violations;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const dir = join(ROOT, "src", "format");
  const violations = findViolations(dir);
  if (violations.length) {
    for (const v of violations) console.log(`${relative(ROOT, v.file)}: ${v.spec}`);
    process.exit(1);
  }
  console.log(`format boundary: ok (${sourceFiles(dir).length} files)`);
}
