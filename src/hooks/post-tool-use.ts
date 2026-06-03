import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { HarnessConfig } from "../define";
import { loadProjectEnv } from "../env";
import { projectDir } from "../paths";
import { createPostToolUseDispatcher } from "./lib/dispatch";

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

  await createPostToolUseDispatcher(mod.default.checks ?? []);
}

main().catch((err) => {
  process.stderr.write(String(err));
  process.exit(1);
});
