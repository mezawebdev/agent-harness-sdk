<!-- managed by agent-harness-sdk — local edits will be skipped on `harness update` -->

# Harness conventions

Project-wide conventions for working with the tools, guards, and checks defined under `harness/`. These apply to every skill, agent, and direct tool use in this project.

## Tool result envelope

Every MCP tool returns the same shape:

- Success: `{ ok: true, data: <payload> }`
- Failure: `{ ok: false, error: <string> }`

Read the JSON envelope to decide outcome. Don't paraphrase. Failure `error` strings are pre-formatted — surface them verbatim to the caller.

## Hook feedback

The harness runs **guards** before tool calls and **checks** after them. Both are registered in `harness/harness.config.ts`:

- **Guards** (pre-action) may block a tool call before it runs. Stderr explains why; act on it.
- **Checks** (post-action) run after Edit/Write/MultiEdit. If non-zero, stderr is actionable feedback — fix the file, not the tooling.

Trust the hook result. Do not re-run lint/test commands after a green hook. To see what's enforced for this project, read `harness/harness.config.ts`.

## Trust boundaries

Do not edit the harness to silence failures:

- `.claude/` (settings, agents, skills, rules)
- `harness/` (config, guards, checks, tools, rules)
- `eslint.config.ts`, `vitest.config.ts`
- Contract tests under `**/__tests__/`

If a tool keeps failing, report it — do not bypass.

## Authoring skills, subagents, and rules

These three primitives are markdown — Claude already knows the YAML-frontmatter format. The harness-specific conventions:

**Skills** (`.claude/skills/<name>/SKILL.md`)

- Description determines when Claude routes to the skill. Lead with *"Use for X"* and mention what to use *instead* for adjacent cases (e.g. *"For compound work, use the X-specialist agent."*) — descriptions that name boundaries route more accurately.
- Body should be thin: reference tools by name, link to relevant rules, don't restate harness conventions.
- Single-shot procedures only. For multi-step compound work, use a subagent.

**Subagents** (`.claude/agents/<name>.md`)

- Description should describe *compound* or *autonomous* work. Mention what skill to use instead for one-shot tasks.
- `tools:` allowlist should be the minimum the agent needs.
- Body should be thin: scope, available skills, feedback loop, constraints. No restating of conventions in this file.
- If pairing with a skill, make their descriptions name each other as the boundary (skill says *"for compound, use the agent"*; agent says *"for single-shot, use the skill"*).

**Project rules** (`.claude/rules/<name>.md`)

- Auto-loaded into every Claude conversation. Pay token cost wisely.
- Reference directories, not specific files. *"Hooks live under `harness/hooks/`"* ages better than enumerating filenames.
- Don't duplicate tool descriptions or skill bodies.
