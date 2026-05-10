/**
 * Audit log writer. Append-only JSONL at .harness/log.jsonl by default.
 * Local + gitignored — never version-controlled.
 *
 * Honor `HARNESS_LOG_DISABLED=1` to skip logging entirely.
 * Honor `HARNESS_LOG_PATH` to redirect output.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { projectDir } from "../hooks/utils";

const DEFAULT_PATH = ".harness/log.jsonl";

function logFile(): string {
  return process.env.HARNESS_LOG_PATH ?? join(projectDir(), DEFAULT_PATH);
}

export function logEvent(
  event: string,
  payload: Record<string, unknown> = {},
): void {
  if (process.env.HARNESS_LOG_DISABLED === "1") return;

  const entry = { ts: new Date().toISOString(), event, ...payload };
  const path = logFile();

  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, JSON.stringify(entry) + "\n", "utf-8");
  } catch (err) {
    // Logging failures must never break the harness. Surface to stderr only.
    process.stderr.write(
      `agent-harness-sdk: log write failed: ${(err as Error).message}\n`,
    );
  }
}

export type LogEntry = {
  ts: string;
  event: string;
  [key: string]: unknown;
};

export function readLog(): LogEntry[] {
  const path = logFile();
  try {
    const { readFileSync, existsSync } = require("node:fs") as typeof import("node:fs");
    if (!existsSync(path)) return [];
    return readFileSync(path, "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as LogEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is LogEntry => e !== null);
  } catch {
    return [];
  }
}
