export const VERSION = "0.0.0";

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
// Universal tools (library-provided)
// ──────────────────────────────────────────────────────────────────────────
export { harnessStatus } from "./tools/harness-status";
export {
  evolveRecordRun,
  evolveDismissFinding,
} from "./tools/evolve-state";

// ──────────────────────────────────────────────────────────────────────────
// Observability
// ──────────────────────────────────────────────────────────────────────────
export { logEvent, readLog } from "./observability/log";
export type { LogEntry } from "./observability/log";
