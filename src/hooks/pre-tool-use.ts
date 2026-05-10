import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { HarnessConfig } from "../define";
import { createPreToolUseDispatcher } from "./dispatch";
import { projectDir } from "./utils";

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

  await createPreToolUseDispatcher(mod.default.guards ?? []);
}

main().catch((err) => {
  process.stderr.write(String(err));
  process.exit(1);
});
