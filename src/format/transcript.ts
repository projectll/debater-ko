// The transcript header record and the JSON Lines stored form (deb-026a). One file per debate:
// line 1 is the header, each following line one turn record (`turn.ts`) in sequence order.
// Writers only append; readers parse line by line and skip a last line with no trailing newline
// (a write still in progress), so a file that is still growing re-reads cleanly (#50).

import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { validateDebateConfig } from "./config.ts";
import type { DebateConfig, DebateSide } from "./config.ts";
import type { TurnRecord } from "./turn.ts";

/** The stored form's version, `"<major>.<minor>"`; the versioned reader (#27) checks it. */
export const FORMAT_VERSION = "1.0";

export interface TranscriptHeader {
  transcript_id: string;
  format_version: string;
  question: string;
  /** A copy of `config.sides`. */
  sides: DebateSide[];
  /** A deep copy of the config taken at start, so later config edits never change a recorded debate. */
  config_snapshot: DebateConfig;
  /** ISO 8601. */
  started_at: string;
}

/**
 * The header for a debate run under `config`. `transcript_id` defaults to a random UUID and
 * `started_at` to the current time. Throws if the config isn't valid (`validateDebateConfig`).
 */
export function buildHeader(config: DebateConfig, opts: { transcript_id?: string; started_at?: string } = {}): TranscriptHeader {
  const errors = validateDebateConfig(config);
  if (errors.length) throw new Error(`invalid debate config: ${errors[0].path}: ${errors[0].message}`);
  const snapshot = structuredClone(config);
  return {
    transcript_id: opts.transcript_id ?? randomUUID(),
    format_version: FORMAT_VERSION,
    question: snapshot.question,
    sides: structuredClone(snapshot.sides),
    config_snapshot: snapshot,
    started_at: opts.started_at ?? new Date().toISOString(),
  };
}

/** Creates the transcript file with the header as line 1. Throws if the file already exists. */
export function writeHeader(path: string, header: TranscriptHeader): void {
  writeFileSync(path, JSON.stringify(header) + "\n", { flag: "wx" });
}

/** Appends one turn record as exactly one line. Throws if the file doesn't exist (no header yet). */
export function appendTurn(path: string, turn: TurnRecord): void {
  if (!existsSync(path)) throw new Error(`${path}: no transcript file (writeHeader first)`);
  appendFileSync(path, JSON.stringify(turn) + "\n");
}

/**
 * The header (line 1) and the turns (each later line, in file order) of a transcript file. A last
 * line with no trailing newline is skipped. Throws if there is no complete header line or a
 * complete line isn't JSON, naming the 1-based line. Records aren't validated here.
 */
export function parseTranscriptFile(path: string): { header: TranscriptHeader; turns: TurnRecord[] } {
  // Every element but the last ended with a newline; the last is "" or a write still in progress.
  const lines = readFileSync(path, "utf8").split("\n").slice(0, -1);
  if (lines.length === 0) throw new Error(`${path}: no header line`);
  const records = lines.map((line, i) => {
    try {
      return JSON.parse(line);
    } catch (e) {
      throw new Error(`${path}: line ${i + 1} is not valid JSON: ${(e as Error).message}`);
    }
  });
  return { header: records[0] as TranscriptHeader, turns: records.slice(1) as TurnRecord[] };
}
