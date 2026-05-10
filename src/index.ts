export const VERSION = "0.0.0";

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
// Tool helpers
// ──────────────────────────────────────────────────────────────────────────
export { toolOk, toolErr } from "./types";

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

// ──────────────────────────────────────────────────────────────────────────
// Observability
// ──────────────────────────────────────────────────────────────────────────
export { logEvent, readLog } from "./observability/log";
export type { LogEntry } from "./observability/log";
