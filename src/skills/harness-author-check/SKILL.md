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
import { defineCheck } from "agent-harness-sdk";
import { execSync } from "node:child_process";
import { projectDir } from "agent-harness-sdk";

const DOMAIN_PATH = /\/services\/([^/]+)\.ts$/;

export const validateServices = defineCheck({
  name: "validate-services",
  matches: (filePath) => DOMAIN_PATH.test(filePath),
  run: async (filePath) => {
    // Do the validation. Return the standard envelope.
    try {
      execSync(`npx --no-install eslint "${filePath}"`, { stdio: "pipe", cwd: projectDir() });
    } catch (err) {
      const out = (err as { stdout?: Buffer }).stdout?.toString() ?? "";
      return { ok: false, message: `validate-services failed:\n${out}` };
    }
    return { ok: true };
  },
});
```

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
