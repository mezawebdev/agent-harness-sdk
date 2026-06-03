# Security

**The harness protects its own enforcement surface from the agent.** A guard the
agent can edit isn't a guard — so by default the harness blocks the agent from
modifying `harness/**`, its unlock file `.env.agents`, and the hook wiring in
`.claude/settings.json`. How *strongly* it blocks is the security level.

::: warning Requirements
Levels 2–3 use Claude Code's OS sandbox (Seatbelt on macOS, bubblewrap on Linux)
and Unix file hardening. They have **no Windows equivalent** — the harness
targets **macOS and Linux**.
:::

## Locked by default

Out of the box (after `npx harness init`) the harness is at **Level 1** — locked.
The built-in, non-removable `protect-harness` guard denies the agent's attempts to
edit the protected surface, and the only way to unlock is a human action.

## The levels

| Level | Mechanism | Enforced by | Bypassable? |
|---|---|---|---|
| **0 — off** | nothing (`HARNESS_UNLOCK=1`) | — | n/a — fully open |
| **1 — guard** | the `protect-harness` hook, in-process | the harness (software) | yes — raw `Bash` (shell redirects, a `python`/`node` script) can still write the files |
| **2 — sandbox** | Claude Code `denyWrite` + `permissions.deny` | the OS kernel, via Claude Code | no — but only covers Bash + the Edit/Write tools |
| **3 — external** | OS file immutability, root-owned (`chmod`/`chattr`) | the OS kernel, for every process | no — root required to undo |

## What each level actually buys you

**1 over 0** — the agent can no longer edit the harness through the `Edit`/`Write`/
`MultiEdit` tools, and can't run `harness security`/`add`/`update`. It's a
**cooperative** defense: a determined agent can still write the files through raw
`Bash` (`echo`, `node -e`, a script). Good for everyday work where you trust the
agent not to actively route around the signpost.

**2 over 1** — closes the Bash hole. `denyWrite` is a **kernel wall** applied to the
Bash subprocesses Claude Code spawns; `permissions.deny` covers the Edit/Write
tools. Not bypassable from inside a prompt. Its blind spot: it only covers what
Claude Code mediates.

**3 over 2** — covers what Level 2 can't reach, because it makes the files
physically read-only at the inode rather than relying on Claude Code to enforce:

- **Host-side code** — MCP tool handlers and hook scripts run on the host, *outside*
  the Bash sandbox, and aren't gated by `permissions.deny`. At Level 2 a tool
  handler can still write the surface; at Level 3 it can't.
- **Out-of-session processes** — other agents, your own scripts, cron, a
  dependency's `postinstall`. None are under Claude Code's sandbox.
- **Independence** — a Claude Code bug or sandbox escape doesn't matter; the OS
  still refuses the write.
- **No self-uncage** — the files are owned by `root`, so a process running as your
  user (the agent) can't reverse its own cage.
- **Persistence** — immutable on disk across sessions, even when Claude Code isn't
  running.

The cost: Level 3 needs `sudo` to apply *and* undo, and makes the harness read-only
for **you** too. It's for long-running, low-touch autonomous deployments — not
interactive development.

## Which level should I use?

| You are… | Level |
|---|---|
| actively developing the harness itself (writing guards/checks) | **0** — you need `harness/` writable |
| doing everyday feature work | **1** — the default; harness protected, app code open |
| running a mostly-autonomous agent with guardrails | **2** |
| running an agent indefinitely on shared / exposed infrastructure | **3** |

## Setting the level

Changing the level is a **human-only** action — the agent is blocked from running it.
From your own terminal:

```bash
npx harness security        # report the current level
npx harness security 2      # set the level (0–3)
```

Level 2 writes the sandbox block to `settings.json`; **restart Claude Code** for it
to take effect. Level 3 prints an OS hardening recipe for you to run with `sudo`
(the harness can't apply it for you, but it verifies it afterward).

## Unlocking for harness work

When you *do* need the agent to edit the harness, drop to Level 0:

```bash
npx harness security 0
```

That sets the unlock flag **and** clears any sandbox/permission block — a full "off."
Make your changes, then re-lock with `npx harness security 1` (guard) or
`npx harness security 2` (sandbox; restart to apply).

The flag lives in `.env.agents` — the harness's own control file, separate from your
app's `.env`, gitignored, and itself protected so the agent can't unlock itself.

## Auditing

To check that the current level actually blocks writes — deterministically, then by
actively trying to break it — run the red-team audit from inside Claude Code:

```
/harness security audit
```

It probes the protected surface against a sacrificial file, judges by what actually
changed on disk, and reports whether the level is enforcing as designed.
