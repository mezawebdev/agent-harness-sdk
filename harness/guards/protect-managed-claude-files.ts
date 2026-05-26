import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  Tools,
  defineGuard,
  guardAllow,
  guardDeny,
  projectDir,
} from "../../src/index";

/** The set of files the CLI manages, read from the sync manifest. The lock's
 *  `files` keys are project-relative paths (e.g. `.claude/rules/harness.md`). */
function readManagedFiles(dir: string): Set<string> {
  const lock = join(dir, "harness", "harness.lock");
  if (!existsSync(lock)) return new Set();
  try {
    const m = JSON.parse(readFileSync(lock, "utf-8")) as {
      files?: Record<string, unknown>;
    };
    return new Set(Object.keys(m.files ?? {}));
  } catch {
    return new Set();
  }
}

/**
 * Blocks direct edits to files synced from agent-harness-sdk (tracked in
 * harness/harness.lock). Those files are generated from the library source —
 * editing them in place is silently lost on the next `harness update`. The
 * source of truth is src/{skills,rules,commands}; changes go through the CLI.
 */
export const protectManagedClaudeFiles = defineGuard({
  name: "protect-managed-claude-files",
  tools: [Tools.Edit, Tools.Write, Tools.MultiEdit],
  files: ["**/.claude/**"],
  async run(input) {
    const dir = projectDir();
    const relativePath = relative(dir, input.tool_input?.file_path ?? "");
    // Coarse-filtered to .claude writes; allow the ones the CLI doesn't manage.
    if (!readManagedFiles(dir).has(relativePath)) return guardAllow();
    return guardDeny(
      `protect-managed-claude-files: ${relativePath} is synced from agent-harness-sdk and tracked in harness/harness.lock. ` +
        `Editing it directly won't stick — \`harness update\` will overwrite it. ` +
        `Edit the source under src/{skills,rules,commands} and run \`npx harness update\` instead.`,
    );
  },
});
