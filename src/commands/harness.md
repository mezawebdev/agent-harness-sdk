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
- For `update`: summarize what was created/synced in 1–2 sentences.

## Subcommands

| Command | What it does |
|---|---|
| `/harness update` | Update library skills + rules + commands from agent-harness-sdk (preserves local edits via manifest). |
| `/harness add <type> <name>` | Scaffold a new typed primitive. Types: `tool`, `guard`, `check`. Names must be kebab-case. |

`init` is intentionally not exposed here: this slash command is installed *by* `harness init`, so the bootstrap step must be run from the shell (`npx harness init`). If the user asks for `/harness init`, tell them to run `npx harness init` from the project root instead.

## Constraints

- **Do not bypass the CLI** by writing files yourself. The CLI handles registration, the manifest, and naming conventions correctly. If the CLI errors, report it — don't work around it.
- **Do not implement** a newly-scaffolded primitive without confirming with the user first.
- If the user types `/harness` with no args, run `npx --no-install harness --help` and surface the output.
