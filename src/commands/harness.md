---
description: Manage the agent-harness-sdk — add primitives, update, audit.
---

<!-- managed by agent-harness-sdk — local edits will be skipped on `harness update` -->

The user invoked `/harness $ARGUMENTS`.

## Routing

Inspect the first word of `$ARGUMENTS` and dispatch:

| First word | Action |
|---|---|
| `add` | Shell out to CLI (see "CLI-backed subcommands" below) |
| `update` | Shell out to CLI (see "CLI-backed subcommands" below) |
| `evolve` | Run the evolve flow (see "Harness evolve" below) |
| empty / `help` / `--help` | Run `npx --no-install harness --help` and surface the output |

If the first word is unrecognized, list the valid subcommands and stop.

## Subcommand reference

| Command | What it does |
|---|---|
| `/harness add <type> <name>` | Scaffold a new primitive. Types: `tool`, `guard`, `check`. Names must be kebab-case. |
| `/harness update` | Sync library skills, rules, and the slash command from agent-harness-sdk (preserves local edits via manifest). |
| `/harness evolve` | Read-only audit of the codebase + harness — proposes additions, removals, drift fixes, and architectural smells. Tiered by confidence. |

`init` is intentionally not routed here: this slash command is installed *by* `harness init`, so the bootstrap step must run from the shell. If the user asks for `/harness init`, tell them to run `npx harness init` from the project root instead.

## CLI-backed subcommands

For `add` and `update`, run via Bash from the project root:

```
npx --no-install harness $ARGUMENTS
```

After the command runs:
- Surface the meaningful output (file paths created, registration confirmations, errors).
- Do **not** paste the full CLI output unless the command failed or there's structured detail worth showing.
- For `add` commands: after the file is written, open it (Read) and offer to help fill in the TODOs — refer to `.claude/rules/harness.md` for the contracts each primitive must follow. Do not start implementing without confirmation.
- For `update`: summarize what was created/synced in 1–2 sentences.

## Harness evolve

When the user types `/harness evolve` (optionally followed by mode arguments like `drift`, `--all`, etc.), run a read-only audit of the codebase and harness. **Do not modify any project files until the user explicitly approves proposals.**

### Four modes

Run all four by default. Skip a mode only if the caller scoped the run (e.g. `/harness evolve drift`).

#### 1. Additive — find patterns to enforce

The harness should encode the project's *actual* conventions. Look for repeating structure that isn't yet gated:

**Code organization**
- **Layering** — map the dependency graph between top-level dirs (`services/`, `app/`, `lib/`, `components/`, etc.). Inversions (`lib/` importing from `services/`, `components/` importing from `app/api/`) are strong guard candidates.
- **Naming ↔ export correspondence** — does a directory's filename predict its export name? Holdouts are check candidates.
- **Co-location** — files that imply a sibling (`route.ts` ↔ `route.test.ts`, components ↔ stories). Missing siblings = coverage gap.
- **Module boundaries** — files in `__tests__/`, `_internal/`, etc. that get imported from outside their boundary.

**Domain shape**
- Within a directory of N similar files, find the **dominant** pattern (export style, constructor signature, error-handling shape, async style). Holdouts are migration candidates.
- *"5 of 7 services accept `{ logger }`; 2 take positional args"* is a half-migration begging to be a check.

**Cross-cutting**
- Repeated string literals across N files → candidate for a constant + a guard against the raw literal.
- Repeated import topology → that module is a contract boundary worth enforcing.
- Repeated try/catch shapes → candidate for a shared helper + a check that forbids the raw call.

For each candidate, cross-check `harness/harness.config.ts`: is there already a check/guard covering it?

#### 2. Subtractive — find dead or cold harness code

**Dead** (strong removal candidates):
- Component hasn't fired in the audit log. Call `harness_status` first — its `byEvent` aggregates tell you which guards/checks/tools have actually been used. Zero hits in 30 days is a strong signal.
- `matches()` can't return true against any file currently in the tree.
- Tool name appears in zero skill / subagent / rule prompts.
- References files/dirs that no longer exist.

**Cold** (review, not auto-delete):
- File hasn't been touched in months *and* is large — likely accumulated cruft.
- Orphaned exports — symbols exported but no internal importers.

If the audit log is empty, fall back to static analysis and **ask** rather than guess.

#### 3. Drift — find inconsistencies

- A registered check matches a path pattern but no files match in the codebase.
- A skill or subagent references a tool/skill by name that doesn't exist.
- A subagent's `tools:` allowlist names tools not in `harness.config.ts`.
- `.claude/rules/harness.md` references primitives that don't appear in the project.
- **Two competing patterns coexist** — surface both with file counts so the user picks.

#### 4. Investigate — worth a human look (no auto-action)

- **Complexity hot spots** — files past a size threshold (default: > 400 lines), or large functions.
- **Naming inconsistencies not unanimous enough to enforce** — e.g. 4/9 services use `XService`, 3 use `XServiceImpl`, 2 use `XManager`. Flag, don't enforce.
- **Magic constants** — same literal in 3+ places that doesn't look like coincidence.
- **Asymmetric harness coverage** — some directories heavily gated, others bare. May be intentional; may be a blind spot.
- **Recent churn without test changes** — files modified recently without corresponding test edits.

### Confidence tiers

- **High** — clear-cut. Unanimous pattern + obvious holdout, broken reference, registered-but-never-matches.
- **Medium** — strong pattern but not unanimous (e.g. 4/5). Worth proposing; needs human judgment.
- **Speculative** — interesting but not necessarily actionable. Mostly lives in Investigate.

On a loop run, default to High only. Surface Medium/Speculative when the caller asks (`/harness evolve --all`) or when High is empty.

### Procedure

1. **Inventory the harness.** Read `harness/harness.config.ts`; list every registered tool, guard, check (with `matches` signature when readable). List skills in `.claude/skills/`, subagents in `.claude/agents/`, rules in `.claude/rules/`.
2. **Survey the codebase.** Use Glob/Grep to enumerate filename patterns, dominant export shapes, import topology. Skip `node_modules/`, `.next/`, `dist/`, `build/`, `harness/` itself, and any path in `.gitignore`.
3. **Build the findings list.** Run the four modes. For each finding, assign a **stable fingerprint** — derived from mode + category + a key the finding owns. Same finding next run → same fingerprint. Keep them human-readable: `additive:layering:lib-to-services`, `subtractive:dead-tool:legacy_db_query`.
4. **Record the run** via the `evolve_record_run` MCP tool. It persists to `.harness/evolve.json`, filters dismissed fingerprints, and returns deltas:
   - `new` — first time seen
   - `recurring` — seen in prior run too (with `daysActive`)
   - `resolved` — was in prior run, gone now
   - `filteredByDismissed` — surfaced this run but dismissed previously (don't include in report)
5. **Render the report** using the tool's response. Label each finding `[NEW]`, `[RECURRING]`, `[RESOLVED]`.
6. **Ask the user** which proposals to act on. Do not execute without explicit confirmation.
7. **Capture dismissals.** When the user waves off a finding ("not interested", "intentional", "won't fix"), call `evolve_dismiss_finding` with the fingerprint and a short reason.
8. **Delegate** chosen actions:
   - Adding a check/guard/tool → run `/harness add <type> <name>`, then help fill in TODOs per `.claude/rules/harness.md`.
   - Removing a component → edit `harness/harness.config.ts` to drop the import + array entry; delete the file under `harness/<type>/<name>.ts`.

### Report format

```
## Harness evolution report (4 new · 2 recurring · last run 2026-05-09)

### Additive (2 high · 1 medium)

[HIGH] [NEW] Layering: lib/db.ts imports from services/cms-service.ts
  Inversion. Library layer importing from domain layer.
  Action: /harness add guard enforce-lib-no-services-imports

[HIGH] [RECURRING] Naming: 6 of 7 services/*.ts export ClassNameService; billing-service.ts exports BillingManager
  Action: standardize on *Service or add an explicit exception. Human decision.

### Subtractive (1 high)

[HIGH] [NEW] Tool `legacy_db_query` is registered but no skill/subagent references it. Audit log shows 0 calls in 30 days.
  Action: confirm with user; if dead, drop registration + delete file.

### Drift (1 high)

[HIGH] [NEW] Skill `manage-payments` references tool `process_refund` (not in harness.config.ts)
  Action: either add the tool or fix the skill.

—
2 high · 2 medium · 3 speculative · 2 recurring · 1 resolved since last run
Reply with finding IDs to apply, or "dismiss <id> <reason>" to silence.
```

### Loop mode

When run on a loop (e.g. `/loop 1h /harness evolve`):

- **Surface deltas, not the full backlog.** Body = `new` + `resolved`; `recurring` collapses to a one-line summary unless asked for the full list.
- **Honor dismissals.** Dismissed findings don't resurface until underlying conditions change.
- **Bail out cleanly on silence.** Zero new High → optionally promote Medium/Speculative for one run; otherwise report "no new findings" and exit.
- **Never auto-apply.** Even in a loop, all actions require explicit user approval.

### Evolve constraints

- **Read-only by default.** Never modify project files until the user picks proposals. The one exception is `.harness/evolve.json` — managed through `evolve_record_run` and `evolve_dismiss_finding`.
- **Fingerprints must be stable.** Derive mechanically. If you compute a different fingerprint for the same conceptual finding next run, recurring findings look new and dismissals leak.
- **Don't over-propose.** Apply judgment — would *you* enforce this on a real codebase? 2 files isn't worth a check.
- **Tier honestly.** Speculative ≠ actionable.
- **Surface uncertainty.** If unsure whether something is dead, say so and ask.
- **Honor `.claude/rules/harness.md`.** All proposals must be consistent with the project's stated conventions.

## Constraints (all subcommands)

- **Do not bypass the CLI** by writing files yourself for `add` and `update`. The CLI handles registration, the manifest, and naming conventions correctly. If the CLI errors, report it — don't work around it.
- **Do not implement** a newly-scaffolded primitive without confirming with the user first.
