# Declarative conditions for guards and checks

**Date:** 2026-05-26
**Status:** Approved — ready for implementation plan

## Problem

`defineGuard` and `defineCheck` use a single `matches` predicate to decide whether
the primitive is active for a given tool call:

```ts
defineGuard({
  name: "protect-managed-claude-files",
  matches: (input) => {
    if (!WRITE_TOOLS.has(input.tool_name ?? "")) return false;
    const file = input.tool_input?.file_path;
    return !!file && managedPaths(projectDir()).has(relPath(file));
  },
  async run(input) { /* deny */ },
});
```

`matches` is vague — its name says nothing about *what* it matches, and every
author re-implements the same two checks by hand (tool-name membership, file-path
matching). The common cases deserve declarative, self-documenting fields.

## Goals

- Replace the hand-rolled `matches` predicate with declarative conditions for the
  two common filters: tool name and file path.
- Keep a custom-predicate escape hatch for dynamic filters.
- Non-breaking: existing guards/checks that use `matches` keep working.
- Apply symmetrically to guards and checks (they share the shape).
- Provide importable tool-name constants so consumers don't memorize string
  literals.

## Non-goals

- Wiring up the unimplemented `stop` / `post-tool-batch` check phases. (Only
  `post-tool-use` checks dispatch today; conditions are designed not to block
  that future work, but it is out of scope here.)
- Changing `run` signatures.
- An exhaustive, version-pinned catalog of every Claude Code tool.

## Design

### 1. Shared condition fields (added to both Guard and Check)

The three new fields are identical on guards and checks:

```ts
type Conditions = {
  /** Active only for these tool names. Omit = any tool. */
  tools?: (ToolName | (string & {}))[];
  /** Active only when tool_input.file_path matches one of these globs (picomatch). Omit = any path. */
  files?: string[];
  /** Custom predicate, ANDed with the conditions above. Escape hatch for dynamic filters. */
  when?: (input: HookInput) => boolean;
};
```

`Guard` and `Check` each gain these three fields plus their existing,
now-**optional**, `matches`:

- `Guard.matches?: (input: HookInput) => boolean` — `@deprecated`
- `Check.matches?: (filePath: string, input: HookInput) => boolean` — `@deprecated`

So `matches` is the one field whose signature stays primitive-specific (it is
the existing API and must not change for back-compat). `when` is new and
deliberately uniform — `(input)` for both — since the file path is reachable at
`input.tool_input.file_path`.

- Making `matches` optional (was required) is the only change to existing
  primitives, and it is backward compatible — existing authors already supply it.
- The `(string & {})` intersection preserves `Tools.*` autocomplete while still
  accepting arbitrary strings (MCP tools like `mcp__server__do_thing`, future
  built-ins).

### 2. Activation semantics

A guard/check is **active** when *every provided* filter passes (logical AND).
Within an array, membership is OR.

| Field | Active when |
|-------|-------------|
| `tools` | `input.tool_name` ∈ `tools` |
| `files` | `input.tool_input.file_path` matches any glob (no file_path → fails) |
| `when` | `when(input) === true` |
| `matches` (deprecated) | `matches(...) === true` |
| *(none provided)* | always active — `run` decides |

A `files`-scoped guard therefore will not fire on a `Bash` call (no `file_path`),
which is the desired behavior.

### 3. Shared resolver

Activation logic lives in one place — `src/hooks/match.ts` — exporting a pure
function consumed by both `createPreToolUseDispatcher` and
`createPostToolUseDispatcher`. This keeps the two dispatchers in lockstep and
makes the logic unit-testable in isolation.

```ts
// src/hooks/match.ts — evaluates the three shared conditions only
export function conditionsActive(c: Conditions, input: HookInput): boolean;
```

`conditionsActive` evaluates `tools` / `files` / `when` (the uniform fields).
Because deprecated `matches` has a primitive-specific signature, each dispatcher
ANDs its own `matches` result with `conditionsActive(...)`:

```ts
// pre-tool-use
guards.filter((g) => conditionsActive(g, input) && (g.matches?.(input) ?? true));
// post-tool-use
checks.filter((c) => conditionsActive(c, input) && (c.matches?.(filePath, input) ?? true));
```

A missing `matches` contributes `true` (no constraint), preserving the
"no conditions → always active" rule.

### 4. Glob matching

Add **`picomatch`** (https://www.npmjs.com/package/picomatch) as a runtime
dependency. Each entry in `files` is compiled to a matcher and tested against
`input.tool_input.file_path`. Globs match against the path as Claude Code
provides it (absolute); `**/` prefixes (e.g. `**/.claude/**`) match anywhere in
the path.

### 5. `Tools` constants

Exported from the package root:

```ts
export const Tools = {
  Bash: "Bash",
  Edit: "Edit",
  Write: "Write",
  MultiEdit: "MultiEdit",
  Read: "Read",
  Glob: "Glob",
  Grep: "Grep",
  NotebookEdit: "NotebookEdit",
  WebFetch: "WebFetch",
  WebSearch: "WebSearch",
  Task: "Task",
  TodoWrite: "TodoWrite",
} as const;

export type ToolName = (typeof Tools)[keyof typeof Tools];
```

A frozen const object, **not** a TS `enum`: enums are nominal (would force the
import and reject raw strings), emit runtime code, and `const enum` is
incompatible with this project's `isolatedModules` + esbuild/vite build. The
const object gives the same `Tools.Edit` call site with none of that.

Documented as a convenience for common built-ins — not exhaustive, not
version-pinned. Anthropic ships no equivalent (verified: both `@anthropic-ai/sdk`
and `@anthropic-ai/claude-agent-sdk` use plain string literals).

### 6. Dogfood migration

Migrate both in-repo guards to the new API (removes the last `matches` usages):

- **`protectEnvFiles`** → `tools: [Tools.Edit, Tools.Write, Tools.MultiEdit]`,
  `files: ["**/.env", "**/.env.*"]`; `run` always denies.
- **`protect-managed-claude-files`** → `tools: [...]`, `files: ["**/.claude/**"]`
  as the coarse filter; `run` reads `harness.lock` and **allows** non-managed
  `.claude` files (the dynamic membership check stays in `run`, where it belongs).

## Testing

Unit tests for `isActive`:

- `tools` match / miss
- `files` glob match / miss
- missing `file_path` with a `files` condition → inactive
- `when` true / false
- deprecated `matches` still honored
- multi-condition AND (all pass / one fails)
- no conditions → always active

Behavioral tests for the two migrated guards: deny on target paths, pass on
unrelated paths (exercised through the pre-tool-use dispatcher, as today).

## Rollout / compatibility

- Additive and non-breaking. `matches` continues to work, now flagged
  `@deprecated`.
- `.claude/rules/harness.md` authoring examples for guards/checks updated to show
  `tools` / `files` / `when` (the deprecated `matches` examples removed).
- A future major release removes `matches`.
