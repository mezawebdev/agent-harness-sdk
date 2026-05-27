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
 *
 * @example
 * ```ts
 * import { defineHarness, protectEnvFiles } from "agent-harness-sdk";
 * import myTool from "./tools/my-tool";
 * import { myGuard } from "./guards/my-guard";
 * import { myCheck } from "./checks/my-check";
 *
 * export default defineHarness({
 *   tools: [myTool],
 *   guards: [protectEnvFiles, myGuard],
 *   checks: [myCheck],
 * });
 * ```
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
 *
 * Names are snake_case (surfaces as `mcp__<server>__<name>`). Return
 * {@link toolOk} / {@link toolErr} — never throw.
 *
 * @example
 * ```ts
 * import { defineTool, toolOk, toolErr, z } from "agent-harness-sdk";
 *
 * export default defineTool({
 *   name: "fetch_weather",
 *   config: {
 *     title: "Fetch weather",
 *     description: "Get current conditions for a city. Call when the user asks about weather.",
 *     inputSchema: { city: z.string() },
 *   },
 *   handler: async ({ city }) => {
 *     if (!city) return toolErr("city is required");
 *     return toolOk({ city, tempF: 72 });
 *   },
 * });
 * ```
 */
export function defineTool<Schema extends ZodRawShape = {}>(
  spec: ToolSpec<Schema>,
): Tool {
  return spec as unknown as Tool;
}

/**
 * Factory for guards — pre-action policies that veto a tool call before it
 * runs. Scope with the declarative `tools` / `files` / `when` conditions; put
 * dynamic logic in `run`, returning {@link guardAllow} or {@link guardDeny}.
 * The deny reason is prompted back to Claude — make it actionable.
 *
 * @example
 * ```ts
 * import { defineGuard, guardAllow, guardDeny, Tools } from "agent-harness-sdk";
 *
 * export const blockPushes = defineGuard({
 *   name: "block-pushes",
 *   tools: [Tools.Bash],
 *   run: async (input) => {
 *     const command = (input.tool_input as { command?: string })?.command ?? "";
 *     if (command.includes("git push")) {
 *       return guardDeny("block-pushes: pushing is disabled; ask the user to push manually.");
 *     }
 *     return guardAllow();
 *   },
 * });
 * ```
 */
export function defineGuard(guard: Guard): Guard {
  return guard;
}

/**
 * Factory for checks — post-action validators that run after a tool completes
 * (default event: `post-tool-use`). Scope to the edits you care about with
 * `files`; `run` may shell out to a linter/test runner. Return
 * {@link checkOk} to pass silently, or {@link checkFail} with an actionable
 * message that gets prompted back to Claude.
 *
 * @example
 * ```ts
 * import { defineCheck, checkFail, checkOk, projectDir, Tools } from "agent-harness-sdk";
 * import { execSync } from "node:child_process";
 *
 * export const lintServices = defineCheck({
 *   name: "lint-services",
 *   tools: [Tools.Edit, Tools.Write, Tools.MultiEdit],
 *   files: ["**\/services/*.ts"],
 *   run: async (filePath) => {
 *     try {
 *       execSync(`npx --no-install eslint "${filePath}"`, { stdio: "pipe", cwd: projectDir() });
 *     } catch (err) {
 *       return checkFail(`lint-services failed:\n${(err as { stdout?: Buffer }).stdout?.toString() ?? ""}`);
 *     }
 *     return checkOk();
 *   },
 * });
 * ```
 */
export function defineCheck(check: Check): Check {
  return check;
}
