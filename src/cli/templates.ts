/** Templates rendered by `harness init`. Kept as functions for parameterization. */

export function harnessConfigTemplate(): string {
  return `import {
  defineHarness,
  harnessStatus,
  protectEnvFiles,
} from "agent-harness-sdk";

export default defineHarness({
  mcp: {
    name: "harness-mcp",
    version: "0.1.0",
  },
  tools: [
    harnessStatus,
    // Add user tools here. Scaffold with: harness add tool <name>
  ],
  guards: [
    protectEnvFiles,
    // Add more guards here. Scaffold with: harness add guard <name>
  ],
  checks: [
    // Add user checks here. Scaffold with: harness add check <name>
  ],
});
`;
}

export function mcpJsonTemplate(): string {
  return `${JSON.stringify(
    {
      mcpServers: {
        "harness-mcp": {
          type: "stdio",
          command: "npx",
          args: [
            "--no-install",
            "tsx",
            "node_modules/agent-harness-sdk/dist/mcp/start.js",
          ],
        },
      },
    },
    null,
    2,
  )}\n`;
}

export function claudeSettingsTemplate(): string {
  return `${JSON.stringify(
    {
      hooks: {
        PreToolUse: [
          {
            matcher: "Edit|Write|MultiEdit",
            hooks: [
              {
                type: "command",
                command:
                  "npx --no-install tsx $CLAUDE_PROJECT_DIR/node_modules/agent-harness-sdk/dist/hooks/pre-tool-use.js",
              },
            ],
          },
        ],
        PostToolUse: [
          {
            matcher: "Edit|Write|MultiEdit",
            hooks: [
              {
                type: "command",
                command:
                  "npx --no-install tsx $CLAUDE_PROJECT_DIR/node_modules/agent-harness-sdk/dist/hooks/post-tool-use.js",
              },
            ],
          },
        ],
      },
    },
    null,
    2,
  )}\n`;
}
