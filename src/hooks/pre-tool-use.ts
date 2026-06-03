import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { HarnessConfig } from "../define";
import { loadProjectEnv } from "../env";
import { protectHarness } from "../guards/protect-harness";
import { projectDir } from "../paths";
import { createPreToolUseDispatcher } from "./lib/dispatch";

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

  // protectHarness is prepended here, never read from config, so it can't be
  // unregistered by editing harness.config.ts. It guards the harness itself.
  await createPreToolUseDispatcher([
    protectHarness,
    ...(mod.default.guards ?? []),
  ]);
}

main().catch((err) => {
  process.stderr.write(String(err));
  process.exit(1);
});
