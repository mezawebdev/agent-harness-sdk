---
description: Manage the agent-harness-sdk — add primitives, update, audit.
---

<!-- managed by agent-harness-sdk — local edits will be skipped on `harness update` -->

The user invoked `/harness $ARGUMENTS`.

## Routing

Inspect the first word of `$ARGUMENTS` and dispatch:

| First word | Action |
|---|---|
| `add` | Name, scaffold, and implement a primitive (see "Adding a primitive" below) |
| `update` | Shell out to CLI (see "Updating" below) |
| `evolve` | Run the evolve flow (see "Harness evolve" below) |
| `health` | Run the health flow (see "Harness health" below) |
| `security` | Run the security flow (see "Harness security" below) |
| `list` / `help` / `--help` / empty | Run `npx --no-install harness list` and surface the output verbatim |

If the first word is unrecognized, run `npx --no-install harness list` to show the user what's available and stop.

## Subcommand reference

| Command | What it does |
|---|---|
| `/harness add <type> <description>` | Describe a guard/check/tool in natural language (a bare kebab-case name also works); the agent names it, scaffolds it, and writes a first implementation. Types: `tool`, `guard`, `check`. |
| `/harness update` | Sync library skills, rules, and the slash command from agent-harness-sdk (preserves local edits via manifest). |
| `/harness evolve` | Read-only audit of the codebase + harness — proposes additions, removals, drift fixes, and architectural smells. Tiered by confidence. |
| `/harness health` | Validate every registered guard/check/tool. Structural soundness for all three; for guards/checks, synthesizes inputs and triggers them through the real pipeline to confirm the boundary holds. Read-only — tool handlers are never executed. |
| `/harness security` | Report the current self-protection level (0 off · 1 guard · 2 sandbox · 3 external). |
| `/harness security audit` | Red-team the harness at its current level: runs the deterministic audit, then creatively attempts to break it against a sacrificial probe. |
| `/harness security <0-3>` | Change the level. **Human-only** — must be run by the user in their own terminal. |
| `/harness list` (alias `help`) | Show this list of subcommands with examples. Backed by `npx harness list`. |

`init` is intentionally not routed here: this slash command is installed *by* `harness init`, so the bootstrap step must run from the shell. If the user asks for `/harness init`, tell them to run `npx harness init` from the project root instead.

## Adding a primitive

`/harness add <type> <description>` — `<type>` is `guard`, `check`, or `tool`; the rest
is a **natural-language description** of what you want (a bare kebab-case name also
works). This is **agent-driven** — don't pipe `$ARGUMENTS` to the CLI, because a
description isn't a valid name. The flow:

1. **Name it.** If the user gave a kebab-case name, use it. If they gave a description,
   infer a short kebab-case name (e.g. *"prevent writes inside public/"* →
   `protect-public-dir`) and confirm it with the user in one line.
2. **Scaffold.** Run the deterministic scaffolder from the project root with just the
   derived name:
   ```
   npx --no-install harness add <type> <name>
   ```
   It writes a typed stub to `harness/<type>/<name>.ts` and registers it in
   `harness/harness.config.ts`. Surface created paths / errors; don't paste full output.
3. **Implement.** Read the stub and write a **full first pass** of the `run`/`handler`
   body from the description, following the contracts in `.claude/rules/harness.md`
   (activation conditions, `guardAllow`/`guardDeny` vs `checkOk`/`checkFail`, structured
   `toolOk`/`toolErr`, actionable messages). Infer the user's intent — but if the
   description is too vague to implement correctly (ambiguous scope, missing specifics,
   unclear pass/deny criteria), **ask clarifying questions before writing.**
4. **Show your work.** Present the implementation for review and iterate with the user.

## Updating

For `/harness update`, run from the project root:

```
npx --no-install harness update
```

Summarize what was synced in 1–2 sentences.

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

## Harness health

When the user types `/harness health`, validate that every registered primitive actually works. **Tool handlers are NEVER executed** — tools are validated structurally only, and the report must say so explicitly.

### Procedure

1. **Run the structural pass.** From the project root:
   `npx --no-install harness health`
   Parse the JSON envelope (`{ ok, data: { primitives, drift } }`). If `ok` is false, surface the `error` verbatim and stop.

2. **Report structural failures and drift first.** For any primitive with `structural.passed: false`, surface its `issues`. For each entry in `drift.unregistered`, flag it: the file exists under `harness/` but its primitive is not in `harness.config.ts`, so it silently does nothing — tell the user to register it. Also report any entries in `unloadable` — a primitive file under `harness/` that failed to import (surface its `file` and `error`); the primitive can't run at all until it loads.

3. **Trigger each guard and check.** For every guard/check in the inventory:
   - Read its source (the file under `harness/guards/` or `harness/checks/`) to infer intent.
   - Synthesize a **positive** trigger — a `HookInput` that *should* set it off (deny / fail) — and a **negative** trigger — one that should pass.
   - Run each:
     `npx --no-install harness health trigger <guard|check> <name> --input '<hookInputJson>'`
     where the JSON is a `HookInput`, e.g. `{"tool_name":"Write","tool_input":{"file_path":"/repo/.env"}}`.
   - Judge the returned `{ type, active, denied|failed, reason|message }` against the intent. A positive trigger that returns `denied:false`/`failed:false` (or `active:false`) is a **failure** — the boundary didn't hold.
   - If you cannot confidently infer a safe input from the source, report "could not infer a safe trigger" rather than guessing.

4. **Report tools structurally only.** Show each tool's `structural` result with the explicit line: **"handler not executed — inspected only."** Never run a tool.

5. **Compose the report** using the format below. Always show the actual input(s) tried and the output(s) returned.

### Report format

```
## Harness health — N primitives (X ✓ · Y ⚠ · Z ✗)

### Guards
✓ protect-env-files
   trigger ↘ Write {file_path: "/repo/.env"}      → denied ✓ "blocked by protect-env-files"
   trigger ↗ Write {file_path: "/repo/README.md"} → allowed ✓
✗ colocate-test-files
   trigger ↘ Write {file_path: "/repo/src/foo.ts"} → allowed ✗ (expected deny — sibling test missing)

### Checks
✓ validate-services
   trigger ↘ Edit {file_path: "src/services/bad.ts"} → failed ✓ "lint error: ..."

### Tools
⚠ legacy_db_query — structural ✓ (registered, schema valid).
   Handler NOT executed — inspected only.

### Drift
⚠ harness/guards/block-pushes.ts present but not registered in harness.config.ts
```

### Constraints

- **Never execute a tool handler.** Tools are structural-only.
- **Triggers never perform the real action** — `harness health trigger` runs the guard/check in isolation via the SDK testing pipeline; no file is written, no command runs.
- **Read-only.** Health persists nothing and modifies no project files.

## Harness security

When the user types `/harness security ...`, branch on the argument after `security`:

- **no argument** → run `npx --no-install harness security` and surface the reported level verbatim.
- **`help` / `--help`** → run `npx --no-install harness security --help` and surface the output verbatim.
- **`audit`** → run the red-team flow below.
- **`0` / `1` / `2` / `3`** (a level change) → **do not run it.** Changing the level is a human-only action — the guard blocks the agent from running `harness security <n>`. Tell the user to run `npx harness security <n>` themselves in their terminal, and stop.

### `/harness security audit` — red-team the harness

Empirically check whether the current level actually blocks writes to the harness surface — first deterministically, then by *actively trying to break it*.

1. **Deterministic baseline.** From the project root, run:
   `npx --no-install harness security audit`
   It self-gates on the Claude Code session, sets up and cleans a sacrificial probe `harness/.redteam-probe`, backs up and restores real files, runs the fixed vector battery + guard-logic checks, and is the **objective judge**. Surface its report.
2. **Creative red-team.** Now actively try to defeat the *same* protections with your own ingenuity — `Edit`/`Write`/`MultiEdit`, `Bash` (`sed -i`, redirects, `tee`, interpreters like `python -c`/`node -e`, or writing then running a script), or any vector you can devise.
   - **Target ONLY `harness/.redteam-probe`** (create / modify / delete it). It sits under `harness/**`, so a successful write there is a genuine finding — but it's disposable.
   - **Never aim a live attack at real protected files** (`harness/harness.config.ts` and the rest of `harness/**`, `.env.agents`, `.claude/settings.json`). If a vector would hit a real file, *describe* it instead of running it — the deterministic CLI already probes those safely.
   - **Judge by disk, not by feel.** After any attempt that *appears* to succeed, confirm by reading `harness/.redteam-probe` (or re-running the deterministic audit). It's a breach only if the probe's bytes actually changed. Capture the tool-deny message (blocked) or the diff (breached) as evidence.
3. **Clean up.** Remove `harness/.redteam-probe` if it still exists.
4. **Report.** Per attempt: vector, tool, blocked vs breached, evidence. Then a verdict:
   - At **level 1**, raw `Bash`/process writes succeeding is **expected** — the guard protects *tool calls*, not arbitrary processes. Report it as "expected at level 1; raise to level 2 to close," not a failure.
   - At **level 2+**, any breach is a real failure — most likely a misconfig (sandbox not enabled, or `bwrap` missing on Linux). Flag it with the fix.

### Security audit constraints

- **Live creative attacks hit only `harness/.redteam-probe`.** Real protected files are off-limits to live attacks; the deterministic CLI covers those with backup/restore.
- **Objective judging.** A breach is a real, on-disk change confirmed by reading the file — never your own assertion that an attack "should have" worked.
- **Clean exit.** Remove the probe; if any real protected file looks modified, say so loudly.

## Constraints (all subcommands)

- **The CLI scaffolds; you implement.** Always create the stub + registration via `npx harness add` — never hand-write the file or edit `harness.config.ts` yourself (the CLI handles the manifest and naming conventions). Filling in the `run`/`handler` body afterward *is* your job.
- **Implement from the description, don't guess blindly.** When the description gives clear intent, write a full first pass and show it for review. When it's too vague to implement correctly, ask clarifying questions before writing — don't invent behavior the user didn't ask for.
- **If the CLI errors, report it — don't work around it.**
