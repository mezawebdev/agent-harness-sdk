# agent-harness-sdk

A framework for building **agent harnesses** on Claude Code — typed primitives, hooks, guards, checks, observability, and a CLI that scaffolds them into your project.

**Status:** pre-alpha. Architecture is stable; the public API may still evolve.

---

## What's an agent harness?

LLMs are fundamentally non-deterministic — the same prompt can produce different output, the same intent can lead to different tool calls. Production software is fundamentally deterministic — same input, same output, every time. An **agent harness** is the structure that bridges those two worlds: it preserves the LLM's strength in judgment while pushing the predictable parts down into typed code, hooks, and validators. The LLM decides what to do; the harness defines what's actually possible.

In practice, a harness defines:

- What the agent **can** do (tools)
- What it **must not** do (guards)
- What it **must verify** after acting (checks)
- What procedures it **should follow** (skills + subagents — Claude Code's primitives, not registered with the harness)
- What it **looks like to itself** (audit log + meta-skills for self-extension)

The discipline is called **harness engineering**. See [Anthropic's overview](https://www.anthropic.com/engineering/harness-design-long-running-apps) or [Martin Fowler's article](https://martinfowler.com/articles/harness-engineering.html) for the broader context. This library gives you the building blocks.

---

## Quick start

```bash
mkdir my-project && cd my-project
npm init -y
npm install agent-harness-sdk
npx harness init
```

Modern package managers (npm 7+, pnpm 8+, yarn berry) auto-install the one peer dep (`tsx`). Yarn classic users need `yarn add tsx` explicitly.

Restart Claude Code from the project directory and approve the new MCP server and hooks when prompted. You now have:

```
my-project/
├── harness/
│   └── harness.config.ts        ← declarative config: which tools/guards/checks are active
├── .claude/
│   ├── settings.json            ← PreToolUse + PostToolUse hooks
│   ├── skills/                  ← 3 author meta-skills + harness-evolve (synced)
│   ├── rules/harness.md         ← universal conventions (synced)
│   └── commands/harness.md      ← /harness slash command (synced)
├── .mcp.json                    ← MCP server registration
└── .harness/                    ← gitignored audit log + manifest
```

Add a typed primitive — from your shell:

```bash
npx harness add tool fetch-weather
npx harness add guard block-pushes
npx harness add check validate-routes
```

Or from inside Claude Code:

```
/harness add tool fetch-weather
/harness add guard block-pushes
/harness add check validate-routes
```

Each `add` scaffolds the file and auto-registers it in `harness.config.ts`. For Claude Code's own primitives (skills, subagents, rules), just ask Claude to create them — the conventions live in `harness.md`, which is auto-loaded into every conversation.

---

## Three typed primitives

The harness manages three primitives directly — declared in `harness.config.ts`, typed by the SDK, instantiated at runtime:

| Primitive | What it is                                                    | Where it lives             | Enforced by                    |
| --------- | ------------------------------------------------------------- | -------------------------- | ------------------------------ |
| Tool      | Deterministic MCP operation the agent calls                   | `harness/tools/<name>.ts`  | MCP server (auto-instrumented) |
| Guard     | Pre-action filter — vetoes a tool call before it runs         | `harness/guards/<name>.ts` | PreToolUse hook                |
| Check     | Post-action validator — fails with feedback after a tool runs | `harness/checks/<name>.ts` | PostToolUse hook               |

All registered in one place — `harness/harness.config.ts`:

```ts
import {
  defineHarness,
  harnessStatus,
  protectEnvFiles,
} from "agent-harness-sdk";
import myTool from "./tools/my-tool.js";
import { myGuard } from "./guards/my-guard.js";
import { myCheck } from "./checks/my-check.js";

export default defineHarness({
  tools: [harnessStatus, myTool],
  guards: [protectEnvFiles, myGuard],
  checks: [myCheck],
});
```

### Claude Code's own primitives

The framework intentionally doesn't scaffold **skills**, **subagents**, or **rules** — those are Claude Code's own markdown primitives, not ours. They're plain markdown files Claude already knows how to write. When you need one, just ask Claude — the conventions live in `harness.md` (auto-loaded into every conversation), so the output will follow project conventions.

---

## Authoring help (meta-skills)

The library ships four skills that teach Claude how to extend the harness. Three for the typed primitives (where Claude needs to know the SDK's contracts) and one meta-skill for harness-wide audits:

| Skill                  | When Claude activates it                           |
| ---------------------- | -------------------------------------------------- |
| `harness-author-tool`  | "add an MCP tool"                                  |
| `harness-author-guard` | "add a PreToolUse guard"                           |
| `harness-author-check` | "add a PostToolUse check"                          |
| `harness-evolve`       | "audit the harness" or "what should we add/remove" |

For skills, subagents, and rules — which are plain markdown that Claude already knows how to write — the harness-specific conventions live in `harness.md` (auto-loaded into every conversation), not in dedicated meta-skills.

Auto-installed by `harness init`, refreshed by `harness update`. Skills are synced as plain files into your `.claude/skills/` so you can read or override them; the sync command preserves local edits via a checksum manifest.

---

## Observability

Every tool call, guard fire, and check run auto-emits one JSONL line to `.harness/log.jsonl`:

```jsonl
{"ts":"2026-05-10T12:34:56Z","event":"tool.scaffold_service.invoked","tool_name":"scaffold_service","ok":true,"duration_ms":12}
{"ts":"2026-05-10T12:34:57Z","event":"pre-tool-use.denied","tool_name":"Edit","file_path":".env","denied":[{"name":"protect-env-files","reason":"..."}]}
{"ts":"2026-05-10T12:34:58Z","event":"post-tool-use.passed","tool_name":"Edit","file_path":"services/cms.ts","active":["validate-services"]}
```

The log is gitignored — per-developer scope, never committed. The bundled `harness_status` MCP tool reads + aggregates it. Ask Claude _"what has the harness been doing this week?"_ and it'll call `harness_status`.

Environment variables:

- `HARNESS_LOG_DISABLED=1` — turn off logging entirely
- `HARNESS_LOG_PATH=/custom/path` — redirect output

---

## CLI

```
harness init                    Bootstrap a fresh harness in the current project
harness update                  Update library skills + rules (preserves local edits)
harness add <type> <name>       Scaffold a new typed primitive

  Types: tool | guard | check
```

`harness update` uses a manifest at `.harness/installed.json` to track which library files were installed at which SDK version. Locally-modified files are detected via checksum and skipped on update.

**You usually don't need to run `harness update` manually** — a postinstall hook on `agent-harness-sdk` runs it automatically whenever the package is installed or updated. So `npm install agent-harness-sdk@<newer>` will refresh your library content as a side effect. The manual command exists as an explicit refresh / recovery hatch.

### Package managers

| Package manager  | Install + CLI | Auto-update on install                      |
| ---------------- | :-----------: | ------------------------------------------- |
| npm              |      ✅       | yes — postinstall runs                      |
| pnpm 9+          |      ✅       | needs one-time `pnpm approve-builds` opt-in |
| yarn classic     |      ✅       | yes — postinstall runs                      |
| yarn berry (PnP) |      ❌       | unsupported in v1                           |

Install via your PM, the `harness` bin lands in `node_modules/.bin/`, and all integration points (settings.json paths, `.mcp.json`, slash command invocation) resolve correctly. Yarn Berry's Plug'n'Play strict module resolution doesn't expose `node_modules/` and is not supported yet.

If your PM doesn't auto-install peer deps (yarn classic, some older npm versions), install `tsx` explicitly:

```bash
yarn add tsx
```

### Or: invoke from Claude

`harness init` ships a `/harness` slash command into `.claude/commands/`. After the initial bootstrap, you can drive the rest of the CLI from inside Claude Code:

```
/harness update
/harness add tool fetch-weather
/harness add guard block-pushes
```

The initial `npx harness init` has to run from your shell — the slash command itself is one of the files that step installs, so it doesn't exist yet at first-run.

---

## What's bundled

- **`protectEnvFiles`** guard — blocks `Edit`/`Write`/`MultiEdit` on any `.env*` file
- **`harnessStatus`** tool — reads + aggregates the audit log
- **4 skills** — 3 authoring meta-skills (tool/guard/check) + `harness-evolve` (codebase + harness audit)
- **`harness.md`** rule — universal conventions auto-loaded into every Claude conversation
- **`/harness` slash command** — invoke the CLI from inside a Claude conversation

---

## Library architecture

```
agent-harness-sdk/
├── src/
│   ├── index.ts                 ← public API
│   ├── types.ts                 ← Tool, Guard, Check, ToolResult, HookInput
│   ├── define.ts                ← defineHarness/Tool/Guard/Check
│   ├── hooks/
│   │   ├── utils.ts             ← readHookInput, pass, block, projectDir
│   │   ├── dispatch.ts          ← createPre/PostToolUseDispatcher
│   │   ├── pre-tool-use.ts      ← Claude Code hook entry
│   │   └── post-tool-use.ts     ← Claude Code hook entry
│   ├── mcp/
│   │   ├── server.ts            ← createMcpServer (auto-wraps handlers with logging)
│   │   └── start.ts             ← MCP server entry script
│   ├── guards/protect-env-files.ts
│   ├── tools/harness-status.ts
│   ├── observability/log.ts     ← logEvent, readLog
│   ├── skills/                  ← 4 authoring + evolve skills
│   ├── rules/harness.md
│   ├── commands/harness.md      ← /harness slash command
│   └── cli/                     ← commander entry: init/update/add
├── vite.config.ts               ← multi-entry library build
└── dist/                        ← built artifacts (ESM + .d.ts)
```

---

## What's not in v1 (yet)

- `harness doctor` — verify wiring (orphan files, broken references)
- `harness list` — inspect installed components
- Stop / SubagentStop hook entries (the `on` field on Check supports them; entry scripts not yet shipped)
- Brownfield init handling beyond the simple "overwrite?" prompt
- Test suite for the SDK itself
- Remote audit log sinks (env-var hook designed but not implemented)

---

## License

MIT (planned)
