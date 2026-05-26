# Testing conventions

## Testing guards and checks

Use the `agent-harness-sdk/testing` helpers to test a primitive's observable
behavior — never hand-build `HookInput` objects or call `shouldRun` directly
(that couples tests to framework internals).

- **Build inputs with the payload builders** — `writeTool`, `editTool`,
  `multiEditTool`, `bashTool`, or the generic `tool(name, input)`.
- **Run with `runGuard` / `runCheck`.** They run the real pipeline (conditions +
  `run()`) and return an ergonomic result:
  - `runGuard` → `{ active, denied, reason }`
  - `runCheck` → `{ active, failed, message }`
- **Assert behavior, not internals.** Check `denied`/`failed` and the
  message for what your `run()` decides; assert `active` only when scope itself
  is the point. Don't assert the declarative `tools`/`files` — they're config
  the framework already evaluates.
- **For guards/checks that read project files** (via `projectDir()`), pass
  `{ projectDir }` as the third arg to point them at a fixture — don't set
  `process.env.CLAUDE_PROJECT_DIR` yourself.

```ts
import { runGuard, writeTool } from "agent-harness-sdk/testing";

const result = await runGuard(myGuard, writeTool("/repo/.env"));
expect(result.denied).toBe(true);
expect(result.reason).toContain("my-guard");
```

Reference: `src/guards/tests/protect-env-files.test.ts`.
