# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While `0.0.x`, type-level breaking changes may land in patch releases.

## [Unreleased]

## [0.2.2] — 2026-05-28

### Added

- **Favicon** on the documentation site — the library icon now appears in the
  browser tab.

## [0.2.1] — 2026-05-28

### Added

- **`/harness health` command** — a one-shot health report covering harness
  drift, registered primitives, and recent hook activity. Ask Claude to run it
  mid-session to spot config decay.
- **`@example` JSDoc on the public API** — `defineHarness`, `defineTool`,
  `defineGuard`, `defineCheck`, and the result helpers (`toolOk`/`toolErr`,
  `guardAllow`/`guardDeny`, `checkOk`/`checkFail`) now ship usage examples in
  their TSDoc, surfacing real call-site patterns in editor tooltips.
- **Documentation website** under `/agent-harness-sdk/` — concept page with an
  agentic-loop diagram, brief guides for each primitive, copy-paste examples,
  testing + CLI guides, and a TypeDoc-generated API reference.

## [0.2.0] — 2026-05-26

### Added

- **Declarative activation conditions for guards and checks** — `tools` (tool-name
  allowlist), `files` (picomatch globs against `file_path`), and `when` (custom
  predicate). A primitive runs only when all declared conditions match, so most no
  longer need a hand-written `matches` predicate.
- **`Tools` constant and `ToolName` type** for autocompleting built-in tool names
  (`Tools.Edit`, …) in conditions, while still accepting arbitrary strings such as
  MCP tool names.
- **`agent-harness-sdk/testing` entry point** for testing guards/checks: `runGuard`
  and `runCheck` run the real conditions + `run()` pipeline and return an ergonomic
  result (with an optional `{ projectDir }`), plus payload builders `tool`,
  `writeTool`, `editTool`, `multiEditTool`, and `bashTool`.

### Deprecated

- **`matches` on guards and checks** — use `tools`/`files`/`when` instead. Now
  optional and still honored (ANDed with any conditions); to be removed in a future
  release.

## [0.1.4] — 2026-05-22

### Changed

- **Sync manifest moved from `.harness/installed.json` to `harness/harness.lock`**
  and is now git-tracked. The previous gitignored / per-developer location meant
  teammates who cloned a project never got a manifest, so the SessionStart drift
  hook silently exited for them. Tracking the manifest in git lets new
  collaborators inherit it on clone and get drift detection from session one.
  Auto-migrates from the legacy path on first read.

## [0.1.3] — 2026-05-22

### Changed

- **Drift notice now renders as a system-style line.** Claude is instructed to
  output the drift message as a blockquote with italic + shield emoji
  (`> 🛡️ _Your harness was updated — run /harness update to get the latest changes._`),
  visually separating it from the rest of its reply.

## [0.1.2] — 2026-05-22

### Changed

- **SessionStart drift hook is now actually visible.** Previous releases wrote only
  to `additionalContext`, which enters Claude's system context but isn't rendered
  in Claude Code's chat UI — drift was effectively invisible. The hook now also
  writes a one-line stderr message (surfaced in Claude Code's hook output area)
  and rewrites the context injection as an imperative instruction telling Claude
  to surface drift to the user at the start of its next response.
- **Drift message reads as an action, not a diagnostic.** Dropped version numbers
  from the user-facing text: "Your harness was updated. Run `/harness update` to
  get the latest changes."

## [0.1.1] — 2026-05-22

### Added

- `/harness list` subcommand (alias `/harness help`) — surfaces a curated reference
  of every slash-command subcommand with example usage. Backed by `npx harness list`.
  The slash command also routes empty args and unrecognized first words to it.

## [0.1.0] — 2026-05-22

### Added

- `/harness evolve` subcommand of the unified `/harness` slash command — read-only audit
  of the codebase + harness, tiered proposals.
- SessionStart hook that surfaces a managed-content drift warning when the installed
  manifest version doesn't match the SDK. Both Claude and the user see the notice on the
  next session, with a pointer to run `npx harness update`.
- Project `.env` loading at hook and MCP startup. `HARNESS_LOG_DISABLED` and
  `HARNESS_LOG_PATH` now work from a project `.env` file in addition to the shell env.
- `dotenv` as a runtime dependency.

### Changed

- **`/harness` is now the only slash-menu entry.** Three `harness-author-*` skills
  consolidated into `harness.md` rule (authoring tools/guards/checks contracts);
  `harness-evolve` skill moved inline into `/harness evolve`. Slash menu drops from
  5 entries to 1.
- **Default `harness.config.ts` template no longer imports framework MCP tools.**
  `harnessStatus`, `evolveRecordRun`, and `evolveDismissFinding` are now registered
  automatically at MCP server startup.
- **Scaffolded `harness/<type>/<name>.ts` imports no longer include `.js` extensions.**
- **README rewritten with agent-first framing.** `/harness` is the primary surface, CLI
  is the shell fallback. Dropped CLI, "What's bundled", library architecture, roadmap,
  and license sections.
- **`VERSION` constant** reads `package.json` at runtime (was hardcoded `"0.0.0"`).

### Removed

- **postinstall hook** — replaced by the SessionStart drift hook. Avoids supply-chain
  concerns, pnpm `approve-builds` friction, and the surprise side effects of writing
  files on `npm install`.
- `harnessStatus`, `evolveRecordRun`, `evolveDismissFinding` from the public package
  exports — now framework-internal.
- `harness-author-tool`, `harness-author-guard`, `harness-author-check`, `harness-evolve`
  skill files.

## [0.0.8] — 2026-05-16

### Fixed

- **`harness init` didn't create the `harness/guards/` directory.** It scaffolded
  `harness/tools/` and `harness/checks/` but skipped guards, so the first
  `harness add guard <name>` had to lazily create the parent dir. Now all three
  primitive directories are created up front and the post-init summary lists
  guards alongside tools and checks.

## [0.0.7] — 2026-05-16

### Fixed

- **`harness init` produced a `harness.config.ts` that failed to type-check.**
  `HarnessConfig.tools: Tool[]` collapsed to `Tool<{}>[]` and rejected any
  registered tool with a non-empty `inputSchema` — `Tool<Schema>` was invariant
  because `Schema` flowed into the handler's contravariant argument position.
  As a result the bundled `evolveRecordRun` and `evolveDismissFinding` (and any
  user-added tool with inputs) failed to compile in the scaffolded config.

- **README + `/harness` slash command listed `/harness init` as an option.**
  The slash command is itself installed by `harness init`, so it cannot exist
  before the bootstrap step runs. Removed from the in-Claude invocation
  examples and from the slash command's own subcommand table, with notes
  pointing users to `npx harness init` from the shell.

### Changed

- **`Tool` type is no longer generic** (breaking for anyone who imported
  `Tool<Schema>` directly). The schema generic now lives only on
  `defineTool`'s parameter, where it's needed for author-time handler-arg
  inference. The stored `Tool` shape uses `handler: (args: unknown) => …`,
  so a single `Tool[]` accepts every tool regardless of its inputs.

- **Tools without an `inputSchema` now have a zero-argument handler.**
  Authors no longer write an unused `args` parameter — `defineTool` types the
  handler as `() => Promise<ToolContent>` when no schema is declared, and as
  `(args: <inferred>) => Promise<ToolContent>` when one is.
