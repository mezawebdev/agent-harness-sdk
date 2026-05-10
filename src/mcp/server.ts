import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { logEvent } from "../observability/log";
import type { Tool } from "../types";

export type CreateMcpServerOptions = {
  name: string;
  version: string;
  tools: Tool[];
};

/**
 * Boots an MCP server over stdio. Registers the given tools (in order),
 * auto-instruments handlers with logEvent, and connects.
 */
export async function createMcpServer(
  opts: CreateMcpServerOptions,
): Promise<void> {
  const server = new McpServer({ name: opts.name, version: opts.version });

  for (const tool of opts.tools) {
    if (!tool?.name || !tool?.config || !tool?.handler) {
      throw new Error(
        `Invalid tool registration: each entry must have { name, config, handler }`,
      );
    }
    const wrapped = wrapWithLogging(tool);
    server.registerTool(tool.name, tool.config, wrapped);
  }

  await server.connect(new StdioServerTransport());
}

function wrapWithLogging(tool: Tool): Tool["handler"] {
  return (async (args: Parameters<Tool["handler"]>[0]) => {
    const start = Date.now();
    try {
      const result = await tool.handler(args);
      const text = result.content?.[0]?.text ?? "";
      let parsed: { ok?: boolean; error?: string } = {};
      try {
        parsed = JSON.parse(text);
      } catch {
        // Not JSON; treat as ok
        parsed = { ok: true };
      }
      logEvent(`tool.${tool.name}.invoked`, {
        tool_name: tool.name,
        ok: parsed.ok !== false,
        error: parsed.error,
        duration_ms: Date.now() - start,
      });
      return result;
    } catch (err) {
      logEvent(`tool.${tool.name}.invoked`, {
        tool_name: tool.name,
        ok: false,
        error: (err as Error).message,
        duration_ms: Date.now() - start,
      });
      throw err;
    }
  }) as Tool["handler"];
}
