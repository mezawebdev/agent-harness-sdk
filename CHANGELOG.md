# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While `0.0.x`, type-level breaking changes may land in patch releases.

## [Unreleased]

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
