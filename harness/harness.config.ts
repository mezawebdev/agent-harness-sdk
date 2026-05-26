import { defineHarness, protectEnvFiles } from "../src/index";
import { protectManagedClaudeFiles } from "./guards/protect-managed-claude-files";
import { colocateTestFiles } from "./guards/colocate-test-files";

export default defineHarness({
  // mcp: { name: "my-app", version: "0.1.0" }, // optional; defaults to "harness-mcp" v0.1.0
  tools: [
    // Add tools here. Scaffold with: /harness add tool <name>
  ],
  guards: [
    protectEnvFiles,
    // Add guards here. Scaffold with: /harness add guard <name>
    protectManagedClaudeFiles,
    colocateTestFiles,
  ],
  checks: [
    // Add checks here. Scaffold with: /harness add check <name>
  ],
});
