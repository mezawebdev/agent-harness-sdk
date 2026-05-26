import { Tools } from "../tool-names";
import { guardDeny, type Guard } from "../types";

/**
 * Universal guard: blocks Edit/Write/MultiEdit on any `.env` or `.env.*` file.
 * .env files should be edited by humans, not by automation.
 */
export const protectEnvFiles: Guard = {
  name: "protect-env-files",
  tools: [Tools.Edit, Tools.Write, Tools.MultiEdit],
  files: ["**/.env", "**/.env.*"],
  async run(input) {
    const file = input.tool_input?.file_path ?? "";
    return guardDeny(
      `protect-env-files: ${file} is protected. .env files should not be modified by automation — ask the user to edit manually.`,
    );
  },
};
