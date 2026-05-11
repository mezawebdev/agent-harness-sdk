/** Templates emitted by `harness add <type> <name>`. */
import { kebabToCamel, kebabToSnake } from "./case";

export type AddType = "tool" | "guard" | "check";

export type Scaffold = {
  /** Path relative to project root. */
  filePath: string;
  /** File content. */
  content: string;
  /** Camelcase identifier to use in harness.config.ts. */
  configBinding: string;
  /** Array name in harness.config.ts. */
  configArrayName: "tools" | "guards" | "checks";
  /** Import path relative to harness.config.ts. */
  configImportPath: string;
  /** Whether the export is default (true for tool) or named (false for guard/check). */
  configIsDefault: boolean;
};

export function scaffold(type: AddType, name: string): Scaffold {
  switch (type) {
    case "tool":
      return scaffoldTool(name);
    case "guard":
      return scaffoldGuard(name);
    case "check":
      return scaffoldCheck(name);
  }
}

function scaffoldTool(name: string): Scaffold {
  const camel = kebabToCamel(name);
  const snake = kebabToSnake(name);
  return {
    filePath: `harness/tools/${name}.ts`,
    configBinding: camel,
    configArrayName: "tools",
    configImportPath: `./tools/${name}.js`,
    configIsDefault: true,
    content: `import { defineTool, toolErr, toolOk, z } from "agent-harness-sdk";

export default defineTool({
  name: "${snake}",
  config: {
    title: "${name}",
    description: "TODO: describe what this tool does — be specific about when to use it.",
    // inputSchema: { arg: z.string() }, // optional — declare any zod-typed inputs
  },
  handler: async () => {
    // TODO: implement
    return toolOk(null);
  },
});
`,
  };
}

function scaffoldGuard(name: string): Scaffold {
  const camel = kebabToCamel(name);
  return {
    filePath: `harness/guards/${name}.ts`,
    configBinding: camel,
    configArrayName: "guards",
    configImportPath: `./guards/${name}.js`,
    configIsDefault: false,
    content: `import { defineGuard, guardAllow, guardDeny } from "agent-harness-sdk";

export const ${camel} = defineGuard({
  name: "${name}",
  matches: (_input) => {
    // TODO: return true ONLY for tool calls this guard should inspect.
    // Keep this fast — runs on every tool call.
    return false;
  },
  async run(_input) {
    // TODO: decide whether to allow or deny.
    // return guardDeny("${name}: <why this was blocked>");
    return guardAllow();
  },
});
`,
  };
}

function scaffoldCheck(name: string): Scaffold {
  const camel = kebabToCamel(name);
  return {
    filePath: `harness/checks/${name}.ts`,
    configBinding: camel,
    configArrayName: "checks",
    configImportPath: `./checks/${name}.js`,
    configIsDefault: false,
    content: `import { defineCheck, checkFail, checkOk } from "agent-harness-sdk";

export const ${camel} = defineCheck({
  name: "${name}",
  matches: (_filePath) => {
    // TODO: return true for paths this check should inspect.
    return false;
  },
  async run(_filePath) {
    // TODO: validate the resulting state.
    // return checkFail("${name}: <what's wrong>");
    return checkOk();
  },
});
`,
  };
}
