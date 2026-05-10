---
name: harness-evolve
description: Use when the user wants to evolve their harness — survey the codebase + harness for patterns that should be enforced (additive), dead components to remove (subtractive), or inconsistencies to fix (drift). Read-only analysis followed by structured proposals. Delegates actual changes to the harness-author-* skills.
---

<!-- managed by agent-harness-sdk — local edits will be skipped on `harness update` -->

# harness-evolve

A meta-skill that surveys the harness against the codebase, then proposes changes. Acts as a coordinator over the other `harness-author-*` skills — this one *decides what should change*; they handle the *how*.

This skill is **read-only**. It produces a report, then asks the user which proposals to act on. Only after explicit user approval does it delegate to the author skills.

## Three modes (run all three by default)

### 1. Additive — find patterns to enforce

Scan the codebase for structural patterns the harness doesn't yet enforce:

- **Filename patterns** — multiple files matching a convention (`*-service.ts`, `*Page.tsx`, `route.ts` under `app/api/`, etc.)
- **Repeated shapes** — files that share an export pattern (default export, named export of a class, async function with specific signature)
- **Repeated imports** — files that all pull from the same module (e.g. all `app/api/*/route.ts` import from `@/lib/db`)

For each detected pattern, cross-check against `harness/harness.config.ts`:

- Is there already a `check` whose `matches()` covers this path?
- Is there already a `guard` whose `matches()` covers this tool/path combo?
- Is there a custom eslint rule under `harness/rules/` that fits?

If a pattern has no coverage, propose creating one.

### 2. Subtractive — find dead harness code

A component is a candidate for removal if:

- It hasn't fired recently in the audit log (call the `harness_status` tool to read `.harness/log.jsonl` aggregates)
- It's registered in `harness.config.ts` but its `matches()` would never return true for current files
- It's a tool whose name doesn't appear in any skill or subagent prompt
- It references files/dirs that no longer exist

Call `harness_status` first — its `byEvent` count tells you which guards/checks/tools have actually been used. A guard registered but with zero `pre-tool-use.denied` entries against its name in 30 days is a strong removal candidate. If the audit log is empty (fresh project), fall back to static analysis and **ask the user** rather than guess.

### 3. Drift — find inconsistencies

- A registered `check` matches a path pattern but no files match that pattern in the codebase
- A skill references a tool by name that's not in `harness.config.ts`
- A subagent's `tools:` allowlist names tools that don't exist
- The harness conventions in `.claude/rules/harness.md` reference primitives that don't appear in the project

## Procedure

1. **Inventory the harness.** Read `harness/harness.config.ts` and list every registered tool, guard, and check (name + matches signature where possible). Also list any skills under `.claude/skills/` and subagents under `.claude/agents/`.
2. **Survey the codebase.** Use Glob/Grep to enumerate filename patterns, repeated import shapes, and obvious conventions. Skip `node_modules/`, `.next/`, `harness/` itself.
3. **Run the three modes.** For each, build a structured list of findings.
4. **Render the report** in the format below.
5. **Ask the user** which proposals to act on. Do not execute anything without explicit confirmation.
6. **Delegate** chosen actions:
   - Adding a new check → invoke `harness-author-check` skill
   - Adding a new guard → invoke `harness-author-guard` skill
   - Adding a new tool → invoke `harness-author-tool` skill
   - Removing a registered component → edit `harness/harness.config.ts` to drop the import + array entry; delete the file under `harness/<type>/<name>.ts`
   - Renaming/moving → use the appropriate harness-author skill plus targeted edits

## Report format

```
## Harness evolution report

### Additive (3)

✱ Pattern: 5 files match `app/api/*/route.ts`
  Suggestion: add a check that validates each route exports an HTTP method handler.
  Action: harness-author-check → name: validate-api-routes

✱ Pattern: 4 files match `components/*-card.tsx`, all default-exporting a function
  Suggestion: add a check that validates props interface naming.
  Action: harness-author-check → name: validate-component-cards

✱ Pattern: 3 services accept `{ logger }` in constructor; 2 don't
  Suggestion: this looks like a half-finished migration. Standardize.
  Action: human decision needed

### Subtractive (1)

✱ Tool `legacy_db_query` is registered but no skill/subagent references it
  Action: confirm with user; if dead, drop from harness.config.ts and delete file

### Drift (2)

✱ Skill `manage-payments` references tool `process_refund` (not in harness.config.ts)
  Action: either add the tool or fix the skill

✱ Check `validate-services` matches `/services/__tests__/` but no tests exist there
  Action: tighten the regex or add the missing tests

—
3 additive · 1 subtractive · 2 drift · run with --apply to act on selected
```

## Constraints

- **Read-only by default.** Never modify files until the user explicitly picks proposals to apply.
- **Don't over-propose.** A pattern of 2 files probably isn't worth enforcing. Apply judgment — would *you* enforce this on a real codebase?
- **Surface uncertainty.** If you're not sure whether something is dead, say so and ask. Don't guess.
- **Never bypass other skills.** Use `harness-author-tool` to add a tool, etc. Don't write the file yourself.
- **Honor `.claude/rules/harness.md`.** All proposals must be consistent with the project's stated conventions.

