import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Walk up from this file looking for agent-harness-sdk's own package.json.
 *  Survives any bundle output layout (src/, dist/, dist/_chunks/, etc.). */
function readPackageVersion(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
          name?: string;
          version?: string;
        };
        if (pkg.name === "agent-harness-sdk") return pkg.version ?? "0.0.0";
      } catch {
        // keep walking
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return "0.0.0";
}

export const VERSION = readPackageVersion();

// ──────────────────────────────────────────────────────────────────────────
// Re-exports
// ──────────────────────────────────────────────────────────────────────────
// Re-export zod so users have a single import surface. Zod is required by the
// MCP SDK for tool input schemas; re-exporting means users don't have to
// install or import it separately.
export { z } from "zod";

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────
export type {
  HookInput,
  Tool,
  ToolResult,
  Guard,
  GuardResult,
  GuardPhase,
  Check,
  CheckResult,
  CheckPhase,
} from "./types";

// ──────────────────────────────────────────────────────────────────────────
// Result helpers — build the standard envelope for each primitive
// ──────────────────────────────────────────────────────────────────────────
export { toolOk, toolErr } from "./types";
export { guardAllow, guardDeny } from "./types";
export { checkOk, checkFail } from "./types";

// ──────────────────────────────────────────────────────────────────────────
// Hook utilities (stdin I/O, exit helpers)
// ──────────────────────────────────────────────────────────────────────────
export { readHookInput, pass, block, projectDir } from "./hooks/utils";

// ──────────────────────────────────────────────────────────────────────────
// Hook dispatcher factories
// ──────────────────────────────────────────────────────────────────────────
export {
  createPreToolUseDispatcher,
  createPostToolUseDispatcher,
} from "./hooks/dispatch";

// ──────────────────────────────────────────────────────────────────────────
// MCP server bootstrap
// ──────────────────────────────────────────────────────────────────────────
export { createMcpServer } from "./mcp/server";
export type { CreateMcpServerOptions } from "./mcp/server";

// ──────────────────────────────────────────────────────────────────────────
// Config + factory helpers
// ──────────────────────────────────────────────────────────────────────────
export { defineHarness, defineTool, defineGuard, defineCheck } from "./define";
export type { HarnessConfig } from "./define";

// ──────────────────────────────────────────────────────────────────────────
// Universal guards (library-provided)
// ──────────────────────────────────────────────────────────────────────────
export { protectEnvFiles } from "./guards/protect-env-files";

// ──────────────────────────────────────────────────────────────────────────
// Observability
// ──────────────────────────────────────────────────────────────────────────
export { logEvent, readLog } from "./observability/log";
export type { LogEntry } from "./observability/log";
