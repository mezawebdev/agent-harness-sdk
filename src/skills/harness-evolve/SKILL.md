---
name: harness-evolve
description: Use when the user wants to evolve their harness — survey the codebase + harness for patterns that should be enforced (additive), dead components to remove (subtractive), inconsistencies to fix (drift), or architectural smells worth a human look (investigate). Read-only analysis followed by tiered proposals. Delegates actual changes to the harness-author-* skills. Loop-friendly — caches findings so repeated runs surface only what's new.
---

<!-- managed by agent-harness-sdk — local edits will be skipped on `harness update` -->

# harness-evolve

A meta-skill that surveys the harness against the codebase, then proposes changes. Acts as a coordinator over the `harness-author-*` skills — this one *decides what should change*; they handle the *how*.

This skill is **read-only**. It produces a tiered report, then asks the user which proposals to act on. Only after explicit user approval does it delegate to the author skills.

Designed to run on demand or on a loop. Findings are tiered by confidence; loop runs surface only what's new since the last sweep.

## Four modes

Run all four by default. Skip a mode only if the caller scoped the run (`/harness evolve drift`).

### 1. Additive — find patterns to enforce

The harness should encode the project's *actual* conventions. Look for repeating structure that isn't yet gated:

**Code organization**
- **Layering** — map the dependency graph between top-level dirs (`services/`, `app/`, `lib/`, `components/`, etc.). Inversions (`lib/` importing from `services/`, `components/` importing from `app/api/`) are strong guard candidates.
- **Naming ↔ export correspondence** — does a directory's filename predict its export name? (e.g. `services/cms-service.ts` exports `CmsService`.) If most files obey it, the holdouts are a check candidate.
- **Co-location** — files that imply a sibling (`route.ts` ↔ `route.test.ts`, components ↔ stories, services ↔ contract tests). Missing siblings = coverage gap.
- **Module boundaries** — files in `__tests__/`, `_internal/`, or similar dirs that get imported from outside their boundary.

**Domain shape**
- Within a directory of N similar files, find the **dominant** pattern: export style (default vs named), constructor signature, error-handling shape (throw vs return envelope), async style, config plumbing. Holdouts are migration candidates.
- *"5 of 7 services accept `{ logger }`; 2 take positional args"* is a half-migration begging to be a check.

**Cross-cutting**
- **Repeated string literals** — the same magic string across N files is usually a constant waiting to be extracted (route paths, env var names, error codes, URLs).
- **Repeated import topology** — all files in a directory pulling from the same module = that module is a contract boundary worth enforcing.
- **Repeated try/catch shapes** — N files wrapping a call in identical error handling = candidate for a shared helper, and a check that forbids the raw call.

For each candidate, cross-check `harness/harness.config.ts`: is there already a check/guard/eslint rule that covers it? If not, propose creation.

### 2. Subtractive — find dead or cold harness code

**Dead** (strong removal candidates)
- Component hasn't fired in the audit log. Call `harness_status` first — its `byEvent` aggregates tell you which guards/checks/tools have actually been used. Zero `pre-tool-use.denied` against a guard's name in 30 days is a strong signal.
- `matches()` can't return true against any file currently in the tree.
- A tool whose name appears in zero skill / subagent / rule prompts.
- References files/dirs that no longer exist.

**Cold** (review, not auto-delete)
- File hasn't been touched in months *and* is large — likely accumulated cruft.
- Orphaned exports — symbols exported but no internal importers.
- Custom eslint rule that fires on zero files in the current codebase.

If the audit log is empty (fresh project), fall back to static analysis and **ask** rather than guess.

### 3. Drift — find inconsistencies

- A registered `check` matches a path pattern but no files match that pattern in the codebase.
- A skill or subagent references a tool/skill by name that doesn't exist.
- A subagent's `tools:` allowlist names tools not in `harness.config.ts`.
- `.claude/rules/harness.md` references primitives that don't appear in the project.
- **Two competing patterns coexist** — a stalled migration where neither pattern won. Surface both with file counts so the user picks.
- Version mismatch between `.harness/installed.json` and the SDK package.

### 4. Investigate — worth a human look (no auto-action)

Findings where the right fix isn't a guard/check/tool, but a human should see them:

- **Complexity hot spots** — files past a size threshold (default: > 400 lines), or functions past a line count.
- **Naming inconsistencies not unanimous enough to enforce** — 4/9 services use `XService`, 3 use `XServiceImpl`, 2 use `XManager`. Don't enforce; flag.
- **Magic constants** — same numeric/string literal in 3+ places that doesn't look like coincidence.
- **Asymmetric harness coverage** — some directories heavily gated (multiple checks, a guard, custom eslint), others bare. May be intentional; may be a blind spot.
- **Recent churn without test changes** — files modified in the last week without corresponding test edits.

## Confidence tiers

Tier every finding:

- **High** — clear-cut. Unanimous pattern + obvious holdout, broken reference, registered-but-never-matches.
- **Medium** — strong pattern but not unanimous (e.g. 4/5). Worth proposing; needs human judgment.
- **Speculative** — interesting but not necessarily actionable. Mostly lives in Investigate.

On a loop run, default to High only. Surface Medium and Speculative when the caller asks (`/harness evolve --all`) or when the count of new High findings is zero (don't waste a run on silence).

## Procedure

1. **Inventory the harness.** Read `harness/harness.config.ts`; list every registered tool, guard, check (with `matches` signature when readable). List skills in `.claude/skills/`, subagents in `.claude/agents/`, rules in `.claude/rules/`.
2. **Survey the codebase.** Use Glob/Grep to enumerate filename patterns, dominant export shapes, import topology. Skip `node_modules/`, `.next/`, `dist/`, `build/`, `harness/` itself, and any path in `.gitignore`.
3. **Build the findings list.** Run the four modes. For each finding, assign a **stable fingerprint** — derived from mode + category + a key the finding owns (file path, primitive name, pattern label). Same finding next run → same fingerprint. Keep them human-readable: `additive:layering:lib-to-services`, `subtractive:dead-tool:legacy_db_query`, etc.
4. **Record the run.** Call the `evolve_record_run` tool with the findings array. It persists to `.harness/evolve.json`, filters out previously-dismissed fingerprints, and returns deltas:
   - `new` — first time seen
   - `recurring` — seen in prior run too (with `daysActive` so you can say "active for 4 days")
   - `resolved` — was in prior run, gone now
   - `filteredByDismissed` — surfaced this run but dismissed previously (don't include in the report)
5. **Render the report** using the tool's response. Use the categorization to label each finding `[NEW]`, `[RECURRING]`, `[RESOLVED]`.
6. **Ask the user** which proposals to act on. Do not execute anything without explicit confirmation.
7. **Capture dismissals.** When the user waves off a finding ("not interested", "intentional", "won't fix"), call `evolve_dismiss_finding` with the fingerprint and a short reason. It's removed from the active list immediately.
8. **Delegate** chosen actions:
   - Adding a check → invoke `harness-author-check`
   - Adding a guard → invoke `harness-author-guard`
   - Adding a tool → invoke `harness-author-tool`
   - Removing a component → edit `harness/harness.config.ts` to drop the import + array entry; delete the file under `harness/<type>/<name>.ts`
   - Renaming/moving → use the appropriate author skill plus targeted edits

## Report format

```
## Harness evolution report (4 new · 2 recurring · last run 2026-05-09)

### Additive (2 high · 1 medium)

[HIGH] [NEW] Layering: lib/db.ts imports from services/cms-service.ts
  Inversion. Library layer importing from domain layer.
  Action: harness-author-guard → name: enforce-lib-no-services-imports

[HIGH] [RECURRING] Naming: 6 of 7 services/*.ts export ClassNameService; billing-service.ts exports BillingManager
  Action: standardize on *Service or add an explicit exception. Human decision.

[MEDIUM] [NEW] Co-location: 4 of 5 app/api/*/route.ts have a sibling route.test.ts; payments/ does not
  Action: add a check that flags missing test siblings, OR add the missing test. Human decision.

### Subtractive (1 high)

[HIGH] [NEW] Tool `legacy_db_query` is registered but no skill/subagent references it. Audit log shows 0 calls in 30 days.
  Action: confirm with user; if dead, drop registration + delete file.

### Drift (1 high · 1 medium)

[HIGH] [NEW] Skill `manage-payments` references tool `process_refund` (not in harness.config.ts)
  Action: either add the tool or fix the skill.

[MEDIUM] [RECURRING] Check `validate-services` matches `/services/__tests__/` but no tests exist there yet
  Action: tighten the regex or add the missing tests.

### Investigate (3 speculative)

services/billing-service.ts is 612 lines (next-largest service is 180). Consider splitting.
String "https://api.example.com" appears in 4 files; candidate for a constant.
services/ has 3 layers of gating (check + guard + eslint). components/ has none. Intentional?

—
2 high · 2 medium · 3 speculative · 2 recurring · 1 resolved since last run
Reply with finding IDs to apply, or "dismiss <id> <reason>" to silence.
```

## Loop mode

When run on a loop (e.g. `/loop 1h /harness evolve`):

- **Surface deltas, not the full backlog.** Body of the report = `new` + `resolved`; `recurring` collapses to a one-line summary unless the caller asks for the full list.
- **Honor dismissals.** Findings the user has dismissed don't surface again until the underlying conditions change (the fingerprint stays the same, so detection is automatic).
- **Bail out cleanly on silence.** If there are zero new High findings, optionally promote Medium/Speculative for one run; otherwise report "no new findings" and exit.
- **Never auto-apply.** Even in a loop, all actions require explicit user approval. The loop keeps the radar warm; it doesn't fly the plane.

## Constraints

- **Read-only by default.** Never modify project files until the user picks proposals. The one exception is `.harness/evolve.json` — managed through `evolve_record_run` and `evolve_dismiss_finding`, never by hand.
- **Fingerprints must be stable.** If you compute a different fingerprint for the same conceptual finding on the next run, every recurring finding will look `new` and dismissals will leak. Derive them mechanically.
- **Don't over-propose.** Apply judgment — would *you* enforce this on a real codebase? A pattern of 2 files isn't worth a check.
- **Tier honestly.** Speculative ≠ actionable. Don't dress up weak findings as High.
- **Surface uncertainty.** If unsure whether something is dead, say so and ask. Don't guess.
- **Never bypass other skills.** Use `harness-author-tool/guard/check` to add primitives; don't write the file yourself.
- **Honor `.claude/rules/harness.md`.** All proposals must be consistent with the project's stated conventions.
