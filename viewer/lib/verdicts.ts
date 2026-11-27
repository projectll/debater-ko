// The viewer's verdict loader (deb-078a): finds a transcript's verdict, if it has one, and says
// whether it's valid. Server-side only. It reads <VERDICTS_DIR>/<transcript_id>.verdict.json, the
// file the judge writes (deb-014a), through the judge's two validators, the only judge files the
// viewer may import (deb-075a). Neither validator checks transcript_id against the transcript, so
// this loader does.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_VERDICTS_DIR, validateVerdict } from "../../src/judge/verdict.ts";
import type { Verdict } from "../../src/judge/verdict.ts";
import { validateReasons } from "../../src/judge/reasons.ts";
import type { TurnRecord } from "../../src/format/turn.ts";

export type VerdictResult =
  | { kind: "none" }
  | { kind: "ok"; verdict: Verdict }
  | { kind: "error"; reason: string };

/** The verdicts folder: the VERDICTS_DIR runtime setting, or ./verdicts. */
export function verdictsDir(): string {
  return process.env.VERDICTS_DIR ?? DEFAULT_VERDICTS_DIR;
}

/**
 * The verdict for a loaded transcript: `none` when its file is absent, `ok` when it parses and
 * passes both validators and names this transcript, otherwise `error` with the reason.
 */
export function loadVerdict(
  transcript: { header: { transcript_id: string }; turns: TurnRecord[] },
  dir: string = verdictsDir(),
): VerdictResult {
  const id = transcript.header.transcript_id;
  let text: string;
  try {
    text = readFileSync(join(dir, `${id}.verdict.json`), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { kind: "none" };
    return { kind: "error", reason: `cannot read verdict: ${(err as Error).message}` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { kind: "error", reason: `verdict is not valid JSON: ${(err as Error).message}` };
  }

  const shapeErrors = validateVerdict(parsed);
  if (shapeErrors.length) return { kind: "error", reason: shapeErrors.join("; ") };
  const verdict = parsed as Verdict;

  if (verdict.transcript_id !== id) {
    return {
      kind: "error",
      reason: `transcript_id ${JSON.stringify(verdict.transcript_id)} does not match the transcript ${JSON.stringify(id)}`,
    };
  }

  const reasonErrors = validateReasons(verdict, transcript.turns);
  if (reasonErrors.length) return { kind: "error", reason: reasonErrors.join("; ") };
  return { kind: "ok", verdict };
}
