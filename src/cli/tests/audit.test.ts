import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  attemptWrite,
  expectedFor,
  isInsideClaudeCode,
  readHarnessHookCommand,
} from "../audit";

describe("isInsideClaudeCode", () => {
  afterEach(() => {
    delete process.env.CLAUDECODE;
  });
  it("is true only when CLAUDECODE=1", () => {
    process.env.CLAUDECODE = "1";
    expect(isInsideClaudeCode()).toBe(true);
  });
  it("is false when unset", () => {
    delete process.env.CLAUDECODE;
    expect(isInsideClaudeCode()).toBe(false);
  });
});

describe("readHarnessHookCommand", () => {
  it("returns the PreToolUse command carrying the harness marker", () => {
    const settings = {
      hooks: {
        PreToolUse: [
          { hooks: [{ command: "echo user-hook" }] },
          {
            hooks: [
              {
                command:
                  "npx --no-install tsx $CLAUDE_PROJECT_DIR/node_modules/agent-harness-sdk/dist/hooks/pre-tool-use.js",
              },
            ],
          },
        ],
      },
    };
    expect(readHarnessHookCommand(settings)).toContain(
      "agent-harness-sdk/dist/hooks/",
    );
  });

  it("does not intercept an unrelated user hook with the same file name", () => {
    const settings = {
      hooks: {
        PreToolUse: [
          { hooks: [{ command: "tsx ./hooks/pre-tool-use.ts" }] },
        ],
      },
    };
    expect(readHarnessHookCommand(settings)).toBeNull();
  });

  it("returns null when no harness hook is wired", () => {
    expect(readHarnessHookCommand({ hooks: { PreToolUse: [] } })).toBeNull();
    expect(readHarnessHookCommand({})).toBeNull();
  });
});

describe("expectedFor", () => {
  it("fs-wall: writable at levels 0-1, blocked at 2-3", () => {
    expect(expectedFor("fs-wall", 0)).toBe("wrote");
    expect(expectedFor("fs-wall", 1)).toBe("wrote");
    expect(expectedFor("fs-wall", 2)).toBe("blocked");
    expect(expectedFor("fs-wall", 3)).toBe("blocked");
  });
  it("guard: inert at level 0, denies at 1+", () => {
    expect(expectedFor("guard", 0)).toBe("allowed");
    expect(expectedFor("guard", 1)).toBe("denied");
    expect(expectedFor("guard", 2)).toBe("denied");
  });
});

describe("attemptWrite", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "audit-write-"));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("returns 'wrote' for a writable target", () => {
    expect(attemptWrite(join(dir, "probe"))).toBe("wrote");
  });
});
