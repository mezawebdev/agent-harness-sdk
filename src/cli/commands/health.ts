import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * Spawns the tsx-launched health entry (which loads the TypeScript
 * harness.config.ts that plain node cannot import) and pipes its JSON to
 * stdout. `args` are passed through verbatim (e.g. ["trigger","guard","x",
 * "--input","{...}"]).
 */
export function health(args: string[]): void {
  const entry = fileURLToPath(new URL("../health/run.js", import.meta.url));
  // Pass args through verbatim (incl. `--input <json>`); commander must not
  // parse them, so the `health` command uses allowUnknownOption/allowExcessArguments.
  const result = spawnSync("npx", ["--no-install", "tsx", entry, ...args], {
    cwd: process.cwd(),
    encoding: "utf-8",
    stdio: ["inherit", "pipe", "inherit"],
  });
  if (result.error) {
    process.stderr.write(`harness health: failed to launch tsx — ${result.error.message}\n`);
    process.exit(1);
  }
  if (result.stdout) process.stdout.write(result.stdout);
  process.exit(result.status ?? 1);
}
