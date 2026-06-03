import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parse } from "dotenv";
import { HARNESS_HOOK_MARKER } from "../cli/merge-config";
import { projectDir } from "../paths";
import { Tools } from "../tool-names";
import { type Guard, type HookInput, guardAllow, guardDeny } from "../types";

/**
 * Built-in, non-removable guard that protects the harness's own enforcement
 * surface from being edited by the agent. Injected by the pre-tool-use
 * dispatcher (not registered in the consumer's `harness.config.ts`), so it
 * cannot be unregistered by editing that file.
 *
 * Protects, unless `HARNESS_UNLOCK` is set in `.env.agents` (see {@link isUnlocked}):
 *   - `harness/**`            — config, guards, checks, tools, rules
 *   - `.env.agents`           — the unlock file itself, so the agent can't set
 *                               the flag in a file it could write while locked
 *   - `.claude/settings.json` — but only when the edit would tamper with the
 *                               harness hook wiring; other sections pass through
 *
 * The app's own `.env` is deliberately NOT protected here — that's the separate,
 * opt-in `protect-env-files` guard's job. The harness internals concern
 * themselves only with their own surface. See the design doc.
 */

/** Whether the harness is unlocked, read **only** from the project `.env.agents`
 *  (ambient `process.env` is intentionally ignored — unlock is a per-project,
 *  in-repo decision, not a global shell toggle). Truthy unless absent, empty,
 *  "0", or "false". Absent file or unset flag = locked, the secure default. */
function isUnlocked(): boolean {
  const envPath = join(projectDir(), ".env.agents");
  if (!existsSync(envPath)) return false;
  let value: string | undefined;
  try {
    value = parse(readFileSync(envPath)).HARNESS_UNLOCK;
  } catch {
    return false;
  }
  if (value === undefined) return false;
  const t = value.trim().toLowerCase();
  return t !== "" && t !== "0" && t !== "false";
}

/** Project-relative, forward-slashed path for the edited file. */
function relativePathOf(input: HookInput): string {
  const file = input.tool_input?.file_path ?? "";
  return relative(projectDir(), file).split("\\").join("/");
}

/** The harness's own `.env.agents` (holds the unlock flag) at the project root —
 *  the only env file these built-in protections cover. The app's `.env` is
 *  `protect-env-files`'s job. */
function isAgentsEnvFile(relativePath: string): boolean {
  return relativePath === ".env.agents";
}

function isHarnessFile(relativePath: string): boolean {
  return relativePath === "harness" || relativePath.startsWith("harness/");
}

function isSettingsFile(relativePath: string): boolean {
  return relativePath === ".claude/settings.json";
}

/** Count non-overlapping occurrences of `needle` in `haystack`. */
function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/** The content that would result from applying this Write/Edit/MultiEdit to
 *  `current`, or the new content for a Write. Returns `current` unchanged when
 *  the edit's `old_string` isn't present (a no-op or a soon-to-fail edit). */
function resultingContent(input: HookInput, current: string): string {
  const ti = input.tool_input as {
    content?: string;
    old_string?: string;
    new_string?: string;
    edits?: Array<{ old_string?: string; new_string?: string }>;
  };
  // Write replaces the whole file; Edit is just a single-edit MultiEdit.
  if (input.tool_name === Tools.Write) return ti.content ?? current;
  const edits = ti.edits ?? [{ old_string: ti.old_string, new_string: ti.new_string }];
  return edits.reduce(
    (text, e) => text.replace(e.old_string ?? "", e.new_string ?? ""),
    current,
  );
}

/** Whether an edit to settings.json would remove or alter a harness hook
 *  entry — detected by a drop in the hook-marker count after applying it. If
 *  the harness isn't wired in this file, there's nothing to protect. */
function tampersWithHookWiring(input: HookInput): boolean {
  const path = join(projectDir(), ".claude/settings.json");
  if (!existsSync(path)) return false;
  let current: string;
  try {
    current = readFileSync(path, "utf-8");
  } catch {
    return false;
  }
  const before = count(current, HARNESS_HOOK_MARKER);
  if (before === 0) return false;
  return count(resultingContent(input, current), HARNESS_HOOK_MARKER) < before;
}

const UNLOCK_HINT =
  "ask the user to set HARNESS_UNLOCK=1 in the project .env.agents to make " +
  "harness changes, or to make this change manually.";

/** Matches an attempt to *change* the security level — the `harness` bin or the
 *  CLI entry (`cli/index.{js,ts}`, the direct-bin bypass) invoked with
 *  `security <0-3>`. Read-only forms (`security audit`, the no-arg report) and
 *  unrelated commands that merely mention a level string are not matched.
 *
 *  A cooperative-agent signpost, not a wall: at level 1, raw Bash writes to
 *  `.env` (`echo`, `node -e`, a script) can still set the flag — only level 2's
 *  kernel `denyWrite` closes those. See the design doc. */
const HARNESS_SECURITY_CMD = /\b(?:harness|cli\/index\.[jt]s)\s+security\s+[0-3]\b/;

/** Matches the harness-*mutating* CLI subcommands — `add` (scaffold) and
 *  `update` (sync) — via the `harness` bin or the CLI entry. They modify the
 *  harness surface, so while locked they're gated like a direct edit (otherwise
 *  the agent could scaffold but not author — a confusing half-locked state).
 *  Read-only subcommands (`list`, `health`, `evolve`, `security`/`security
 *  audit`) are not matched. */
const HARNESS_MUTATE_CMD = /\b(?:harness|cli\/index\.[jt]s)\s+(?:add|update)\b/;

export const protectHarness: Guard = {
  name: "protect-harness",
  tools: [Tools.Edit, Tools.Write, Tools.MultiEdit, Tools.Bash],
  // No `files` condition: Bash calls carry no file_path, so a files filter would
  // exclude them. Scope is enforced per-tool in run() instead.
  async run(input) {
    if (isUnlocked()) return guardAllow();

    // Changing the security level is a human-only action (see the design doc).
    if (input.tool_name === Tools.Bash) {
      const command = (input.tool_input as { command?: string })?.command ?? "";
      if (HARNESS_SECURITY_CMD.test(command)) {
        return guardDeny(
          "protect-harness: changing the harness security level is a human action — " +
            "ask the user to run `harness security` in their terminal.",
        );
      }
      if (HARNESS_MUTATE_CMD.test(command)) {
        return guardDeny(
          `protect-harness: \`harness add\`/\`update\` modifies the harness, which is locked. ${UNLOCK_HINT}`,
        );
      }
      return guardAllow();
    }

    const relativePath = relativePathOf(input);

    if (isHarnessFile(relativePath)) {
      return guardDeny(
        `protect-harness: ${relativePath} is part of the harness enforcement surface and is locked. ${UNLOCK_HINT}`,
      );
    }

    if (isAgentsEnvFile(relativePath)) {
      return guardDeny(
        `protect-harness: ${relativePath} holds the harness unlock flag and is locked — editing it could set HARNESS_UNLOCK and weaken enforcement. ${UNLOCK_HINT}`,
      );
    }

    if (isSettingsFile(relativePath) && tampersWithHookWiring(input)) {
      return guardDeny(
        `protect-harness: this edit to ${relativePath} would alter the harness hook wiring, which disables enforcement. ${UNLOCK_HINT}`,
      );
    }

    return guardAllow();
  },
};
