import type { z, ZodRawShape } from "zod";
import type { Check, Guard, Tool, ToolContent } from "./types";

/**
 * Top-level harness configuration. Declared in `harness/harness.config.ts`,
 * read by entry-point files (mcp/index.ts, hooks/*.ts).
 *
 * `mcp.name` and `mcp.version` default to "harness-mcp" and "0.1.0" — only set
 * them if your project surfaces the MCP server name somewhere user-visible.
 */
export type HarnessConfig = {
  mcp?: {
    name?: string;
    version?: string;
  };
  tools?: Tool[];
  guards?: Guard[];
  checks?: Check[];
};

/**
 * Type-only helper. Returns its argument unchanged; exists for inference and
 * autocomplete on the config object.
 */
export function defineHarness(config: HarnessConfig): HarnessConfig {
  return config;
}

/**
 * Author-time shape for `defineTool`. The `Schema` generic flows into the
 * handler's `args` parameter so tools that declare an `inputSchema` get
 * typed args, and tools that omit it get a no-argument handler.
 */
type ToolSpec<Schema extends ZodRawShape> = {
  name: string;
  config: {
    title?: string;
    description: string;
    inputSchema?: Schema;
  };
  handler: keyof Schema extends never
    ? () => Promise<ToolContent>
    : (args: z.infer<z.ZodObject<Schema>>) => Promise<ToolContent>;
};

/**
 * Factory for tools. Infers handler args from `inputSchema` at author time,
 * then erases the schema generic so the result fits into `Tool[]` regardless
 * of which inputs it declares.
 */
export function defineTool<Schema extends ZodRawShape = {}>(
  spec: ToolSpec<Schema>,
): Tool {
  return spec as unknown as Tool;
}

export function defineGuard(guard: Guard): Guard {
  return guard;
}

export function defineCheck(check: Check): Check {
  return check;
}
