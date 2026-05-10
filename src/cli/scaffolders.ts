/** Templates emitted by `harness add <type> <name>`. */
import { kebabToCamel, kebabToSnake } from "./case";

export type AddType = "tool" | "guard" | "check" | "skill" | "subagent" | "rule";

export type Scaffold = {
  /** Path relative to project root. */
  filePath: string;
  /** File content. */
  content: string;
  /** Camelcase identifier to use in harness.config.ts (only for tool/guard/check). */
  configBinding?: string;
  /** Array name in harness.config.ts (only for tool/guard/check). */
  configArrayName?: "tools" | "guards" | "checks";
  /** Import path relative to harness.config.ts (only for tool/guard/check). */
  configImportPath?: string;
  /** Whether the export is default (true for tool) or named (false for guard/check). */
  configIsDefault?: boolean;
};

export function scaffold(type: AddType, name: string): Scaffold {
  switch (type) {
    case "tool":
      return scaffoldTool(name);
    case "guard":
      return scaffoldGuard(name);
    case "check":
      return scaffoldCheck(name);
    case "skill":
      return scaffoldSkill(name);
    case "subagent":
      return scaffoldSubagent(name);
    case "rule":
      return scaffoldRule(name);
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
    content: `import { z } from "zod";
import { defineTool, toolErr, toolOk } from "agent-harness-sdk";

export default defineTool({
  name: "${snake}",
  config: {
    title: "${name}",
    description: "TODO: describe what this tool does — be specific about when to use it.",
    inputSchema: {
      // TODO: define inputs, e.g.:
      // arg: z.string(),
    },
  },
  handler: async (_args) => {
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
    content: `import { defineGuard } from "agent-harness-sdk";

export const ${camel} = defineGuard({
  name: "${name}",
  matches: (_input) => {
    // TODO: return true ONLY for tool calls this guard should inspect.
    // Keep this fast — runs on every tool call.
    return false;
  },
  async run(_input) {
    // TODO: decide whether to allow or deny.
    // return { allow: false, reason: "${name}: <why this was blocked>" };
    return { allow: true };
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
    content: `import { defineCheck } from "agent-harness-sdk";

export const ${camel} = defineCheck({
  name: "${name}",
  matches: (_filePath) => {
    // TODO: return true for paths this check should inspect.
    return false;
  },
  async run(_filePath) {
    // TODO: validate the resulting state.
    // return { ok: false, message: "${name}: <what's wrong>" };
    return { ok: true };
  },
});
`,
  };
}

function scaffoldSkill(name: string): Scaffold {
  return {
    filePath: `.claude/skills/${name}/SKILL.md`,
    content: `---
name: ${name}
description: TODO — when should Claude invoke this skill? Lead with "Use for X". Mention what to use instead for adjacent cases.
---

# ${name}

TODO: One-line summary of what this skill does.

## Tools available

- TODO: list any tools this skill orchestrates.

## Workflows

### TODO: workflow name

1. TODO: step
2. TODO: step

## Constraints

- TODO: what should this skill NOT do
`,
  };
}

function scaffoldSubagent(name: string): Scaffold {
  return {
    filePath: `.claude/agents/${name}.md`,
    content: `---
name: ${name}
description: TODO — when should Claude delegate to this agent? Should describe COMPOUND or AUTONOMOUS work. Mention what skill to use instead for one-shot tasks.
tools: Read, Edit, Write, Glob, Grep, Bash
---

You own TODO. Everything else is out of scope.

## Skills

- TODO: which skills this agent orchestrates

## Constraints

- Path scope: TODO
- TODO: other constraints
- If the same task fails three times, stop and report rather than thrashing.
`,
  };
}

function scaffoldRule(name: string): Scaffold {
  return {
    filePath: `.claude/rules/${name}.md`,
    content: `# ${name}

TODO: brief intro — what this rule is about and when it applies.

## Section

- TODO: rule

## Section

- TODO: more content
`,
  };
}
