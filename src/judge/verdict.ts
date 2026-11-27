// The judge's verdict record (deb-014a): written by the judge as its own file, linked to its transcript
// by transcript_id, so replay stays transcript-only and model-free. The judge never appends to or
// changes the transcript: writeVerdict only writes <verdictsDir>/<transcript_id>.verdict.json.
// Reason entries are checked against the transcript by `validateReasons` (`reasons.ts`, deb-023a);
// here `reasons` only has to be an array.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** The verdict record's own format version, not the transcript's `format_version`. */
export const VERDICT_FORMAT_VERSION = 1;

export type VerdictOutcome = "win" | "tie" | "forfeit";

export const VERDICT_OUTCOMES: readonly VerdictOutcome[] = ["win", "tie", "forfeit"];

export interface SideScores {
  answer: number;
  evidence: number;
  consistency: number;
  total: number;
}

export interface Verdict {
  verdict_id: string;
  /** The judged transcript's id; also names the file, so it holds no path separator. */
  transcript_id: string;
  verdict_format_version: number;
  /** The version identifier of the rubric document applied. */
  rubric_version: string;
  outcome: VerdictOutcome;
  /** A side id from the transcript header, or null for a tie (a both-sides forfeit included). */
  winner: string | null;
  /** Per side id; present on every verdict, forfeit verdicts too. */
  scores: Record<string, SideScores>;
  reasons: unknown[];
  /** ISO 8601. */
  judged_at: string;
}

/** The default verdicts folder, relative to the working folder (VERDICTS_DIR in the plan). */
export const DEFAULT_VERDICTS_DIR = "./verdicts";

const NON_EMPTY_STRING_FIELDS = ["verdict_id", "transcript_id", "rubric_version"] as const;
const SCORE_FIELDS = ["answer", "evidence", "consistency", "total"] as const;
const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Every problem in a verdict record, one string each, empty when it is valid: one per missing or
 * ill-typed field (`missing winner`, `scores.con.total must be a number`), plus one when a tie names
 * a winner.
 */
export function validateVerdict(v: unknown): string[] {
  if (!isObject(v)) return ["verdict: not an object"];
  const errors: string[] = [];

  for (const field of NON_EMPTY_STRING_FIELDS) {
    if (!(field in v)) errors.push(`missing ${field}`);
    else if (typeof v[field] !== "string" || v[field] === "") errors.push(`${field} must be a non-empty string`);
  }
  if (typeof v.transcript_id === "string" && /[\\/]|^\.\.?$/.test(v.transcript_id)) {
    errors.push("transcript_id must not be a path");
  }

  if (!("verdict_format_version" in v)) errors.push("missing verdict_format_version");
  else if (v.verdict_format_version !== VERDICT_FORMAT_VERSION) {
    errors.push(`verdict_format_version must be ${VERDICT_FORMAT_VERSION}`);
  }

  if (!("outcome" in v)) errors.push("missing outcome");
  else if (!VERDICT_OUTCOMES.includes(v.outcome as VerdictOutcome)) {
    errors.push(`outcome ${JSON.stringify(v.outcome)} is not one of ${VERDICT_OUTCOMES.join(", ")}`);
  }

  if (!("winner" in v)) errors.push("missing winner");
  else if (v.winner !== null && (typeof v.winner !== "string" || v.winner === "")) {
    errors.push("winner must be a non-empty string or null");
  } else if (v.outcome === "tie" && v.winner !== null) errors.push("winner must be null when outcome is tie");
  else if (v.outcome === "win" && v.winner === null) errors.push("winner must be a side id when outcome is win");

  if (!("scores" in v)) errors.push("missing scores");
  else if (!isObject(v.scores)) errors.push("scores must be an object of sides");
  else {
    for (const [side, s] of Object.entries(v.scores)) {
      if (!isObject(s)) {
        errors.push(`scores.${side} must be an object`);
        continue;
      }
      for (const field of SCORE_FIELDS) {
        if (!(field in s)) errors.push(`scores.${side}: missing ${field}`);
        else if (typeof s[field] !== "number" || !Number.isFinite(s[field])) errors.push(`scores.${side}.${field} must be a number`);
      }
    }
  }

  if (!("reasons" in v)) errors.push("missing reasons");
  else if (!Array.isArray(v.reasons)) errors.push("reasons must be an array");

  if (!("judged_at" in v)) errors.push("missing judged_at");
  else if (typeof v.judged_at !== "string" || !ISO_8601.test(v.judged_at) || Number.isNaN(Date.parse(v.judged_at))) {
    errors.push("judged_at must be an ISO 8601 date-time");
  }

  return errors;
}

/**
 * Validate a verdict (throwing on any error), then write it as pretty JSON ending with a newline to
 * `<verdictsDir>/<transcript_id>.verdict.json`, creating the folder if it's missing. Returns the path.
 * Never opens a transcript file.
 */
export function writeVerdict(v: Verdict, opts: { verdictsDir?: string } = {}): string {
  const errors = validateVerdict(v);
  if (errors.length) throw new Error(`invalid verdict: ${errors.join("; ")}`);
  const dir = opts.verdictsDir ?? DEFAULT_VERDICTS_DIR;
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${v.transcript_id}.verdict.json`);
  writeFileSync(path, `${JSON.stringify(v, null, 2)}\n`);
  return path;
}
