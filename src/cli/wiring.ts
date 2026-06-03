/**
 * Reads, merges, and writes the harness's hook wiring into `.claude/settings.json`
 * and its server entry into `.mcp.json`, preserving all other user content.
 *
 * Shared by `init` (first install) and `update` (so SDK upgrades that change the
 * wiring — matchers, hook commands, denyWrite rules — actually reach existing
 * projects; `syncContent` alone only touches the `.claude/` markdown). Idempotent:
 * writes only when the merged result differs, and reports which files changed.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mergeClaudeSettings, mergeMcpServers } from "./merge-config";
import { harnessHookEntries, harnessMcpServerEntry } from "./templates";

export const HARNESS_MCP_SERVER_KEY = "harness-mcp";

export type WiringOutcome = "updated" | "unchanged";

export interface WiringSummary {
  settings: WiringOutcome;
  mcp: WiringOutcome;
}

export function installWiring(cwd: string): WiringSummary {
  // The SDK's own repo wires hooks via `$CLAUDE_PROJECT_DIR/src/hooks/*.ts`
  // (build-free dogfooding), which carries none of the `dist/hooks/` marker the
  // merge dedupes on — so re-merging here would *append* duplicate dist entries
  // rather than replace. Leave wiring untouched in the self-repo (the markdown
  // sync still runs). Consumers never hit this — their package name isn't ours.
  if (isSelfRepo(cwd)) return { settings: "unchanged", mcp: "unchanged" };
  return {
    settings: writeMerged(join(cwd, ".claude/settings.json"), (current) =>
      mergeClaudeSettings(
        current as Parameters<typeof mergeClaudeSettings>[0],
        harnessHookEntries(),
      ),
    ),
    mcp: writeMerged(join(cwd, ".mcp.json"), (current) =>
      mergeMcpServers(
        current as Parameters<typeof mergeMcpServers>[0],
        HARNESS_MCP_SERVER_KEY,
        harnessMcpServerEntry(),
      ),
    ),
  };
}

/** Whether `cwd` is the agent-harness-sdk package itself (which dogfoods via
 *  source-path hook wiring the dist-marker merge can't dedupe). */
function isSelfRepo(cwd: string): boolean {
  try {
    const pkg = JSON.parse(
      readFileSync(join(cwd, "package.json"), "utf-8"),
    ) as { name?: string };
    return pkg.name === "agent-harness-sdk";
  } catch {
    return false;
  }
}

/** Merge `path`'s JSON (or null if absent/unparseable) through `merge` and write
 *  it back only when the serialized result changed — so a no-op update doesn't
 *  touch the file's mtime and can be reported as `unchanged`. */
function writeMerged(
  path: string,
  merge: (current: unknown) => unknown,
): WiringOutcome {
  const before = existsSync(path) ? readFileSync(path, "utf-8") : null;
  let parsed: unknown = null;
  if (before !== null) {
    try {
      parsed = JSON.parse(before);
    } catch {
      parsed = null;
    }
  }
  const after = `${JSON.stringify(merge(parsed), null, 2)}\n`;
  if (before === after) return "unchanged";
  writeFileSync(path, after);
  return "updated";
}
