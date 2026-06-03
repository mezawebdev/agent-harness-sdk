<img src="/agent-harness-sdk-icon.svg" alt="Agent Harness SDK" width="72" height="72" style="margin-bottom: 1rem;" />

# Agent Harness SDK

**Agent Harness SDK** wraps Claude Code in a deterministic shell — three
TypeScript primitives, enforced by Claude Code's hooks:

- **Guards** — pre-action policies. Block bad calls before they run.
- **Checks** — post-action validators. Catch problems and feed them back.
- **Tools** — deterministic MCP operations. Replace error-prone prose steps.

See [How it works](/concepts/how-it-works) for the agentic-loop walkthrough.

## Getting Started

### Install

```bash
npm install -D agent-harness-sdk
npx harness init
```

Restart Claude Code. You will now have a `harness/` directory, hooks registered
under `.claude/`, and the harness server merged into `.mcp.json`.

### Unlock the harness

The harness is **locked by default** — it protects its own files (`harness/`, the
hook wiring) from the agent, so the agent can't edit or scaffold harness primitives
until you unlock it:

```bash
npx harness security 0
```

### Scaffold a primitive

From inside Claude Code (the harness must be [unlocked](#unlock-the-harness) first):

```
/harness add guard block-pushes
/harness add check validate-routes
/harness add tool fetch-weather
```

Each command writes a typed stub into the right directory and registers it in
`harness/harness.config.ts`. Fill in the `run`/`handler` body and you're done.

When you're done working on the harness, re-lock it with `npx harness security 1`.
See [Security](/guides/security) to learn more.

