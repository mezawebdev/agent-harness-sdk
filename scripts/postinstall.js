#!/usr/bin/env node
/**
 * postinstall hook. Auto-runs `harness update` after the SDK is installed
 * into a project that's already been initialized (i.e. has .harness/installed.json).
 * Skips silently for fresh installs (user hasn't run `harness init` yet).
 *
 * INIT_CWD is npm's record of the directory where the user invoked `npm install`,
 * which is the consuming project's root.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const initCwd = process.env.INIT_CWD || process.cwd();

// Skip if the user hasn't run `harness init` yet.
const manifestPath = join(initCwd, ".harness", "installed.json");
if (!existsSync(manifestPath)) {
  process.exit(0);
}

// Skip if our own dist/ doesn't exist (e.g. local dev install before build).
const cliPath = join(here, "..", "dist", "cli", "index.js");
if (!existsSync(cliPath)) {
  process.exit(0);
}

try {
  execSync(`node "${cliPath}" update`, {
    cwd: initCwd,
    stdio: "inherit",
    env: { ...process.env, CLAUDE_PROJECT_DIR: initCwd },
  });
} catch (err) {
  // Don't fail the npm install if update has issues.
  console.error(
    "agent-harness-sdk: postinstall update failed (non-fatal):",
    err && err.message ? err.message : err,
  );
}
