import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { protectHarness } from "../guards/protect-harness";
import type { HookInput } from "../types";

/** Matches the harness PreToolUse hook — package signature + entry file — so an
 *  unrelated user hook named `pre-tool-use.{js,ts}` isn't mistaken for it. (A
 *  source-path dev wiring without the package name isn't detected; real installs
 *  carry it.) */
const HARNESS_HOOK_REGEX = /agent-harness-sdk\b.*\bpre-tool-use\.[jt]s\b/;

/** Are we inside a Claude Code session? Gates the audit — a trust boundary
 *  (could be faked), not security. */
export function isInsideClaudeCode(): boolean {
  return process.env.CLAUDECODE === "1";
}

export type Settings = {
  hooks?: { PreToolUse?: Array<{ hooks?: Array<{ command?: string }> }> };
  [k: string]: unknown;
};

/** The PreToolUse hook command carrying the harness signature, or null if the
 *  guard isn't wired (or is wired via a path the regex can't detect). */
export function readHarnessHookCommand(settings: Settings): string | null {
  for (const entry of settings.hooks?.PreToolUse ?? []) {
    for (const h of entry.hooks ?? []) {
      if (typeof h.command === "string" && HARNESS_HOOK_REGEX.test(h.command)) {
        return h.command;
      }
    }
  }
  return null;
}

export type WriteProbe = { result: "wrote" | "blocked"; code?: string };

/** Attempt a real write, capturing the OS error code on failure; never throws.
 *  This is a direct syscall (not a tool call), so a "blocked" is the OS
 *  filesystem wall and `code` is the kernel's refusal — not a permission rule. */
export function probeWrite(file: string): WriteProbe {
  try {
    writeFileSync(file, "harness-redteam-probe\n");
    return { result: "wrote" };
  } catch (err) {
    return { result: "blocked", code: (err as NodeJS.ErrnoException).code };
  }
}

/** Convenience wrapper returning just the outcome. */
export function attemptWrite(file: string): "wrote" | "blocked" {
  return probeWrite(file).result;
}

/** Whether the OS refuses writes to `file` (immutable bit / ownership / sandbox).
 *  Opens for append without writing, so it never mutates the file. */
export function probeWriteBlocked(file: string): boolean {
  try {
    closeSync(openSync(file, "a"));
    return false;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return code === "EPERM" || code === "EACCES" || code === "EROFS";
  }
}

/** Run protect-harness in-process against a synthetic payload — no subprocess,
 *  so it can't crash under the sandbox, and it's the exact code production runs. */
export async function guardVerdict(
  input: HookInput,
): Promise<"denied" | "allowed"> {
  const result = await protectHarness.run(input);
  return result.allow ? "allowed" : "denied";
}

export const readFileOrNull = (f: string): string | null =>
  existsSync(f) ? readFileSync(f, "utf-8") : null;

/** Write to a real file, then restore **only if the write landed** — a blocked
 *  write left it untouched, and restoring it would itself be denied. */
export function attemptWriteReversible(file: string): WriteProbe {
  const backup = readFileOrNull(file);
  const probe = probeWrite(file);
  if (probe.result === "wrote") {
    try {
      if (backup === null) rmSync(file, { force: true });
      else writeFileSync(file, backup);
    } catch {
      // Best-effort restore; the integrity check flags it if it didn't take.
    }
  }
  return probe;
}
