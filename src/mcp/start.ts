import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { HarnessConfig } from "../define";
import { projectDir } from "../hooks/utils";
import { createMcpServer } from "./server";

const DEFAULT_MCP_NAME = "harness-mcp";
const DEFAULT_MCP_VERSION = "0.1.0";

async function main() {
  const configPath = join(projectDir(), "harness", "harness.config.ts");

  if (!existsSync(configPath)) {
    process.stderr.write(
      `agent-harness-sdk: harness config not found at ${configPath}\n`,
    );
    process.exit(1);
  }

  const mod = (await import(pathToFileURL(configPath).href)) as {
    default: HarnessConfig;
  };

  await createMcpServer({
    name: mod.default.mcp?.name ?? DEFAULT_MCP_NAME,
    version: mod.default.mcp?.version ?? DEFAULT_MCP_VERSION,
    tools: mod.default.tools ?? [],
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
