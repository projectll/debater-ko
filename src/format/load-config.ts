// The debate config loader (deb-025a): reads a config file, fills the keys it leaves out from
// debate.default.json (docs/DESIGN.md §3.2's two layers), then validates it with validateDebateConfig.
// It runs before any turn is produced and has no side effects, so a bad file starts nothing.

import { readFileSync } from "node:fs";
import defaults from "./debate.default.json" with { type: "json" };
import { validateDebateConfig } from "./config.ts";
import type { ConfigError, DebateConfig } from "./config.ts";

export type LoadDebateConfigResult = { ok: true; config: DebateConfig } | { ok: false; error: ConfigError };

/**
 * The parsed config, or the first invalid field. A file that can't be read or isn't valid JSON
 * gives `error.path` `""` with a message naming the file; it never throws.
 */
export function loadDebateConfig(path: string): LoadDebateConfigResult {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    return { ok: false, error: { path: "", message: `can't read ${path}: ${(e as Error).message}` } };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: { path: "", message: `${path} is not valid JSON: ${(e as Error).message}` } };
  }

  const config = typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? { ...defaults, ...parsed } : parsed;
  const errors = validateDebateConfig(config);
  if (errors.length) return { ok: false, error: errors[0] };
  return { ok: true, config: config as DebateConfig };
}
