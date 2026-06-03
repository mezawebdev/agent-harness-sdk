import { projectDir } from "../paths";
import { readHookInput } from "./lib/io";
import {
  detectDrift,
  emitNudge,
  markNudged,
  nudgeKey,
  wasNudged,
} from "./lib/drift";

/** UserPromptSubmit hook. Fires once per user turn, so it catches an SDK upgrade
 *  that happens *during* a long-lived session — SessionStart already ran and
 *  won't re-fire without a restart. Reads the live installed version on each
 *  prompt; throttled to one nudge per session+version so it doesn't repeat every
 *  turn. Silent on no drift or uninitialised projects. */
function main(): void {
  const dir = projectDir();
  const drift = detectDrift(dir);
  if (!drift) return; // common path — return before touching stdin

  let sessionId: string | undefined;
  try {
    sessionId = readHookInput().session_id;
  } catch {
    sessionId = undefined;
  }

  const key = nudgeKey(sessionId, drift.current);
  if (wasNudged(dir, key)) return;
  markNudged(dir, key);
  emitNudge("UserPromptSubmit");
  process.exit(0);
}

try {
  main();
} catch (err) {
  process.stderr.write(
    `agent-harness-sdk user-prompt-submit hook: ${String(err)}\n`,
  );
  process.exit(0);
}
