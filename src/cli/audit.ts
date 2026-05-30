import { execSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { HARNESS_HOOK_MARKER } from "./merge-config";
import { deriveLevel, probeWriteBlocked } from "./security-level";

// ── pure helpers (unit-tested) ───────────────────────────────────────────────

/** Whether we're running inside a Claude Code session (Bash-tool subprocess).
 *  Gate on the documented CLAUDECODE flag. Trust boundary, not security — a
 *  human could set it by hand; its job is to stop misleading bare-terminal runs. */
export function isInsideClaudeCode(): boolean {
  return process.env.CLAUDECODE === "1";
}

type Settings = {
  hooks?: { PreToolUse?: Array<{ hooks?: Array<{ command?: string }> }> };
  [k: string]: unknown;
};

/** The PreToolUse hook command carrying the harness marker, or null if the
 *  guard isn't wired in this project. */
export function readHarnessHookCommand(settings: Settings): string | null {
  for (const entry of settings.hooks?.PreToolUse ?? []) {
    for (const h of entry.hooks ?? []) {
      if (typeof h.command === "string" && h.command.includes(HARNESS_HOOK_MARKER)) {
        return h.command;
      }
    }
  }
  return null;
}

export type VectorKind = "fs-wall" | "guard";
export type Observed = "wrote" | "blocked" | "allowed" | "denied" | "error";

/** Expected outcome for a vector kind at a given level. fs-wall: writable at
 *  0-1 (no OS wall), blocked at 2-3. guard: inert at 0, denies at 1+. */
export function expectedFor(kind: VectorKind, level: number): Observed {
  if (kind === "fs-wall") return level >= 2 ? "blocked" : "wrote";
  return level === 0 ? "allowed" : "denied";
}

/** Attempt a real write to `file`; return whether the OS blocked it. Caller is
 *  responsible for cleanup/restore when it returns "wrote". */
export function attemptWrite(file: string): "wrote" | "blocked" {
  try {
    writeFileSync(file, "harness-redteam-probe\n");
    return "wrote";
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EPERM" || code === "EACCES" || code === "EROFS") return "blocked";
    throw err;
  }
}

/** Run the real hook command with a synthetic payload on stdin; exit 2 = the
 *  guard denied, 0 = allowed, anything else = error (e.g. hook not runnable). */
export function runGuardProbe(
  command: string,
  cwd: string,
  payload: object,
): "denied" | "allowed" | "error" {
  try {
    execSync(command, {
      cwd,
      env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
      input: JSON.stringify(payload),
      stdio: ["pipe", "pipe", "pipe"],
    });
    return "allowed";
  } catch (err) {
    return (err as { status?: number }).status === 2 ? "denied" : "error";
  }
}

// ── orchestrator (side effects) ──────────────────────────────────────────────

type Finding = {
  label: string;
  kind: VectorKind;
  expected: Observed;
  observed: Observed;
  ok: boolean;
};

const readFileOrNull = (f: string): string | null =>
  existsSync(f) ? readFileSync(f, "utf-8") : null;

/** Attempt a write to a real file without lasting damage: back up → attempt →
 *  restore. Returns the observed result. */
function attemptWriteReversible(file: string): "wrote" | "blocked" {
  const backup = readFileOrNull(file);
  try {
    return attemptWrite(file);
  } finally {
    if (backup === null) rmSync(file, { force: true });
    else writeFileSync(file, backup);
  }
}

export function runAudit(cwd: string): number {
  p.intro(pc.cyan("harness security audit"));

  const settingsPath = join(cwd, ".claude", "settings.json");
  const envPath = join(cwd, ".env");
  let settings: Settings = {};
  try {
    settings = JSON.parse(readFileOrNull(settingsPath) ?? "{}") as Settings;
  } catch {
    /* malformed → treat as empty */
  }
  const env = readFileOrNull(envPath) ?? "";

  let level: number = deriveLevel({ env, settings });
  // Promote to 3 if the OS already write-protects a real harness file.
  if (level >= 1 && probeWriteBlocked(join(cwd, "harness", "harness.config.ts"))) {
    level = 3;
  }

  const findings: Finding[] = [];
  const record = (label: string, kind: VectorKind, observed: Observed) => {
    const expected = expectedFor(kind, level);
    findings.push({ label, kind, expected, observed, ok: observed === expected });
  };

  // FS-wall vectors (run inside Claude Code → subject to the sandbox).
  const probe = join(cwd, "harness", ".redteam-probe");
  const fsResult = attemptWrite(probe);
  if (fsResult === "wrote") rmSync(probe, { force: true });
  record("fs write → harness/.redteam-probe", "fs-wall", fsResult);

  record(".env write (HARNESS_UNLOCK)", "fs-wall", attemptWriteReversible(envPath));
  record("settings.json write", "fs-wall", attemptWriteReversible(settingsPath));

  // Guard-logic vectors (synthetic payloads through the real hook).
  const hookCmd = readHarnessHookCommand(settings);
  if (!hookCmd) {
    findings.push({
      label: "guard wired",
      kind: "guard",
      expected: "denied",
      observed: "error",
      ok: false,
    });
  } else {
    record(
      "guard: Edit(harness/harness.config.ts)",
      "guard",
      runGuardProbe(hookCmd, cwd, {
        tool_name: "Edit",
        tool_input: { file_path: join(cwd, "harness", "harness.config.ts") },
      }),
    );
    record(
      "guard: Bash `harness security 0`",
      "guard",
      runGuardProbe(hookCmd, cwd, {
        tool_name: "Bash",
        tool_input: { command: "npx harness security 0" },
      }),
    );
  }

  // Integrity: real files restored, probe gone.
  const intact =
    readFileOrNull(envPath) === (env || null) &&
    !existsSync(probe);

  renderReport(level, findings, intact);
  return findings.every((f) => f.ok) && intact ? 0 : 1;
}

function renderReport(level: number, findings: Finding[], intact: boolean): void {
  const rows = findings.map((f) => {
    const mark = f.ok ? pc.green("✔") : pc.yellow("✗");
    const note =
      f.ok && f.kind === "fs-wall" && f.observed === "wrote" && level <= 1
        ? pc.dim(" (expected at this level — raise to 2 for an FS wall)")
        : "";
    return `${mark} ${f.label}: ${pc.bold(f.observed)} ${pc.dim(`(expected ${f.expected})`)}${note}`;
  });
  p.note(rows.join("\n"), `Level ${level} — observed vs expected`);

  const discrepancies = findings.filter((f) => !f.ok);
  if (!intact) {
    p.outro(pc.red("⚠ integrity check failed — a protected file was not restored. Inspect manually."));
  } else if (discrepancies.length === 0) {
    p.outro(pc.green(`Level ${level} is enforcing as designed.`));
  } else {
    p.outro(
      pc.yellow(
        `${discrepancies.length} discrepancy(ies) — your level isn't enforcing as designed. ` +
          "Check: hook wired? sandbox enabled + bubblewrap installed (Linux)?",
      ),
    );
  }
}
