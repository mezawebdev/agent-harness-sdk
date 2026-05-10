import type { Guard } from "../types";

const ENV_FILE = /\/\.env(\..*)?$/;
const WRITE_TOOLS = new Set(["Edit", "Write", "MultiEdit"]);

/**
 * Universal guard: blocks Edit/Write/MultiEdit on any `.env` or `.env.*` file.
 * .env files should be edited by humans, not by automation.
 */
export const protectEnvFiles: Guard = {
  name: "protect-env-files",
  matches: (input) => {
    if (!WRITE_TOOLS.has(input.tool_name ?? "")) return false;
    const file = input.tool_input?.file_path ?? "";
    return ENV_FILE.test(file);
  },
  async run(input) {
    const file = input.tool_input?.file_path ?? "";
    return {
      allow: false,
      reason: `protect-env-files: ${file} is protected. .env files should not be modified by automation — ask the user to edit manually.`,
    };
  },
};
