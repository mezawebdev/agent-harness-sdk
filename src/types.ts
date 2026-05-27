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

/**
 * Build a success envelope from a tool handler: `{ ok: true, data }`.
 * Return structured data, not prose — the caller reads the JSON.
 *
 * @example
 * ```ts
 * return toolOk({ city: "Berlin", tempF: 72 });
 * ```
 */
export function toolOk<T>(data: T): ToolContent {
  return {
    content: [{ type: "text", text: JSON.stringify({ ok: true, data }) }],
  };
}

/**
 * Build a failure envelope from a tool handler: `{ ok: false, error }`.
 * Prefer returning this over throwing; the message is surfaced verbatim.
 *
 * @example
 * ```ts
 * if (!city) return toolErr("city is required");
 * ```
 */
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

/**
 * Allow the tool call through. Return from a guard's `run` when the call is OK.
 * Takes no argument and prompts nothing back to Claude — the allow path stays
 * silent so it adds no noise to the agent's context.
 *
 * @example
 * ```ts
 * return guardAllow();
 * ```
 */
export function guardAllow(): GuardResult {
  return { allow: true };
}

/**
 * Veto the tool call — it never runs and `reason` is prompted back to Claude
 * (the only guard path that surfaces text). Prefix the reason with the guard
 * name and make it actionable.
 *
 * @example
 * ```ts
 * return guardDeny("block-pushes: pushing is disabled; ask the user to push manually.");
 * ```
 */
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

/**
 * Pass the check. Return from a check's `run` when the resulting state is
 * valid. Takes no argument and prompts nothing back to Claude — the passing
 * path stays silent so it adds no noise to the agent's context.
 *
 * @example
 * ```ts
 * return checkOk();
 * ```
 */
export function checkOk(): CheckResult {
  return { ok: true };
}

/**
 * Fail the check — `message` is prompted back to Claude as actionable feedback
 * to fix the file on the next iteration (this is the only check path that
 * surfaces text). Include enough context to act on.
 *
 * @example
 * ```ts
 * return checkFail(`lint-services failed:\n${output}`);
 * ```
 */
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
