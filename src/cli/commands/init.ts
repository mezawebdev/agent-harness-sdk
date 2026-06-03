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
import { harnessConfigTemplate } from "../templates";
import { installWiring } from "../wiring";

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
  mkdirSync(join(cwd, "harness/guards"), { recursive: true });
  mkdirSync(join(cwd, "harness/checks"), { recursive: true });
  mkdirSync(join(cwd, ".claude/skills"), { recursive: true });
  mkdirSync(join(cwd, ".claude/rules"), { recursive: true });
  mkdirSync(join(cwd, ".claude/commands"), { recursive: true });
  s.stop("Directories created");

  s.start("Writing harness.config.ts");
  writeFileSync(join(cwd, "harness/harness.config.ts"), harnessConfigTemplate());
  s.stop("harness.config.ts written");

  s.start("Merging .claude/settings.json + .mcp.json (preserving existing entries)");
  installWiring(cwd);
  s.stop(".claude/settings.json + .mcp.json merged");

  s.start("Installing library skills, rules, and commands");
  const summary = syncContent(cwd);
  const written = summary.files.filter((f) => f.outcome === "wrote").length;
  s.stop(`Installed ${written} library file${written === 1 ? "" : "s"}`);

  s.start("Updating .gitignore");
  const gitignorePath = join(cwd, ".gitignore");
  // .harness/ = per-machine scratch (drift state, legacy manifest);
  // .env.agents = the local unlock flag — neither belongs in git.
  const ignoreEntries = [".harness/", ".env.agents"];
  const current = existsSync(gitignorePath)
    ? readFileSync(gitignorePath, "utf-8")
    : "";
  const present = new Set(current.split("\n").map((l) => l.trim()));
  const missing = ignoreEntries.filter(
    (e) => !present.has(e) && !present.has(e.replace(/\/$/, "")),
  );
  if (missing.length > 0) {
    const prefix = current === "" || current.endsWith("\n") ? "" : "\n";
    appendFileSync(gitignorePath, `${prefix}${missing.join("\n")}\n`);
  }
  s.stop(".gitignore updated");

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
      pc.green("Harness initialized"),
      "",
      pc.dim(
        "This harness is locked by default — it protects its own files (harness/, .env.agents, the hook wiring) from the agent.",
      ),
      `  ${pc.dim("•")} to let the agent change the harness, add ${pc.cyan("HARNESS_UNLOCK=1")} to ${pc.cyan(".env.agents")}`,
      `  ${pc.dim("•")} use ${pc.cyan("/harness security help")} to learn more`,
      "",
      pc.dim("Restart Claude Code from this directory to load the harness."),
    ].join("\n"),
  );
}
