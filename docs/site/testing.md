# Testing

Test a primitive's **observable behavior** — never hand-build `HookInput` objects
or call internal matching directly (that couples tests to framework internals).
The `agent-harness-sdk/testing` entry point gives you payload builders and runners
that exercise the *real* pipeline (conditions + `run()`).

```ts
import { runGuard, writeTool } from "agent-harness-sdk/testing";
```

## Build inputs with payload builders

Each builder returns the `HookInput` a tool call would send to a hook:

| Builder | Tool call |
|---|---|
| `writeTool(file, content?)` | a `Write` against `file` |
| `editTool(file)` | an `Edit` against `file` |
| `multiEditTool(file)` | a `MultiEdit` against `file` |
| `bashTool(command)` | a `Bash` running `command` |
| `tool(name, input?)` | any tool — the escape hatch |

## Run with `runGuard` / `runCheck`

They evaluate the primitive's conditions and, if active, run it — returning an
ergonomic result instead of a raw union:

```ts
import { describe, it, expect } from "vitest";
import { runGuard, writeTool, bashTool } from "agent-harness-sdk/testing";
import { protectEnvFiles } from "../guards/protect-env-files";

describe("protect-env-files", () => {
  it("denies writes to .env", async () => {
    const result = await runGuard(protectEnvFiles, writeTool("/repo/.env"));
    expect(result.denied).toBe(true);
    expect(result.reason).toContain("protect-env-files");
  });

  it("ignores unrelated files", async () => {
    const result = await runGuard(protectEnvFiles, writeTool("/repo/app.ts"));
    expect(result.active).toBe(false);
  });
});
```

`runGuard` → `{ active, denied, reason }`. `runCheck` → `{ active, failed, message }`.

## Assert behavior, not internals

- Check `denied` / `failed` and the message for what your `run()` decides.
- Assert `active` only when scope itself is the point (e.g. "this guard ignores
  Bash calls").
- **Don't** assert the declarative `tools` / `files` config — the framework
  already evaluates those.

## Reading project files

For guards/checks that read project files via `projectDir()` (e.g. a manifest),
point them at a fixture with the `projectDir` option — don't set
`CLAUDE_PROJECT_DIR` yourself:

```ts
const result = await runCheck(myCheck, editTool("/fixture/src/a.ts"), {
  projectDir: "/fixture",
});
```

