# CLI

The `harness` binary scaffolds and maintains your harness. Most commands are also
available from inside Claude Code via the `/harness` slash command.

## Commands

### `harness init`

Scaffold a fresh harness into the current project. Creates `harness/`, the
`.claude/` hooks and rules, `.mcp.json`, and the gitignored `.harness/` audit log.
Run once per project, then restart Claude Code and approve the MCP server + hooks.

```bash
npx harness init
```

### `harness add <type> <name>`

Scaffold a new primitive and register it in `harness.config.ts`. `<type>` is one
of `guard`, `check`, or `tool`; `<name>` is kebab-case.

```bash
npx harness add guard block-pushes
npx harness add check validate-routes
npx harness add tool fetch-weather
```

### `harness list`

List all `/harness` subcommands with examples.

```bash
npx harness list
```

### `harness update`

Update library-managed skills, rules, and commands from `agent-harness-sdk`,
preserving your local edits. Run after upgrading the package.

```bash
npx harness update
```

## The `/harness` slash command

Inside Claude Code, the same scaffolding is available as a slash command — this is
the recommended way to add primitives mid-session, since the new file lands typed
and pre-registered:

```
/harness add guard block-pushes
/harness add check validate-routes
/harness add tool fetch-weather
```
