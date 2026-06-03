import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { HarnessConfig } from "../define";
import { loadProjectEnv } from "../env";
import { projectDir } from "../paths";
import {
  evolveDismissFinding,
  evolveRecordRun,
} from "../tools/evolve-state";
import { harnessStatus } from "../tools/harness-status";
import { createMcpServer } from "./server";

const DEFAULT_MCP_NAME = "harness-mcp";
const DEFAULT_MCP_VERSION = "0.1.0";

const INTERNAL_TOOLS = [harnessStatus, evolveRecordRun, evolveDismissFinding];
const INTERNAL_TOOL_NAMES = new Set(INTERNAL_TOOLS.map((t) => t.name));

async function main() {
  const dir = projectDir();
  loadProjectEnv(dir);
  const configPath = join(dir, "harness", "harness.config.ts");

  if (!existsSync(configPath)) {
    process.stderr.write(
      `agent-harness-sdk: harness config not found at ${configPath}\n`,
    );
    process.exit(1);
  }

  const mod = (await import(pathToFileURL(configPath).href)) as {
    default: HarnessConfig;
  };

  const userTools = mod.default.tools ?? [];
  for (const t of userTools) {
    if (INTERNAL_TOOL_NAMES.has(t.name)) {
      process.stderr.write(
        `agent-harness-sdk: tool name "${t.name}" is reserved for the framework — please rename your tool.\n`,
      );
      process.exit(1);
    }
  }

  await createMcpServer({
    name: mod.default.mcp?.name ?? DEFAULT_MCP_NAME,
    version: mod.default.mcp?.version ?? DEFAULT_MCP_VERSION,
    tools: [...INTERNAL_TOOLS, ...userTools],
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
