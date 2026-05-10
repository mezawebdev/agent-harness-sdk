import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { HarnessConfig } from "../define";
import { projectDir } from "../hooks/utils";
import { createMcpServer } from "./server";

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

  if (!mod.default.mcp) {
    process.stderr.write(
      "agent-harness-sdk: harness.config.ts has no `mcp` block\n",
    );
    process.exit(1);
  }

  await createMcpServer({
    name: mod.default.mcp.name,
    version: mod.default.mcp.version,
    tools: mod.default.tools ?? [],
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
