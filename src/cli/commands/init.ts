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

  const s = p.spinner();

  s.start("Creating directories");
  mkdirSync(join(cwd, "harness/tools"), { recursive: true });
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
  writeFileSync(settingsPath, `${JSON.stringify(mergedSettings, null, 2)}\n`);
  s.stop(".claude/settings.json merged");

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

  p.note(
    [
      `${pc.dim("•")} ${pc.bold("harness/")}                  domain code (tools, checks)`,
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
      pc.green("Harness initialized."),
      "",
      pc.dim("Next steps:"),
      `  1. Restart Claude Code from this directory`,
      `  2. Approve the new MCP server and hook commands when prompted`,
      `  3. Add tools/guards/checks under ${pc.cyan("harness/")} and register in ${pc.cyan("harness.config.ts")}`,
    ].join("\n"),
  );
}
