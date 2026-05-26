import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runGuard, writeTool } from "../../../src/testing";
import { protectManagedClaudeFiles } from "../protect-managed-claude-files";

// The guard reads harness/harness.lock under the project dir, so each test gets
// a throwaway project dir with a lock that tracks one file. `runGuard`'s
// projectDir option points the guard at it — no env juggling.
let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "harness-guard-"));
  mkdirSync(join(root, "harness"), { recursive: true });
  writeFileSync(
    join(root, "harness", "harness.lock"),
    JSON.stringify({
      sdkVersion: "0.0.0",
      files: { ".claude/rules/harness.md": { sourceVersion: "0.0.0", checksum: "x" } },
    }),
  );
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("protectManagedClaudeFiles", () => {
  it("denies editing a file tracked in harness.lock", async () => {
    const result = await runGuard(
      protectManagedClaudeFiles,
      writeTool(join(root, ".claude/rules/harness.md")),
      { projectDir: root },
    );
    expect(result.denied).toBe(true);
    expect(result.reason).toContain("protect-managed-claude-files");
    expect(result.reason).toContain(".claude/rules/harness.md");
  });

  it("allows editing an unmanaged .claude file (not in the lock)", async () => {
    const result = await runGuard(
      protectManagedClaudeFiles,
      writeTool(join(root, ".claude/settings.json")),
      { projectDir: root },
    );
    expect(result.denied).toBe(false);
  });
});
