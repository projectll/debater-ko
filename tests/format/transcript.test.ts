// deb-026a: the transcript header record and the JSON Lines stored form (src/format/transcript.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FORMAT_VERSION, appendTurn, buildHeader, loadDebateConfig, parseTranscriptFile, writeHeader } from "../../src/format/index.ts";
import type { DebateConfig, TurnRecord } from "../../src/format/index.ts";

const dir = mkdtempSync(join(tmpdir(), "deb-026a-"));

/** A valid two-sided sample config. */
function sample(): DebateConfig {
  return {
    question: "Should the city build a new library?",
    sides: [
      { id: "pro", name: "Pro", position: "The city should build it." },
      { id: "con", name: "Con", position: "The city should not build it." },
    ],
    opening_order: ["pro", "con"],
    rebuttal_rounds: 2,
    closing_order: ["con", "pro"],
  };
}

/** A turn record with seq `seq` for side `side`. */
function turn(seq: number, side: string): TurnRecord {
  return { turn_id: `t${seq}`, seq, side, speaker: `${side} speaker`, kind: "opening", text: `Turn ${seq}.`, points: [] };
}

const fixedHeader = () => buildHeader(sample(), { transcript_id: "tr-1", started_at: "2026-11-27T12:00:00.000Z" });

test("1. a header from a loaded config file has exactly the six keys and never changes with the config", () => {
  const configPath = join(dir, "config.json");
  writeFileSync(configPath, JSON.stringify(sample()));
  const loaded = loadDebateConfig(configPath);
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;

  const header = buildHeader(loaded.config);
  assert.deepEqual(Object.keys(header).sort(), ["config_snapshot", "format_version", "question", "sides", "started_at", "transcript_id"]);
  assert.equal(header.format_version, FORMAT_VERSION);
  assert.match(header.format_version, /^\d+\.\d+$/);
  assert.equal(new Date(header.started_at).toISOString(), header.started_at);
  assert.match(header.transcript_id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(header.config_snapshot, loaded.config);
  assert.deepEqual(header.sides, loaded.config.sides);
  const before = structuredClone(header);

  writeFileSync(configPath, JSON.stringify({ ...sample(), question: "Rewritten question?" }));
  loaded.config.question = "Mutated question?";
  loaded.config.sides[0].name = "Mutated";
  loaded.config.opening_order.reverse();
  assert.deepEqual(header, before);
});

test("2. a header and two appended turns parse back in seq order, in exactly 3 lines", () => {
  const path = join(dir, "two-turns.jsonl");
  const header = fixedHeader();
  writeHeader(path, header);
  appendTurn(path, turn(1, "pro"));
  appendTurn(path, turn(2, "con"));

  const text = readFileSync(path, "utf8");
  assert.equal(text.split("\n").length - 1, 3);
  assert.ok(text.endsWith("\n"));
  const parsed = parseTranscriptFile(path);
  assert.deepEqual(parsed.header, header);
  assert.deepEqual(parsed.turns, [turn(1, "pro"), turn(2, "con")]);
});

test("3. a header-only file parses as turns: []", () => {
  const path = join(dir, "header-only.jsonl");
  writeHeader(path, fixedHeader());
  assert.deepEqual(parseTranscriptFile(path), { header: fixedHeader(), turns: [] });
});

test("4. a last line with a partial record and no newline is skipped, and re-reads once complete", () => {
  const path = join(dir, "growing.jsonl");
  writeHeader(path, fixedHeader());
  appendTurn(path, turn(1, "pro"));
  const line = JSON.stringify(turn(2, "con"));
  appendFileSync(path, line.slice(0, 20));
  assert.deepEqual(parseTranscriptFile(path).turns, [turn(1, "pro")]);

  appendFileSync(path, line.slice(20) + "\n");
  assert.deepEqual(parseTranscriptFile(path).turns, [turn(1, "pro"), turn(2, "con")]);
});

test("5. writeHeader on an existing file throws and leaves the file as it was", () => {
  const path = join(dir, "existing.jsonl");
  writeHeader(path, fixedHeader());
  appendTurn(path, turn(1, "pro"));
  const text = readFileSync(path, "utf8");
  assert.throws(() => writeHeader(path, fixedHeader()), { code: "EEXIST" });
  assert.equal(readFileSync(path, "utf8"), text);
});

test("6. buildHeader rejects an invalid config", () => {
  const config = { ...sample(), sides: sample().sides.slice(0, 1) };
  assert.throws(() => buildHeader(config), /invalid debate config: sides: expected exactly 2, got 1/);
});

test("7. appendTurn with no transcript file throws and creates nothing", () => {
  const path = join(dir, "absent.jsonl");
  assert.throws(() => appendTurn(path, turn(1, "pro")), /no transcript file/);
  assert.throws(() => readFileSync(path), { code: "ENOENT" });
});

test("8. parseTranscriptFile names the bad line, and an empty file has no header", () => {
  const bad = join(dir, "bad-line.jsonl");
  writeHeader(bad, fixedHeader());
  appendFileSync(bad, "not json\n");
  assert.throws(() => parseTranscriptFile(bad), /line 2 is not valid JSON/);

  const empty = join(dir, "empty.jsonl");
  writeFileSync(empty, "");
  assert.throws(() => parseTranscriptFile(empty), /no header line/);
});
