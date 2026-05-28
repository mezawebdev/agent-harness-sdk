# Guards

**A guard is a pre-action policy.** It inspects what the agent is about to do —
the tool name and its input — and either allows or denies. A denied call never
runs, and Claude sees the reason. See [How it works](/concepts/how-it-works)
for where guards sit in the agentic loop.

## When to author one

Write a guard for things that are **costly if they slip through even once**:
irreversible damage, secret leaks, scope violations. If a mistake is cheap to fix
on the next turn, prefer a [check](/guides/checks) instead.

## Minimal example

```ts
// harness/guards/protect-env-files.ts
import { defineGuard, guardAllow, guardDeny, Tools } from "agent-harness-sdk";

export const protectEnvFiles = defineGuard({
  name: "protect-env-files",
  tools: [Tools.Edit, Tools.Write, Tools.MultiEdit],
  files: ["**/.env", "**/.env.*"],
  run: async (input) => {
    const file = input.tool_input?.file_path ?? "";
    return guardDeny(
      `protect-env-files: ${file} is protected. .env files should not be modified by automation — ask the user to edit manually.`,
    );
  },
});
```

Register it in `harness/harness.config.ts` under `guards: [...]`.

## Activation conditions

Conditions decide *when* the guard runs — a coarse filter so `run` only fires on
relevant calls. All provided fields must pass (**AND**); within an array, any
member matches (**OR**). Omit them all to run on every tool call.

| Field | Matches when |
|---|---|
| `tools` | the call is one of these tool names. Use the `Tools` const (`Tools.Edit`) for built-ins; raw strings like `"mcp__server__tool"` also work. |
| `files` | `tool_input.file_path` matches one of these globs (picomatch). A call with no file path (e.g. Bash) never matches. |
| `when` | your custom `(input) => boolean` predicate — the escape hatch. |

Put dynamic logic (reading a file, querying state) in `run`, which is async.

## The contract

| Helper | Produces |
|---|---|
| `guardAllow()` | let the call proceed |
| `guardDeny(reason)` | block it; `reason` is shown to Claude verbatim |

- **Prefix the reason with the guard name** and make it actionable — tell Claude
  what to do instead ("ask the user to do this manually").
- **Don't over-enforce.** Every false positive blocks legitimate work.

