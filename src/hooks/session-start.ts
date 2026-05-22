import { readManifest } from "../cli/manifest";
import { VERSION } from "../index";
import { projectDir } from "./utils";

/** SessionStart hook. Fires once per Claude Code session. If the project's
 *  installed manifest version doesn't match the SDK's current version, inject
 *  a one-line drift notice into the session context so both Claude and the
 *  user see it. Silent on no drift or uninitialised projects. */
function main(): void {
  const dir = projectDir();
  const manifest = readManifest(dir);

  if (!manifest.sdkVersion) return;
  if (manifest.sdkVersion === VERSION) return;

  const additionalContext =
    `[agent-harness-sdk] Managed content was synced at v${manifest.sdkVersion}, ` +
    `but the installed SDK is v${VERSION}. ` +
    "Run `npx harness update` to refresh skills, rules, and the `/harness` slash command. " +
    "Local edits are preserved via checksum.";

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext,
      },
    }),
  );
  process.exit(0);
}

try {
  main();
} catch (err) {
  process.stderr.write(`agent-harness-sdk session-start hook: ${String(err)}\n`);
  process.exit(0);
}
