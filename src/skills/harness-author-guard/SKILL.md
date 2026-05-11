---
name: harness-author-guard
description: Use when the user wants to add a PreToolUse guard — a pre-action filter that can block tool calls before they run. Examples - block edits to .env files, deny rm -rf commands, prevent pushes to main. For post-action validation, use harness-author-check instead.
---

<!-- managed by agent-harness-sdk — local edits will be skipped on `harness update` -->

# harness-author-guard

A **guard** is a pre-action policy. It inspects what Claude is about to do (tool name + tool input) and either allows or denies it. If a guard denies, the tool never runs and Claude sees the reason.

Guards exist to prevent damage that's expensive or impossible to undo. If you can detect the issue *after* the action, prefer a check.

## File location

`harness/guards/<name>.ts` — one guard per file, named export.

## Shape

```ts
import { defineGuard, guardAllow, guardDeny } from "agent-harness-sdk";

export const myGuard = defineGuard({
  name: "my-guard",
  matches: (input) => {
    // Return true ONLY for tool calls this guard cares about.
    // Keep this fast — it runs on every tool call.
    return input.tool_name === "Bash";
  },
  run: async (input) => {
    const command = (input.tool_input as { command?: string })?.command ?? "";
    if (command.includes("rm -rf")) {
      return guardDeny("rm -rf is blocked by my-guard");
    }
    return guardAllow();
  },
});
```

## Result helpers

Use the factories instead of writing the result object inline:

- `guardAllow()` → `{ allow: true }`
- `guardDeny(reason)` → `{ allow: false, reason }`

Reason strings are surfaced verbatim to Claude. Prefix with the guard name so the failure is traceable.

## Registration

```ts
import { myGuard } from "./guards/my-guard.js";

export default defineHarness({
  // ...
  guards: [
    // existing guards
    myGuard,
  ],
});
```

## When to write a guard vs. a check

- **Guard** — irreversible damage, secret leaks, harness self-disable, scope violations. The cost of one slip-through is high.
- **Check** — anything you can fix on the next iteration. Validation, drift, contract violations.

## Conventions

- **`matches()` is a fast filter.** Don't do work in matches; only `tool_name`/path checks.
- **`run()` is async and may do real work** (read a file, query state).
- **Reason strings are surfaced verbatim** to Claude. Be specific about what's blocked and why.
- **Don't over-enforce.** Every false positive blocks legitimate work. Only guard what genuinely matters.

## Quality checklist

- Tested with a real-world example payload (HookInput shape)
- `matches()` returns false fast for irrelevant tools
- Error messages tell the agent how to recover (e.g. "ask the user to do this manually")
- Guard doesn't depend on session state — same input → same decision
