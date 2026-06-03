<!-- managed by agent-harness-sdk — local edits will be skipped on `harness update` -->

# Harness conventions

Project-wide conventions for working with the tools, guards, and checks defined under `harness/`. These apply to every skill, agent, and direct tool use in this project.

## Tool result envelope

Every MCP tool returns the same shape:

- Success: `{ ok: true, data: <payload> }`
- Failure: `{ ok: false, error: <string> }`

Read the JSON envelope to decide outcome. Don't paraphrase. Failure `error` strings are pre-formatted — surface them verbatim to the caller.

## Hook feedback

The harness runs **guards** before tool calls and **checks** after them. Both are registered in `harness/harness.config.ts`:

- **Guards** (pre-action) may block a tool call before it runs. Stderr explains why; act on it.
- **Checks** (post-action) run after Edit/Write/MultiEdit. If non-zero, stderr is actionable feedback — fix the file, not the tooling.

Trust the hook result. Do not re-run lint/test commands after a green hook. To see what's enforced for this project, read `harness/harness.config.ts`.

## Trust boundaries

Do not edit the harness to silence failures:

- `.claude/` (settings, agents, skills, rules)
- `harness/` (config, guards, checks, tools, rules)
- `eslint.config.ts`, `vitest.config.ts`
- Contract tests under `**/__tests__/`

If a tool keeps failing, report it — do not bypass.

### Enforced lock

The built-in `protect-harness` guard **enforces** part of this boundary: edits
to `harness/**`, `.env.agents` (the harness unlock file), and the harness hook
wiring in `.claude/settings.json` are blocked by default. This guard is injected
by the hook dispatcher itself — it is not in `harness.config.ts` and cannot be
unregistered there. (The app's own `.env` is the separate, opt-in
`protect-env-files` guard's concern, not this one.)

Unlocking the harness is a **human** decision that the agent cannot perform
itself. When you hit this block, don't try to route around it (e.g. via a shell
command or script) — surface it to the user and ask them to unlock the harness
or make the change manually.

## Authoring tools

A **tool** is a deterministic MCP operation. Same input → same output, every time. Use a tool whenever a step would be error-prone to do via prose.

**Location:** `harness/tools/<name>.ts` — one tool per file, default-exported.

**Shape:**

```ts
import { defineTool, toolOk, toolErr, z } from "agent-harness-sdk";

export default defineTool({
  name: "tool_name",
  config: {
    title: "Human-readable title",
    description: "Specific enough that Claude knows when to call it — not just what it does.",
    inputSchema: { arg: z.string() },
  },
  handler: async ({ arg }) => {
    if (somethingWrong) return toolErr("descriptive error message");
    return toolOk({ resultField: "value" });
  },
});
```

**Conventions:**

- **Names are snake_case** (MCP convention; surfaces as `mcp__<server>__tool_name`).
- **Inputs are zod-validated** at the boundary; bad input never reaches the handler.
- **Errors return `toolErr(...)`**, not throws.
- **Successes return structured `data`**, not prose.
- **Side effects belong in tools, not skills.** If a step writes a file, runs a command, or mutates state — it's a tool.

Scaffold: `/harness add tool <name>` (auto-registers in `harness.config.ts`).

## Authoring guards

A **guard** is a pre-action policy. It inspects what Claude is about to do (tool name + tool input) and either allows or denies. If denied, the tool never runs and Claude sees the reason.

**When to write a guard vs. a check:**

- **Guard** — irreversible damage, secret leaks, scope violations. Cost of one slip-through is high.
- **Check** — anything you can fix on the next iteration. Validation, drift, contract violations.

**Location:** `harness/guards/<name>.ts` — one guard per file, named export.

**Shape:**

```ts
import { defineGuard, guardAllow, guardDeny, Tools } from "agent-harness-sdk";

export const myGuard = defineGuard({
  name: "my-guard",
  tools: [Tools.Bash],          // only inspect Bash calls
  run: async (input) => {
    const command = (input.tool_input as { command?: string })?.command ?? "";
    if (command.includes("rm -rf")) return guardDeny("rm -rf is blocked by my-guard");
    return guardAllow();
  },
});
```

**Activation conditions** decide *when* a guard runs. Declare any combination — all provided must pass (AND); within an array, any member matches (OR). Omit them all to run on every tool call.

- **`tools`** — tool-name allowlist. Use the `Tools` const (`Tools.Edit`) for built-ins; raw strings (e.g. `"mcp__server__tool"`) also work.
- **`files`** — glob patterns matched against `tool_input.file_path` (picomatch). A call with no file path (e.g. Bash) never matches.
- **`when`** — custom `(input) => boolean` predicate for filters the above can't express.

> `matches` is **deprecated** — prefer the conditions above. It still works (ANDed with any conditions) but will be removed.

**Conventions:**

- **Conditions are a coarse filter; `run()` makes the call.** Put dynamic logic (reading a file, querying state) in `run`, which may be async and return `guardAllow()` or `guardDeny()`.
- **Reason strings are surfaced verbatim to Claude.** Prefix with the guard name. Make them actionable ("ask the user to do this manually").
- **Don't over-enforce.** Every false positive blocks legitimate work.

Scaffold: `/harness add guard <name>`.

## Authoring checks

A **check** is a post-action validator. It runs after a tool completes (typically Edit/Write/MultiEdit) and inspects the resulting state. Failure messages surface to Claude, which then iterates.

**Location:** `harness/checks/<name>.ts` — named by domain (e.g. `services.ts`), one or more checks per file.

**Shape:**

```ts
import { defineCheck, checkFail, checkOk, projectDir, Tools } from "agent-harness-sdk";
import { execSync } from "node:child_process";

export const validateServices = defineCheck({
  name: "validate-services",
  tools: [Tools.Edit, Tools.Write, Tools.MultiEdit],
  files: ["**/services/*.ts"],
  run: async (filePath) => {
    try {
      execSync(`npx --no-install eslint "${filePath}"`, { stdio: "pipe", cwd: projectDir() });
    } catch (err) {
      const out = (err as { stdout?: Buffer }).stdout?.toString() ?? "";
      return checkFail(`validate-services failed:\n${out}`);
    }
    return checkOk();
  },
});
```

**Conventions:**

- **Checks use the same conditions as guards** — `tools`, `files`, `when`. Scope a check to the edits it cares about with `files`. (`matches` is likewise deprecated here.)
- **`run(filePath, input)` does the validation.** Can shell out (linter, test runner) or do pure JS inspection.
- **Failure messages are actionable.** Include enough context for Claude to act — not just "validation failed".
- **Don't duplicate logic with tools.** Extract a primitive function both call.

**Optional `on` field** for non-default events (default is `post-tool-use`):

```ts
defineCheck({ name: "end-of-turn-audit", on: "stop", run: async () => checkOk() })
```

Scaffold: `/harness add check <name>`.

## Authoring skills, subagents, and rules

These three primitives are markdown — Claude already knows the YAML-frontmatter format. The harness-specific conventions:

**Skills** (`.claude/skills/<name>/SKILL.md`)

- Description determines when Claude routes to the skill. Lead with *"Use for X"* and mention what to use *instead* for adjacent cases (e.g. *"For compound work, use the X-specialist agent."*) — descriptions that name boundaries route more accurately.
- Body should be thin: reference tools by name, link to relevant rules, don't restate harness conventions.
- Single-shot procedures only. For multi-step compound work, use a subagent.

**Subagents** (`.claude/agents/<name>.md`)

- Description should describe *compound* or *autonomous* work. Mention what skill to use instead for one-shot tasks.
- `tools:` allowlist should be the minimum the agent needs.
- Body should be thin: scope, available skills, feedback loop, constraints. No restating of conventions in this file.
- If pairing with a skill, make their descriptions name each other as the boundary.

**Project rules** (`.claude/rules/<name>.md`)

- Auto-loaded into every Claude conversation. Pay token cost wisely.
- Reference directories, not specific files. *"Hooks live under `harness/hooks/`"* ages better than enumerating filenames.
- Don't duplicate tool descriptions or skill bodies.
