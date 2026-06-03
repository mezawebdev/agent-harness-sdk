/**
 * Shared version-drift detection + nudge, used by the SessionStart and
 * UserPromptSubmit hooks. Drift = the SDK that last synced this project (recorded
 * in the manifest) differs from the one installed now. Re-read from disk on every
 * hook invocation, so it reflects a mid-session `npm update` without a restart.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { readManifest } from "../../cli/manifest";
import { VERSION } from "../../index";

export interface Drift {
  recorded: string;
  current: string;
}

/** The installed-vs-recorded version drift, or null when in sync / uninitialised. */
export function detectDrift(projectDir: string): Drift | null {
  const recorded = readManifest(projectDir).sdkVersion;
  if (!recorded) return null;
  if (recorded === VERSION) return null;
  return { recorded, current: VERSION };
}

const NUDGE_LINE =
  "> 🛡️ _Your harness was updated — run `/harness update` to get the latest changes._";

/** Surface the drift nudge for a hook: stderr (visible in the hook output area)
 *  plus an `additionalContext` directive that makes Claude echo a one-line system
 *  note in chat. Writes the hook's JSON output to stdout. */
export function emitNudge(hookEventName: string): void {
  process.stderr.write(
    "[agent-harness-sdk] Your harness was updated. Run `/harness update` to get the latest changes.\n",
  );
  const additionalContext =
    "[agent-harness-sdk] The harness was updated. " +
    "IMPORTANT: At the very start of your next response to the user, output " +
    "EXACTLY this line as the first content (verbatim, including the leading " +
    "`> ` blockquote marker, the shield emoji, and the surrounding underscores " +
    "for italics):\n\n" +
    `${NUDGE_LINE}\n\n` +
    "Then proceed with their actual request on the next line.";
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName, additionalContext } }),
  );
}

// Per-session throttle state for the UserPromptSubmit nudge. Lives in the
// gitignored `.harness/` (per-machine/session scratch — not the git-tracked
// manifest at harness/harness.lock).
const STATE_REL = ".harness/drift-state.json";
const MAX_KEYS = 50;

type DriftState = { nudged: string[] };

function statePath(projectDir: string): string {
  return join(projectDir, STATE_REL);
}

function readState(projectDir: string): DriftState {
  const path = statePath(projectDir);
  if (!existsSync(path)) return { nudged: [] };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as DriftState;
    return { nudged: Array.isArray(parsed.nudged) ? parsed.nudged : [] };
  } catch {
    return { nudged: [] };
  }
}

/** A nudge key is per (session, version): one nudge per session, but a *new*
 *  upgrade later in the same session is a fresh key and nudges again. */
export function nudgeKey(
  sessionId: string | undefined,
  version: string,
): string {
  return `${sessionId ?? "unknown"}:${version}`;
}

export function wasNudged(projectDir: string, key: string): boolean {
  return readState(projectDir).nudged.includes(key);
}

export function markNudged(projectDir: string, key: string): void {
  const state = readState(projectDir);
  if (state.nudged.includes(key)) return;
  state.nudged = [...state.nudged, key].slice(-MAX_KEYS);
  try {
    mkdirSync(dirname(statePath(projectDir)), { recursive: true });
    writeFileSync(statePath(projectDir), `${JSON.stringify(state, null, 2)}\n`);
  } catch {
    // best-effort throttle; a failed write just risks one repeat nudge
  }
}
