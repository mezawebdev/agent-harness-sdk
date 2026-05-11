import type { z, ZodRawShape } from "zod";

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

type ToolContent = {
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

export type Tool<Schema extends ZodRawShape = {}> = {
  name: string;
  config: {
    title?: string;
    description: string;
    /** Zod shape describing tool inputs. Omit for tools that take no arguments. */
    inputSchema?: Schema;
  };
  handler: (args: z.infer<z.ZodObject<Schema>>) => Promise<ToolContent>;
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

export type Guard = {
  name: string;
  on?: GuardPhase;
  matches: (input: HookInput) => boolean;
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

export type Check = {
  name: string;
  /** Which Claude event this check fires on. Defaults to "post-tool-use". */
  on?: CheckPhase;
  matches: (filePath: string, input: HookInput) => boolean;
  run: (filePath: string, input: HookInput) => Promise<CheckResult>;
};
