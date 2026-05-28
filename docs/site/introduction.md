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
npm install agent-harness-sdk
npx harness init
```

Restart Claude Code and approve the MCP server and hooks when prompted. `init`
creates a `harness/` directory, registers hooks under `.claude/`, and adds an
`.mcp.json`.

### Scaffold a primitive

From inside Claude Code:

```
/harness add guard block-pushes
/harness add check validate-routes
/harness add tool fetch-weather
```

Each command writes a typed stub into the right directory and registers it in
`harness/harness.config.ts`. Fill in the `run`/`handler` body and you're done.

