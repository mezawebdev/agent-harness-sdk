---
name: harness-author-tool
description: Use when the user wants to add a new MCP tool to the harness. Tools are deterministic operations the agent can call (e.g. scaffold_service, validate_X, find_consumers). For prose-driven workflows that orchestrate tools, write a skill at `.claude/skills/<name>/SKILL.md` — skill conventions live in `harness.md`.
---

<!-- managed by agent-harness-sdk — local edits will be skipped on `harness update` -->

# harness-author-tool

A **tool** is a deterministic operation exposed via MCP. Same input → same output, every time. Tools handle the work that would be error-prone to do via prose.

## File location

`harness/tools/<name>.ts` — one tool per file, default-exported.

## Shape

```ts
import { defineTool, toolOk, toolErr } from "agent-harness-sdk";
import { z } from "zod";

export default defineTool({
  name: "tool_name",
  config: {
    title: "Human-readable title",
    description: "What this tool does. Be specific — Claude reads this to decide when to call it.",
    inputSchema: {
      arg: z.string(),
    },
  },
  handler: async ({ arg }) => {
    if (somethingWrong) return toolErr("descriptive error message");
    return toolOk({ resultField: "value" });
  },
});
```

## Registration

Add the import + entry to `harness/harness.config.ts`:

```ts
import myTool from "./tools/my-tool.js";

export default defineHarness({
  // ...
  tools: [
    // existing tools
    myTool,
  ],
});
```

## Conventions

- **Names are snake_case** (industry MCP convention; surfaces to Claude as `mcp__<server>__tool_name`).
- **Inputs are zod-validated** at the tool boundary; bad input never reaches the handler.
- **Outputs use the standard envelope** (`toolOk` / `toolErr`). See `.claude/rules/harness.md`.
- **Side effects belong in tools, not skills.** If a step writes a file, runs a command, or mutates state — it's a tool.

## Quality checklist

- Description is specific enough that Claude knows when to call it (not just what it does)
- All inputs have zod schemas (use regex for format constraints)
- Errors return `toolErr(...)`, not throws
- Successful results return structured `data`, not prose
