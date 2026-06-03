import { describe, expect, it } from "vitest";
import { defineCheck, defineGuard } from "../../define";
import { projectDir } from "../../paths";
import { checkFail, checkOk, guardAllow, guardDeny } from "../../types";
import { bashTool, runCheck, runGuard, tool, writeTool } from "../index";

describe("payload builders", () => {
  it("writeTool builds a Write call with file_path", () => {
    expect(writeTool("/x/a.ts", "hi")).toEqual({
      tool_name: "Write",
      tool_input: { file_path: "/x/a.ts", content: "hi" },
    });
  });

  it("bashTool builds a Bash call with command (no file_path)", () => {
    expect(bashTool("ls")).toEqual({ tool_name: "Bash", tool_input: { command: "ls" } });
  });

  it("tool is the generic escape hatch", () => {
    expect(tool("Glob", { pattern: "**/*" })).toEqual({
      tool_name: "Glob",
      tool_input: { pattern: "**/*" },
    });
  });
});

const denyTs = defineGuard({
  name: "deny-ts",
  files: ["**/*.ts"],
  run: async () => guardDeny("deny-ts: blocked"),
});

describe("runGuard", () => {
  it("reports inactive when conditions don't match", async () => {
    expect(await runGuard(denyTs, bashTool("ls"))).toEqual({
      active: false,
      denied: false,
      reason: null,
    });
  });

  it("reports denied with reason when active and run() denies", async () => {
    const r = await runGuard(denyTs, writeTool("/x/a.ts"));
    expect(r.active).toBe(true);
    expect(r.denied).toBe(true);
    expect(r.reason).toContain("deny-ts");
  });

  it("reports allowed when active and run() allows", async () => {
    const allowAll = defineGuard({ name: "allow", run: async () => guardAllow() });
    expect(await runGuard(allowAll, writeTool("/x/a.ts"))).toEqual({
      active: true,
      denied: false,
      reason: null,
    });
  });

  it("projectDir option pins CLAUDE_PROJECT_DIR for the run and restores it", async () => {
    const before = process.env.CLAUDE_PROJECT_DIR;
    const echoDir = defineGuard({
      name: "echo-dir",
      run: async () => guardDeny(projectDir()),
    });

    const r = await runGuard(echoDir, writeTool("/x/a.ts"), { projectDir: "/custom/root" });

    expect(r.reason).toBe("/custom/root");
    expect(process.env.CLAUDE_PROJECT_DIR).toBe(before);
  });
});

describe("runCheck", () => {
  const failTs = defineCheck({
    name: "fail-ts",
    files: ["**/*.ts"],
    run: async () => checkFail("fail-ts: nope"),
  });

  it("reports inactive when conditions don't match", async () => {
    expect(await runCheck(failTs, bashTool("ls"))).toEqual({
      active: false,
      failed: false,
      message: null,
    });
  });

  it("reports failed with message when active and run() fails", async () => {
    const r = await runCheck(failTs, writeTool("/x/a.ts"));
    expect(r.active).toBe(true);
    expect(r.failed).toBe(true);
    expect(r.message).toContain("fail-ts");
  });

  it("reports passing when active and run() is ok", async () => {
    const okAll = defineCheck({ name: "ok", run: async () => checkOk() });
    expect(await runCheck(okAll, writeTool("/x/a.ts"))).toEqual({
      active: true,
      failed: false,
      message: null,
    });
  });
});
