# Checks

**A check is a post-action validator.** It runs after a tool completes —
typically `Edit`/`Write`/`MultiEdit` — and inspects the resulting state. A
failure message surfaces to Claude, which then iterates. This is the
post-action half of the harness. See [How it works](/concepts/how-it-works)
for where checks sit in the agentic loop.

## When to author one

Write a check for anything you can **fix on the next iteration**: lint and type
errors, failing tests, naming/convention drift, contract violations. If the cost
of a single slip-through is high and irreversible, use a [guard](/guides/guards)
instead.

## Minimal example

```ts
// harness/checks/lint-edited-file.ts
import { defineCheck, checkFail, checkOk, projectDir, Tools } from "agent-harness-sdk";
import { execSync } from "node:child_process";

export const lintEditedFile = defineCheck({
  name: "lint-edited-file",
  tools: [Tools.Edit, Tools.Write, Tools.MultiEdit],
  files: ["**/*.ts", "**/*.tsx"],
  run: async (filePath) => {
    try {
      execSync(`npx --no-install eslint "${filePath}"`, {
        stdio: "pipe",
        cwd: projectDir(),
      });
    } catch (err) {
      const out = (err as { stdout?: Buffer }).stdout?.toString() ?? "";
      return checkFail(`lint-edited-file failed:\n${out}`);
    }
    return checkOk();
  },
});
```

Register it in `harness/harness.config.ts` under `checks: [...]`.

## Activation conditions

Checks use the **same conditions as guards** — `tools`, `files`, `when` (see the
[Guards guide](/guides/guards#activation-conditions)). Scope a check to the edits
it cares about with `files` so it doesn't run on unrelated calls.

`run(filePath, input)` receives the edited file path directly. It can shell out to
a linter or test runner, or do pure-JS inspection. Use `projectDir()` to resolve
paths and run commands from the project root.

## The contract

| Helper | Produces |
|---|---|
| `checkOk()` | the state is valid |
| `checkFail(message)` | report a problem; `message` is shown to Claude |

- **Failure messages must be actionable** — include enough context for Claude to
  fix it, not just "validation failed". Paste the linter/test output.

## Other events

A check fires on `post-tool-use` by default. Set `on` for end-of-turn audits:

```ts
defineCheck({ name: "end-of-turn-audit", on: "stop", run: async () => checkOk() });
```

