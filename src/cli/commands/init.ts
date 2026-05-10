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
import { syncContent } from "../sync-content";
import {
  claudeSettingsTemplate,
  harnessConfigTemplate,
  mcpJsonTemplate,
} from "../templates";

export async function init(): Promise<void> {
  const cwd = process.cwd();

  p.intro(pc.cyan("agent-harness-sdk init"));

  const existing = [
    "harness",
    ".mcp.json",
    ".claude/settings.json",
  ].filter((rel) => existsSync(join(cwd, rel)));

  if (existing.length > 0) {
    const proceed = await p.confirm({
      message: `Existing harness files detected (${existing.join(", ")}). Overwrite?`,
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

  s.start("Writing config files");
  writeFileSync(join(cwd, "harness/harness.config.ts"), harnessConfigTemplate());
  writeFileSync(join(cwd, ".mcp.json"), mcpJsonTemplate());
  writeFileSync(join(cwd, ".claude/settings.json"), claudeSettingsTemplate());
  s.stop("Config files written");

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
      `${pc.dim("•")} ${pc.bold(".mcp.json")}                 MCP server registration`,
      `${pc.dim("•")} ${pc.bold(".claude/settings.json")}     hook registrations`,
    ].join("\n"),
    "Created",
  );

  p.outro(
    [
      pc.green("Harness initialized."),
      "",
      pc.dim("Next steps:"),
      `  1. Install peer deps: ${pc.cyan("npm install --save-dev @modelcontextprotocol/sdk zod tsx")}`,
      `  2. Restart Claude Code from this directory`,
      `  3. Approve the new MCP server and hook commands when prompted`,
      `  4. Add tools/guards/checks under ${pc.cyan("harness/")} and register in ${pc.cyan("harness.config.ts")}`,
    ].join("\n"),
  );
}
