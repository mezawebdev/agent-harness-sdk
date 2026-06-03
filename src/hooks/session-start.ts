import { projectDir } from "../paths";
import { detectDrift, emitNudge } from "./lib/drift";

/** SessionStart hook. Fires once per session (and on resume/compact). If the
 *  installed SDK version has drifted from the project's manifest, nudge the user
 *  to run `/harness update`. Mid-session upgrades that this can't see without a
 *  restart are covered by the UserPromptSubmit hook. Silent on no drift or
 *  uninitialised projects. */
function main(): void {
  if (!detectDrift(projectDir())) return;
  emitNudge("SessionStart");
  process.exit(0);
}

try {
  main();
} catch (err) {
  process.stderr.write(`agent-harness-sdk session-start hook: ${String(err)}\n`);
  process.exit(0);
}
