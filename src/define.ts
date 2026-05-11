import type { ZodRawShape } from "zod";
import type { Check, Guard, Tool } from "./types";

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
 * Type-only helper. Preserves the input-schema generic so handler args are
 * inferred correctly. Equivalent to `… satisfies Tool` but reads more clearly.
 */
export function defineTool<Schema extends ZodRawShape>(
  tool: Tool<Schema>,
): Tool<Schema> {
  return tool;
}

export function defineGuard(guard: Guard): Guard {
  return guard;
}

export function defineCheck(check: Check): Check {
  return check;
}
