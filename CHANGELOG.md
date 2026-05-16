# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While `0.0.x`, type-level breaking changes may land in patch releases.

## [Unreleased]

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
