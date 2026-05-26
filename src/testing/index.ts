/**
 * Test helpers for exercising guards and checks the way the harness does —
 * without hand-rolling hook payloads or reaching into result unions.
 *
 * Import from `agent-harness-sdk/testing`:
 *
 * ```ts
 * import { runGuard, writeTool } from "agent-harness-sdk/testing";
 *
 * const result = await runGuard(myGuard, writeTool("/repo/.env"));
 * expect(result.denied).toBe(true);
 * ```
 */
import { shouldRun } from "../conditions";
import type { Check, Guard, HookInput } from "../types";

// ──────────────────────────────────────────────────────────────────────────
// Payload builders — construct the HookInput a tool call sends to a hook.
// ──────────────────────────────────────────────────────────────────────────

/** A tool call for any tool. Escape hatch for tools without a dedicated builder. */
export function tool(
  name: string,
  input: Record<string, unknown> = {},
): HookInput {
  return { tool_name: name, tool_input: input };
}

/** A `Write` call against `file`. */
export function writeTool(file: string, content = ""): HookInput {
  return tool("Write", { file_path: file, content });
}

/** An `Edit` call against `file`. */
export function editTool(file: string): HookInput {
  return tool("Edit", { file_path: file });
}

/** A `MultiEdit` call against `file`. */
export function multiEditTool(file: string): HookInput {
  return tool("MultiEdit", { file_path: file });
}

/** A `Bash` call running `command`. */
export function bashTool(command: string): HookInput {
  return tool("Bash", { command });
}

// ──────────────────────────────────────────────────────────────────────────
// Runners — run a primitive through its real activation + run() pipeline.
// ──────────────────────────────────────────────────────────────────────────

export type RunOptions = {
  /** Sets `CLAUDE_PROJECT_DIR` for the duration of the run, then restores it.
   *  Use it for guards/checks that read project files via `projectDir()` (e.g.
   *  reading harness.lock) so they resolve to your fixture instead of cwd. */
  projectDir?: string;
};

/** Runs `fn` with `CLAUDE_PROJECT_DIR` pinned to `dir`, restoring the prior
 *  value afterward. No-op when `dir` is undefined. */
function withProjectDir<T>(
  dir: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (dir === undefined) return fn();
  const prev = process.env.CLAUDE_PROJECT_DIR;
  process.env.CLAUDE_PROJECT_DIR = dir;
  return fn().finally(() => {
    if (prev === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = prev;
  });
}

export type GuardRun = {
  /** Did the guard's conditions match this call? */
  active: boolean;
  /** Did the guard block the call? `false` when inactive or allowed. */
  denied: boolean;
  /** The deny reason, or `null` when not denied. */
  reason: string | null;
};

function guardActive(guard: Guard, input: HookInput): boolean {
  // shouldRun covers tools/files/when; matches?.() honors the deprecated predicate.
  return shouldRun(guard, input) && (guard.matches?.(input) ?? true);
}

/** Run a guard exactly as the pre-tool-use dispatcher would: evaluate its
 *  conditions, and if active, run it. */
export async function runGuard(
  guard: Guard,
  input: HookInput,
  options: RunOptions = {},
): Promise<GuardRun> {
  return withProjectDir(options.projectDir, async () => {
    if (!guardActive(guard, input)) {
      return { active: false, denied: false, reason: null };
    }
    const result = await guard.run(input);
    return result.allow
      ? { active: true, denied: false, reason: null }
      : { active: true, denied: true, reason: result.reason };
  });
}

export type CheckRun = {
  /** Did the check's conditions match this call? */
  active: boolean;
  /** Did the check fail? `false` when inactive or passing. */
  failed: boolean;
  /** The failure message, or `null` when not failed. */
  message: string | null;
};

function checkActive(check: Check, input: HookInput): boolean {
  const filePath = input.tool_input?.file_path ?? "";
  // shouldRun covers tools/files/when; matches?.() honors the deprecated predicate.
  return shouldRun(check, input) && (check.matches?.(filePath, input) ?? true);
}

/** Run a check exactly as the post-tool-use dispatcher would: evaluate its
 *  conditions, and if active, run it. */
export async function runCheck(
  check: Check,
  input: HookInput,
  options: RunOptions = {},
): Promise<CheckRun> {
  return withProjectDir(options.projectDir, async () => {
    if (!checkActive(check, input)) {
      return { active: false, failed: false, message: null };
    }
    const filePath = input.tool_input?.file_path ?? "";
    const result = await check.run(filePath, input);
    return result.ok
      ? { active: true, failed: false, message: null }
      : { active: true, failed: true, message: result.message };
  });
}
