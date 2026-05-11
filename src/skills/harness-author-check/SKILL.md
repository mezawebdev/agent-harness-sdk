---
name: harness-author-check
description: Use when the user wants to add a PostToolUse check — a post-action validator that runs after Edit/Write/MultiEdit and can block with feedback if state is invalid. Examples - validate domain contracts after a file edit, run lint on a changed dir, verify exports match conventions. For pre-action blocking, use harness-author-guard.
---

<!-- managed by agent-harness-sdk — local edits will be skipped on `harness update` -->

# harness-author-check

A **check** is a post-action validator. It runs after a tool completes (typically Edit/Write/MultiEdit) and inspects the resulting state. If something's wrong, the check returns a failure message that Claude sees and iterates on.

Checks are the feedback loop: they let the agent self-correct. They don't prevent damage; they detect it after the fact and force a fix.

## File location

`harness/checks/<name>.ts` — typically named by domain (e.g. `services.ts`), exporting one or more checks.

## Shape

```ts
import { defineCheck, checkFail, checkOk, projectDir } from "agent-harness-sdk";
import { execSync } from "node:child_process";

const DOMAIN_PATH = /\/services\/([^/]+)\.ts$/;

export const validateServices = defineCheck({
  name: "validate-services",
  matches: (filePath) => DOMAIN_PATH.test(filePath),
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

## Result helpers

Use the factories instead of writing the result object inline:

- `checkOk()` → `{ ok: true }`
- `checkFail(message)` → `{ ok: false, message }`

Failure messages are surfaced verbatim to Claude — include enough context to act on them.

## Registration

```ts
import { validateServices } from "./checks/services.js";

export default defineHarness({
  // ...
  checks: [
    // existing checks
    validateServices,
  ],
});
```

## Conventions

- **`matches(filePath, input)` is a fast filter.** Use a regex against the file path. Return false quickly for unrelated edits.
- **`run(filePath, input)` does the actual validation.** It's async; can shell out, read files, etc.
- **Failure messages are surfaced verbatim** to the agent — include enough context to act on them.
- **Don't bypass via the check itself.** If the check can't tell whether something is valid, return ok and document why.

## Common check strategies

A check is a thin envelope — the work it does inside is up to you. Three patterns cover most needs:

- **Shell out to a linter.** Run `eslint`, `biome`, `oxlint`, etc. via `execSync` and parse the output. If your project ships custom eslint rules (e.g. under `harness/eslint/` or wherever you like), this is how you enforce them. ESLint rules and similar AST plugins are *implementation details* of a check, not a harness primitive — you can use them, swap them, or skip them entirely.
- **Shell out to a test runner.** Use `vitest run path/to/affected/`, `jest`, or `tsc --noEmit` to verify the codebase still type-checks or passes contract tests after the edit. Same pattern: run, parse exit code, surface failures.
- **Pure JS inspection.** When the check is small (filename pattern, file exists, export shape), skip external tools and use Node's `fs` directly. Faster and easier to debug.

Whichever strategy you use, the contract is the same: return `checkOk()` if everything is fine, or `checkFail(message)` with an actionable failure description.

## Optional: `on` field for non-default events

Checks default to `on: "post-tool-use"`. To run at end-of-turn or after a parallel batch:

```ts
defineCheck({
  name: "end-of-turn-audit",
  on: "stop",                         // fires when Claude tries to end the turn
  matches: () => true,
  run: async () => { /* ... */ },
})
```

## Quality checklist

- `matches()` is restrictive — doesn't fire on every edit
- `run()` returns within a reasonable time (< 5s typical)
- Failure messages are actionable, not just "validation failed"
- Internal logic is shared with any related tool (don't duplicate validation between a tool and a check — extract a primitive function both call)
