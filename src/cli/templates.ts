/** Templates rendered by `harness init`. Functions return either file content
 *  strings (for harness.config.ts) or structured JS objects (for JSON files
 *  that get merged into existing user content). */

export function harnessConfigTemplate(): string {
  return `import { defineHarness, protectEnvFiles } from "agent-harness-sdk";

export default defineHarness({
  // mcp: { name: "my-app", version: "0.1.0" }, // optional; defaults to "harness-mcp" v0.1.0
  tools: [
    // Add tools here. Scaffold with: /harness add tool <name>
  ],
  guards: [
    protectEnvFiles,
    // Add guards here. Scaffold with: /harness add guard <name>
  ],
  checks: [
    // Add checks here. Scaffold with: /harness add check <name>
  ],
});
`;
}

/** Hook entries to merge into the user's `.claude/settings.json`. */
export function harnessHookEntries() {
  const matcher = "Edit|Write|MultiEdit";
  const entryFor = (hookFile: string) => ({
    matcher,
    hooks: [
      {
        type: "command",
        command: `npx --no-install tsx $CLAUDE_PROJECT_DIR/node_modules/agent-harness-sdk/dist/hooks/${hookFile}`,
      },
    ],
  });
  const matcherlessEntryFor = (hookFile: string) => ({
    hooks: [
      {
        type: "command",
        command: `npx --no-install tsx $CLAUDE_PROJECT_DIR/node_modules/agent-harness-sdk/dist/hooks/${hookFile}`,
      },
    ],
  });
  return {
    PreToolUse: [entryFor("pre-tool-use.js")],
    PostToolUse: [entryFor("post-tool-use.js")],
    SessionStart: [matcherlessEntryFor("session-start.js")],
  };
}

/** MCP server entry to merge into the user's `.mcp.json`. */
export function harnessMcpServerEntry() {
  return {
    type: "stdio",
    command: "npx",
    args: [
      "--no-install",
      "tsx",
      "node_modules/agent-harness-sdk/dist/mcp/start.js",
    ],
  };
}
