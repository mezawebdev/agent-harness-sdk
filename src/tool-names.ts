/**
 * Convenience constants for Claude Code's common built-in tool names, so guard
 * and check authors don't memorize or fat-finger string literals.
 *
 * Not exhaustive and not version-pinned — Claude Code's tool set evolves, and
 * MCP tools surface as `mcp__<server>__<tool>`. Condition fields accept any
 * string; these constants just give autocomplete for the common cases.
 *
 * A frozen const object rather than a TS enum: enums are nominal (would reject
 * raw strings), emit runtime code, and `const enum` is incompatible with this
 * project's `isolatedModules` + esbuild build.
 */
export const Tools = {
  Bash: "Bash",
  Edit: "Edit",
  Write: "Write",
  MultiEdit: "MultiEdit",
  Read: "Read",
  Glob: "Glob",
  Grep: "Grep",
  NotebookEdit: "NotebookEdit",
  WebFetch: "WebFetch",
  WebSearch: "WebSearch",
  Task: "Task",
  TodoWrite: "TodoWrite",
} as const;

export type ToolName = (typeof Tools)[keyof typeof Tools];
