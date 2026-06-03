import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { removeEnvLine, upsertEnvLine } from "../env-file";
import {
  addHarnessSandbox,
  hasHarnessSandbox,
  removeHarnessSandbox,
} from "../sandbox";
import { UNLOCK, deriveLevel } from "../levels";
import { isInsideClaudeCode, probeWriteBlocked } from "../probes";
import { runAudit } from "./audit";

const LEVELS = [0, 1, 2, 3] as const;

type Settings = Record<string, unknown>;

// ── file I/O helpers ─────────────────────────────────────────────────────────

const envPath = (cwd: string) => join(cwd, ".env.agents");
const settingsPath = (cwd: string) => join(cwd, ".claude", "settings.json");

const readEnv = (cwd: string): string =>
  existsSync(envPath(cwd)) ? readFileSync(envPath(cwd), "utf-8") : "";

function readSettings(cwd: string): Settings {
  const path = settingsPath(cwd);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Settings;
  } catch {
    return {};
  }
}

const writeSettings = (cwd: string, s: Settings) =>
  writeFileSync(settingsPath(cwd), `${JSON.stringify(s, null, 2)}\n`);

function bubblewrapMissing(): boolean {
  if (process.platform !== "linux") return false;
  try {
    execSync("command -v bwrap", { stdio: "pipe" });
    return false;
  } catch {
    return true;
  }
}

// ── command ──────────────────────────────────────────────────────────────────

export async function security(levelArg?: string): Promise<void> {
  const cwd = process.cwd();

  if (levelArg === "audit") {
    if (!isInsideClaudeCode()) {
      p.intro(pc.cyan("harness security audit"));
      p.cancel(
        "Run this inside Claude Code: /harness security audit (or ask Claude to run it). " +
          "From a plain terminal it can't exercise the live sandbox.",
      );
      process.exit(1);
    }
    process.exit(await runAudit(cwd));
  }

  p.intro(pc.cyan("harness security"));

  if (levelArg === undefined) {
    const level = deriveLevel({ env: readEnv(cwd), settings: readSettings(cwd) });
    if (level === 2) {
      const lines: string[] = [];
      // The sandbox loads at session start, so a fresh `security 2` isn't active
      // until restart — probe a protected file to tell applied from pending.
      if (isInsideClaudeCode()) {
        const active = probeWriteBlocked(join(cwd, "harness", "harness.config.ts"));
        lines.push(
          active
            ? `${pc.green("● active")} this session — writes to harness/ are blocked by the OS.`
            : `${pc.yellow("○ configured but NOT active")} this session — restart Claude Code to apply.`,
        );
      } else {
        lines.push(
          pc.dim("(run inside Claude Code to check whether the sandbox is active this session)"),
        );
      }
      // The level-2 edit-deny message is Claude Code's own (`permissions.deny`)
      // and can't be customized, so the unlock guidance lives here instead.
      lines.push(
        pc.dim(
          "To make harness changes: `npx harness security 1`, restart Claude Code, edit, then `npx harness security 2`.",
        ),
      );
      p.note(lines.join("\n"), `Level ${level} ${describe(level)}`);
    }
    p.outro(`Current level: ${pc.bold(String(level))} ${describe(level)}`);
    return;
  }

  const level = Number(levelArg);
  if (!LEVELS.includes(level as (typeof LEVELS)[number])) {
    p.cancel(`Invalid level "${levelArg}". Use 0, 1, 2, or 3.`);
    process.exit(1);
  }

  if (level === 0) setLevel0(cwd);
  else if (level === 1) setLevel1(cwd);
  else if (level === 2) setLevel2(cwd);
  else setLevel3(cwd);
}

function describe(level: number): string {
  return (
    { 0: "(off — fully unlocked)", 1: "(guard)", 2: "(sandbox)" }[level] ?? ""
  );
}

function setLevel0(cwd: string) {
  writeFileSync(envPath(cwd), upsertEnvLine(readEnv(cwd), UNLOCK, "1"));
  // Off means off: also drop any sandbox/permission block from a prior Level 2,
  // or its kernel/permission deny would still block edits despite the flag.
  const settings = readSettings(cwd);
  const hadSandbox = hasHarnessSandbox(settings);
  if (hadSandbox) writeSettings(cwd, removeHarnessSandbox(settings));

  p.note(
    `Wrote ${pc.cyan(`${UNLOCK}=1`)} to ${pc.cyan(".env.agents")}.\n` +
      "The harness is now unlocked — the agent can edit harness files.",
    "Level 0 — off",
  );
  p.outro(
    hadSandbox
      ? `Also removed the sandbox block. ${pc.dim("Restart Claude Code to drop it.")}`
      : `Re-lock anytime with ${pc.cyan("npx harness security 1")}.`,
  );
}

function setLevel1(cwd: string) {
  if (existsSync(envPath(cwd))) {
    writeFileSync(envPath(cwd), removeEnvLine(readEnv(cwd), UNLOCK));
  }
  const settings = readSettings(cwd);
  const hadSandbox = hasHarnessSandbox(settings);
  if (hadSandbox) writeSettings(cwd, removeHarnessSandbox(settings));

  p.note("In-process guard active; harness files are locked.", "Level 1 — guard");
  p.outro(
    hadSandbox
      ? `Removed the sandbox block. ${pc.dim("Restart Claude Code to drop it.")}`
      : "Done.",
  );
}

function setLevel2(cwd: string) {
  if (existsSync(envPath(cwd))) {
    writeFileSync(envPath(cwd), removeEnvLine(readEnv(cwd), UNLOCK));
  }
  if (!existsSync(settingsPath(cwd))) {
    p.cancel(
      `${settingsPath(cwd)} not found — run \`npx harness init\` first.`,
    );
    process.exit(1);
  }
  writeSettings(cwd, addHarnessSandbox(readSettings(cwd)));

  const warning = bubblewrapMissing()
    ? `\n${pc.yellow("⚠")} bubblewrap (bwrap) not found — the sandbox needs it on Linux. Install it to enforce.`
    : "";
  p.note(
    "OS-enforced read-only protection written to settings.json." + warning,
    "Level 2 — sandbox",
  );
  p.outro(
    `${pc.dim("Restart Claude Code to apply.")} Unlock for harness work with ${pc.cyan("npx harness security 1")} (then restart).`,
  );
}

function setLevel3(cwd: string) {
  const recipe =
    process.platform === "darwin"
      ? "sudo chown -R root harness .env.agents .claude/settings.json && sudo chmod -R a-w harness .env.agents .claude/settings.json"
      : "sudo chattr -R +i harness .env.agents .claude/settings.json";
  p.note(
    [
      "External hardening is enforced by the OS, not the harness. It must require",
      "root to undo — if your user can reverse it, so can the agent (same uid). Run:",
      `  ${pc.cyan(recipe)}`,
      `  ${pc.cyan("# strongest: own the harness as root / a separate user, or mount it read-only")}`,
      "",
      "The harness can't apply this for you (it runs as your user), but it can verify.",
    ].join("\n"),
    "Level 3 — external",
  );

  const probe = join(cwd, "harness", "harness.config.ts");
  const protectedNow = existsSync(probe) && probeWriteBlocked(probe);
  p.outro(
    protectedNow
      ? `${pc.green("✔")} Verified: ${pc.cyan("harness/")} is write-protected by the OS.`
      : `${pc.yellow("✗")} Not protected yet — apply a recipe above, then re-run ${pc.cyan("npx harness security 3")}.`,
  );
}
