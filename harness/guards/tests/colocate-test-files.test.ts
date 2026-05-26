import { describe, expect, it } from "vitest";
import { runGuard, writeTool } from "../../../src/testing";
import { colocateTestFiles } from "../colocate-test-files";

describe("colocateTestFiles", () => {
  it("allows a test file already inside a tests/ directory", async () => {
    const result = await runGuard(
      colocateTestFiles,
      writeTool("/repo/src/hooks/tests/match.test.ts"),
    );
    expect(result.denied).toBe(false);
  });

  it("denies a misplaced test file, with a name-prefixed reason", async () => {
    const result = await runGuard(
      colocateTestFiles,
      writeTool("/repo/src/hooks/match.test.ts"),
    );
    expect(result.denied).toBe(true);
    expect(result.reason).toContain("colocate-test-files");
  });

  it("does not fire on a non-test file", async () => {
    const result = await runGuard(colocateTestFiles, writeTool("/repo/src/hooks/match.ts"));
    expect(result.active).toBe(false);
  });
});
