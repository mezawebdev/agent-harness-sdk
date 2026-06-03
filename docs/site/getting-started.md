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

From inside Claude Code (the harness must be [unlocked](#unlock-the-harness) first),
describe the guard, check, or tool you want in natural language:

```
/harness add guard to block imports from internal/ outside its module
/harness add check that changed components have a test
/harness add tool to run typecheck and return the errors
```

The agent names it, scaffolds a typed stub in the right directory, registers it in
`harness/harness.config.ts`, and works with you to write the guard, check, or tool —
asking for specifics if your description needs them.

When you're done working on the harness, re-lock it with `npx harness security 1`.
See [Security](/guides/security) to learn more.
