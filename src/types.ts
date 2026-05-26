import type { ZodRawShape } from "zod";
import type { ToolName } from "./tool-names";

// ──────────────────────────────────────────────────────────────────────────
// Hook input — shape Claude Code sends via stdin to hook scripts.
// ──────────────────────────────────────────────────────────────────────────

export type HookInput = {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: {
    file_path?: string;
    [key: string]: unknown;
  };
  tool_response?: unknown;
};

// ──────────────────────────────────────────────────────────────────────────
// Tools — MCP-exposed deterministic operations.
// ──────────────────────────────────────────────────────────────────────────

export type ToolResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type ToolContent = {
  content: Array<{ type: "text"; text: string }>;
};

export function toolOk<T>(data: T): ToolContent {
  return {
    content: [{ type: "text", text: JSON.stringify({ ok: true, data }) }],
  };
}

export function toolErr(error: string): ToolContent {
  return {
    content: [{ type: "text", text: JSON.stringify({ ok: false, error }) }],
  };
}

export type Tool = {
  name: string;
  config: {
    title?: string;
    description: string;
    /** Zod shape describing tool inputs. Omit for tools that take no arguments. */
    inputSchema?: ZodRawShape;
  };
  /** Args are typed at author time by `defineTool` based on `inputSchema`;
   *  erased to `unknown` here so tools with different schemas can share an array. */
  handler: (args: unknown) => Promise<ToolContent>;
};

// ──────────────────────────────────────────────────────────────────────────
// Conditions — declarative activation filters shared by guards and checks.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Declarative filters that decide whether a guard/check is active for a tool
 * call. Every provided field must pass (logical AND); within an array, any
 * member matches (OR). Omit all fields to run on every tool call.
 */
export type Conditions = {
  /** Active only for these tool names. Omit = any tool. The `Tools` const gives
   *  autocomplete for built-ins; arbitrary strings (e.g. MCP tools) are allowed. */
  tools?: (ToolName | (string & {}))[];
  /** Active only when `tool_input.file_path` matches one of these globs
   *  (picomatch). A call with no `file_path` (e.g. Bash) never matches. */
  files?: string[];
  /** Custom predicate, ANDed with the conditions above. Escape hatch for
   *  filters that can't be expressed declaratively. */
  when?: (input: HookInput) => boolean;
};

// ──────────────────────────────────────────────────────────────────────────
// Guards — pre-action policies. Block tool calls before they run.
// ──────────────────────────────────────────────────────────────────────────

export type GuardResult = { allow: true } | { allow: false; reason: string };

export function guardAllow(): GuardResult {
  return { allow: true };
}

export function guardDeny(reason: string): GuardResult {
  return { allow: false, reason };
}

export type GuardPhase = "pre-tool-use";

export type Guard = Conditions & {
  name: string;
  on?: GuardPhase;
  /**
   * @deprecated Use the declarative `tools` / `files` / `when` conditions
   * instead. Still honored (ANDed with any conditions); removed in a future
   * release.
   */
  matches?: (input: HookInput) => boolean;
  run: (input: HookInput) => Promise<GuardResult>;
};

// ──────────────────────────────────────────────────────────────────────────
// Checks — post-action validators. Inspect state after a tool runs.
// ──────────────────────────────────────────────────────────────────────────

export type CheckResult = { ok: true } | { ok: false; message: string };

export function checkOk(): CheckResult {
  return { ok: true };
}

export function checkFail(message: string): CheckResult {
  return { ok: false, message };
}

export type CheckPhase = "post-tool-use" | "stop" | "post-tool-batch";

export type Check = Conditions & {
  name: string;
  /** Which Claude event this check fires on. Defaults to "post-tool-use". */
  on?: CheckPhase;
  /**
   * @deprecated Use the declarative `tools` / `files` / `when` conditions
   * instead. Still honored (ANDed with any conditions); removed in a future
   * release.
   */
  matches?: (filePath: string, input: HookInput) => boolean;
  run: (filePath: string, input: HookInput) => Promise<CheckResult>;
};
