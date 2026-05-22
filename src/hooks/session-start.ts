import { readManifest } from "../cli/manifest";
import { VERSION } from "../index";
import { projectDir } from "./utils";

/** SessionStart hook. Fires once per Claude Code session. If the project's
 *  installed manifest version doesn't match the SDK's current version, surface
 *  the drift two ways:
 *    1. stderr — visible in Claude Code's hook output area.
 *    2. additionalContext JSON — instructs Claude to mention drift in its
 *       next response, guaranteeing user visibility via chat.
 *  Silent on no drift or uninitialised projects. */
function main(): void {
  const dir = projectDir();
  const manifest = readManifest(dir);

  if (!manifest.sdkVersion) return;
  if (manifest.sdkVersion === VERSION) return;

  // (1) stderr — surfaced more visibly than additionalContext.
  process.stderr.write(
    "[agent-harness-sdk] Your harness was updated. Run `/harness update` to get the latest changes.\n",
  );

  // (2) additionalContext — imperative so Claude surfaces it in chat.
  //     Force a blockquote + italic + shield emoji so the line reads as a
  //     system note, not part of Claude's prose response.
  const additionalContext =
    "[agent-harness-sdk] The harness was updated. " +
    "IMPORTANT: At the very start of your next response to the user, output " +
    "EXACTLY this line as the first content (verbatim, including the leading " +
    "`> ` blockquote marker, the shield emoji, and the surrounding underscores " +
    "for italics):\n\n" +
    "> 🛡️ _Your harness was updated — run `/harness update` to get the latest changes._\n\n" +
    "Then proceed with their actual request on the next line.";

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
