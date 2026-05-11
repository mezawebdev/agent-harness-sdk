/**
 * Merge helpers for `.claude/settings.json` and `.mcp.json`. Used by `harness init`
 * to preserve any user-managed content while inserting our hook registrations
 * and MCP server entry. Idempotent: re-running merges replaces our previous
 * entries instead of duplicating them.
 */

/** Heuristic for detecting our own hook commands so re-runs don't duplicate. */
const HARNESS_HOOK_MARKER = "agent-harness-sdk/dist/hooks/";

type ClaudeHookEntry = {
  matcher?: string;
  hooks?: Array<{ type?: string; command?: string }>;
};

type ClaudeHooks = Record<string, ClaudeHookEntry[]>;

type ClaudeSettings = {
  hooks?: ClaudeHooks;
  [key: string]: unknown;
};

export function mergeClaudeSettings(
  existing: ClaudeSettings | null,
  ourHooks: ClaudeHooks,
): ClaudeSettings {
  const settings: ClaudeSettings = { ...(existing ?? {}) };
  const hooks: ClaudeHooks = { ...(settings.hooks ?? {}) };

  for (const [event, ourEntries] of Object.entries(ourHooks)) {
    const previous = hooks[event] ?? [];
    const userOnly = previous.filter((entry) => !isHarnessEntry(entry));
    hooks[event] = [...userOnly, ...ourEntries];
  }

  settings.hooks = hooks;
  return settings;
}

function isHarnessEntry(entry: ClaudeHookEntry): boolean {
  if (!entry?.hooks || !Array.isArray(entry.hooks)) return false;
  return entry.hooks.some(
    (h) =>
      typeof h?.command === "string" && h.command.includes(HARNESS_HOOK_MARKER),
  );
}

type McpServerEntry = {
  type?: string;
  command?: string;
  args?: string[];
  [key: string]: unknown;
};

type McpJson = {
  mcpServers?: Record<string, McpServerEntry>;
  [key: string]: unknown;
};

export function mergeMcpServers(
  existing: McpJson | null,
  serverName: string,
  entry: McpServerEntry,
): McpJson {
  const mcp: McpJson = { ...(existing ?? {}) };
  mcp.mcpServers = { ...(mcp.mcpServers ?? {}), [serverName]: entry };
  return mcp;
}
