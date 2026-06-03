<p align="center">
  <img src="./assets/agent-harness-sdk-icon.svg" alt="agent-harness-sdk" width="120" />
</p>

<h1 align="center">Agent Harness SDK</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/agent-harness-sdk"><img src="https://img.shields.io/npm/v/agent-harness-sdk.svg" alt="npm version" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/agent-harness-sdk.svg" alt="license" /></a>
  <a href="./dist"><img src="https://img.shields.io/npm/types/agent-harness-sdk.svg" alt="types" /></a>
  <a href="https://mezawebdev.github.io/agent-harness-sdk"><img src="https://img.shields.io/badge/docs-online-blue.svg" alt="docs" /></a>
</p>

**Wrap Claude Code in a deterministic shell.**

Pre-action guards, post-action checks, and agent tools — declared in TypeScript, enforced by hooks, observable by default.

📚 **[Read the documentation →](https://mezawebdev.github.io/agent-harness-sdk)**

---

## What this library gives you

The three core harness primitives — **guards** (what it can't do), **checks** (what it must verify), **tools** (what the agent can call) — written in TypeScript and wired into Claude Code's hooks.

New to harness engineering? See [Anthropic](https://www.anthropic.com/engineering/harness-design-long-running-apps) or [Fowler](https://martinfowler.com/articles/harness-engineering.html).

---

## Quick start

```bash
npm install -D agent-harness-sdk
npx harness init
```

Restart Claude Code from the project directory. You now have:

```
my-project/
├── harness/
│   ├── harness.config.ts        ← declarative config: which guards/checks/tools are active
│   ├── harness.lock             ← synced-content manifest (git-tracked; updated by /harness update)
│   ├── guards/                  ← PreToolUse filters
│   ├── checks/                  ← PostToolUse validators
│   └── tools/                   ← MCP tools the agent can call
├── .claude/
│   ├── settings.json            ← PreToolUse + PostToolUse + SessionStart hooks
│   ├── rules/harness.md         ← universal conventions + authoring contracts (synced)
│   └── commands/harness.md      ← /harness slash command (synced)
├── .mcp.json                    ← MCP server registration
└── .harness/                    ← gitignored audit log + evolve state
```

Scaffold a harness primitive — from inside Claude Code, describe what you want in plain language:

```
/harness add guard to block imports from internal/ outside its module
/harness add check that changed components have a test
/harness add tool to run typecheck and return the errors
```

The agent names it, scaffolds the typed stub via the CLI, registers it in `harness.config.ts`, and writes a first implementation with you — asking for specifics if your description needs them.

Audit the harness:

```
/harness evolve
```

Audits your codebase and harness side by side. Surfaces tiered suggestions: patterns worth enforcing, dead components to remove, drift to fix, and architectural smells worth a human look. Read-only — nothing scaffolds without your approval.

---

## Three harness primitives

The harness manages three primitives directly — declared in `harness.config.ts`, enforced at runtime by hooks and the MCP server:

| Primitive | What it is                                                    | Where it lives             | Enforced by                    |
| --------- | ------------------------------------------------------------- | -------------------------- | ------------------------------ |
| Guard     | Pre-action filter — vetoes a tool call before it runs         | `harness/guards/<name>.ts` | PreToolUse hook                |
| Check     | Post-action validator — fails with feedback after a tool runs | `harness/checks/<name>.ts` | PostToolUse hook               |
| Tool      | Deterministic MCP operation the agent calls                   | `harness/tools/<name>.ts`  | MCP server (auto-instrumented) |

All registered in one place — `harness/harness.config.ts`:

```ts
import { defineHarness, protectEnvFiles } from "agent-harness-sdk";
import { myGuard } from "./guards/my-guard";
import { myCheck } from "./checks/my-check";
import myTool from "./tools/my-tool";

export default defineHarness({
  guards: [protectEnvFiles, myGuard],
  checks: [myCheck],
  tools: [myTool],
});
```

---

## Security

The harness protects its own enforcement surface — `harness/`, the hook wiring, and its `.env.agents` unlock file — from the agent. A guard the agent can quietly delete isn't much of a guard, so new harnesses are **locked by default**.

When you need to work on the harness, unlock it (human-only — the agent can't change its own level):

```bash
npx harness security 0      # unlock (off)
npx harness security 1      # re-lock — the in-process guard (default)
```

Four levels trade convenience for strength: **0** off · **1** in-process guard (default) · **2** OS sandbox · **3** external file hardening. Levels **2–3** make the surface unwritable at the kernel level for long-running / autonomous agents (macOS or Linux).

See the **[Security guide](https://mezawebdev.github.io/agent-harness-sdk/guides/security)** for the full model — including `harness security audit`, a red-team check that probes whether your level is actually enforcing.

---

## Observability

Every guard fire, check run, and tool call auto-emits a JSONL line to `.harness/log.jsonl` (gitignored):

```jsonl
{
  "ts": "2026-05-10T12:34:57Z",
  "event": "pre-tool-use.denied",
  "tool_name": "Edit",
  "file_path": ".env",
  "denied": [
    {
      "name": "protect-env-files",
      "reason": "..."
    }
  ]
}
```

Ask Claude _"what has the harness been doing this week?"_ — it'll call the bundled `harness_status` tool to aggregate the log.

Env vars (shell or `.env`):

- `HARNESS_LOG_DISABLED=1` — turn off logging
- `HARNESS_LOG_PATH=/custom/path` — redirect output
