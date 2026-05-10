---
description: Invoke the agent-harness-sdk CLI - init, update, or add <type> <name>
---

<!-- managed by agent-harness-sdk — local edits will be skipped on `harness update` -->

The user invoked `/harness $ARGUMENTS`.

Run the corresponding CLI command via Bash from the project root:

```
npx --no-install harness $ARGUMENTS
```

## After the command runs

- Surface the meaningful output (file paths created, registration confirmations, errors).
- Do **not** paste the full CLI output unless the command failed or there's structured detail worth showing.
- For `add` commands: after the file is written, open it (Read) and offer to help fill in the TODOs. Do not start implementing without confirmation.
- For `init` and `update`: summarize what was created/synced in 1–2 sentences. If `init` reports it would overwrite existing files, stop and surface that to the user.

## Subcommands

| Command | What it does |
|---|---|
| `/harness init` | Bootstrap a harness in this project. May prompt for overwrite if files exist. |
| `/harness update` | Update library skills + rules + commands from agent-harness-sdk (preserves local edits via manifest). |
| `/harness add <type> <name>` | Scaffold a new primitive. Types: `tool`, `guard`, `check`, `skill`, `subagent`, `rule`. Names must be kebab-case. |

## Constraints

- **Do not bypass the CLI** by writing files yourself. The CLI handles registration, the manifest, and naming conventions correctly. If the CLI errors, report it — don't work around it.
- **Do not implement** a newly-scaffolded primitive without confirming with the user first.
- If the user types `/harness` with no args, run `npx --no-install harness --help` and surface the output.
