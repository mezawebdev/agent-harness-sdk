import { describe, expect, it } from "vitest";
import { runGuard, writeTool } from "../../testing";
import { protectEnvFiles } from "../protect-env-files";

describe("protectEnvFiles", () => {
  it("denies writing a .env file, with a name-prefixed reason", async () => {
    const result = await runGuard(protectEnvFiles, writeTool("/repo/.env"));
    expect(result.denied).toBe(true);
    expect(result.reason).toContain("protect-env-files");
  });

  it("does not fire on a non-env file", async () => {
    const result = await runGuard(protectEnvFiles, writeTool("/repo/src/index.ts"));
    expect(result.active).toBe(false);
    expect(result.denied).toBe(false);
  });
});
