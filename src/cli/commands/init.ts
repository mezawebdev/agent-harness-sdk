import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  mergeClaudeSettings,
  mergeMcpServers,
} from "../merge-config";
import { addHarnessSandbox } from "../sandbox-protection";
import { syncContent } from "../sync-content";
import {
  harnessConfigTemplate,
  harnessHookEntries,
  harnessMcpServerEntry,
} from "../templates";

const HARNESS_MCP_SERVER_KEY = "harness-mcp";

function readJsonOrNull(path: string): unknown {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

export async function init(): Promise<void> {
  const cwd = process.cwd();

  p.intro(pc.cyan("agent-harness-sdk init"));

  // Only block on harness/ — settings.json and .mcp.json are merged, not overwritten.
  if (existsSync(join(cwd, "harness"))) {
    const proceed = await p.confirm({
      message: `An existing harness/ directory was found. Overwrite harness.config.ts?`,
      initialValue: false,
    });
    if (p.isCancel(proceed) || !proceed) {
      p.cancel("Aborted.");
      process.exit(0);
    }
  }

  // Self-protection posture. 0 (off) is intentionally NOT offered here — it's a
  // deliberate post-install opt-out via `npx harness security 0`. init never
  // writes `.env`.
  let level = 1;
  if (process.stdout.isTTY) {
    const choice = await p.select({
      message: "Harness security level?",
      initialValue: 1,
      options: [
        { value: 1, label: "1 — Guard (recommended)", hint: "in-process lock" },
        {
          value: 2,
          label: "2 — Sandbox",
          hint: "OS-enforced read-only (macOS/Linux)",
        },
        {
          value: 3,
          label: "3 — External",
          hint: "you harden the OS; harness verifies",
        },
      ],
    });
    if (p.isCancel(choice)) {
      p.cancel("Aborted.");
      process.exit(0);
    }
    level = choice as number;
  }

  const s = p.spinner();

  s.start("Creating directories");
  mkdirSync(join(cwd, "harness/tools"), { recursive: true });
  mkdirSync(join(cwd, "harness/guards"), { recursive: true });
  mkdirSync(join(cwd, "harness/checks"), { recursive: true });
  mkdirSync(join(cwd, ".claude/skills"), { recursive: true });
  mkdirSync(join(cwd, ".claude/rules"), { recursive: true });
  mkdirSync(join(cwd, ".claude/commands"), { recursive: true });
  s.stop("Directories created");

  s.start("Writing harness.config.ts");
  writeFileSync(join(cwd, "harness/harness.config.ts"), harnessConfigTemplate());
  s.stop("harness.config.ts written");

  s.start("Merging .claude/settings.json (preserving existing entries)");
  const settingsPath = join(cwd, ".claude/settings.json");
  const existingSettings = readJsonOrNull(settingsPath) as Parameters<typeof mergeClaudeSettings>[0];
  const mergedSettings = mergeClaudeSettings(existingSettings, harnessHookEntries());
  const finalSettings =
    level === 2
      ? (addHarnessSandbox(mergedSettings as Record<string, unknown>) as typeof mergedSettings)
      : mergedSettings;
  writeFileSync(settingsPath, `${JSON.stringify(finalSettings, null, 2)}\n`);
  s.stop(
    level === 2
      ? ".claude/settings.json merged (+ sandbox protection)"
      : ".claude/settings.json merged",
  );

  s.start("Merging .mcp.json (preserving other MCP servers)");
  const mcpPath = join(cwd, ".mcp.json");
  const existingMcp = readJsonOrNull(mcpPath) as Parameters<typeof mergeMcpServers>[0];
  const mergedMcp = mergeMcpServers(
    existingMcp,
    HARNESS_MCP_SERVER_KEY,
    harnessMcpServerEntry(),
  );
  writeFileSync(mcpPath, `${JSON.stringify(mergedMcp, null, 2)}\n`);
  s.stop(".mcp.json merged");

  s.start("Installing library skills, rules, and commands");
  const summary = syncContent(cwd);
  const written = summary.files.filter((f) => f.outcome === "wrote").length;
  s.stop(`Installed ${written} library file${written === 1 ? "" : "s"}`);

  s.start("Adding .harness/ to .gitignore");
  const gitignorePath = join(cwd, ".gitignore");
  const ignoreEntry = ".harness/\n";
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, ignoreEntry);
  } else {
    const current = readFileSync(gitignorePath, "utf-8");
    if (!current.split("\n").some((l) => l.trim() === ".harness/" || l.trim() === ".harness")) {
      appendFileSync(
        gitignorePath,
        (current.endsWith("\n") ? "" : "\n") + ignoreEntry,
      );
    }
  }
  s.stop(".gitignore updated");

  if (level === 3) {
    p.note(
      [
        "Level 3 is enforced by the OS, not the harness — apply it as root (sudo),",
        `then verify with ${pc.cyan("npx harness security 3")}:`,
        process.platform === "darwin"
          ? `  ${pc.cyan("sudo chown -R root harness .env && sudo chmod -R a-w harness .env")}`
          : `  ${pc.cyan("sudo chattr -R +i harness .env")}`,
      ].join("\n"),
      "Level 3 — external",
    );
  }

  p.note(
    [
      `${pc.dim("•")} ${pc.bold("harness/")}                  domain code (tools, guards, checks)`,
      `${pc.dim("•")} ${pc.bold("harness/harness.config.ts")} declarative config`,
      `${pc.dim("•")} ${pc.bold(".claude/skills/")}           library skills (synced)`,
      `${pc.dim("•")} ${pc.bold(".claude/rules/harness.md")}  conventions (synced)`,
      `${pc.dim("•")} ${pc.bold(".claude/commands/harness.md")} /harness slash command (synced)`,
      `${pc.dim("•")} ${pc.bold(".mcp.json")}                 MCP server merged in`,
      `${pc.dim("•")} ${pc.bold(".claude/settings.json")}     hooks merged in`,
    ].join("\n"),
    "Created",
  );

  p.outro(
    [
      pc.green(`Harness initialized at security level ${level}.`),
      "",
      pc.dim(
        `Change it anytime with ${pc.cyan("npx harness security <0-3>")} ${pc.dim("(0 = off)")}.`,
      ),
      "",
      pc.dim("Next steps:"),
      `  1. Restart Claude Code from this directory`,
      `  2. Approve the new MCP server and hook commands when prompted`,
      `  3. Add tools/guards/checks under ${pc.cyan("harness/")} and register in ${pc.cyan("harness.config.ts")}`,
    ].join("\n"),
  );
}
