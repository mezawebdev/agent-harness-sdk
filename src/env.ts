import { existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";

/** Load `.env` from the project directory if present. Existing process.env
 *  values take precedence — `.env` only fills in gaps. */
export function loadProjectEnv(projectDir: string): void {
  const envPath = join(projectDir, ".env");
  if (!existsSync(envPath)) return;
  config({ path: envPath, override: false, quiet: true });
}
