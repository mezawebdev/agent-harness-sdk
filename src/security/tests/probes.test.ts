import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  attemptWrite,
  attemptWriteReversible,
  guardVerdict,
  isInsideClaudeCode,
  probeWrite,
  probeWriteBlocked,
  readHarnessHookCommand,
} from "../probes";

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

describe("guardVerdict (in-process, no subprocess)", () => {
  let proj: string;
  const prev = process.env.CLAUDE_PROJECT_DIR;
  beforeAll(() => {
    proj = mkdtempSync(join(tmpdir(), "audit-guard-"));
    process.env.CLAUDE_PROJECT_DIR = proj; // locked: no .env present
  });
  afterAll(() => {
    if (prev === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = prev;
    rmSync(proj, { recursive: true, force: true });
  });

  it("denies an Edit to a harness file (locked)", async () => {
    expect(
      await guardVerdict({
        tool_name: "Edit",
        tool_input: { file_path: join(proj, "harness/harness.config.ts") },
      }),
    ).toBe("denied");
  });

  it("allows ordinary app code", async () => {
    expect(
      await guardVerdict({
        tool_name: "Edit",
        tool_input: { file_path: join(proj, "src/index.ts") },
      }),
    ).toBe("allowed");
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

  it("returns 'blocked' (never throws) when the write is denied", () => {
    const f = join(dir, "ro.txt");
    writeFileSync(f, "orig");
    chmodSync(f, 0o444); // read-only → write denied, like the Level 2 sandbox
    try {
      expect(() => attemptWrite(f)).not.toThrow();
      expect(attemptWrite(f)).toBe("blocked");
    } finally {
      chmodSync(f, 0o644);
    }
  });

  it("reversible: a blocked write doesn't throw and leaves the file untouched", () => {
    const f = join(dir, "ro-reversible.txt");
    writeFileSync(f, "orig");
    chmodSync(f, 0o444);
    try {
      expect(attemptWriteReversible(f).result).toBe("blocked");
    } finally {
      chmodSync(f, 0o644);
    }
    expect(readFileSync(f, "utf-8")).toBe("orig");
  });

  it("captures the OS error code on a blocked write (proves it's the kernel)", () => {
    const f = join(dir, "ro-code.txt");
    writeFileSync(f, "orig");
    chmodSync(f, 0o444);
    try {
      const probe = probeWrite(f);
      expect(probe.result).toBe("blocked");
      expect(probe.code).toMatch(/^E[A-Z]+$/); // e.g. EACCES / EPERM / EROFS
    } finally {
      chmodSync(f, 0o644);
    }
  });
});

describe("probeWriteBlocked", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "probe-blocked-"));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("is false for a writable file", () => {
    const f = join(dir, "writable.txt");
    writeFileSync(f, "hi");
    expect(probeWriteBlocked(f)).toBe(false);
  });

  it("is true for a read-only file", () => {
    const f = join(dir, "ro.txt");
    writeFileSync(f, "hi");
    chmodSync(f, 0o444);
    try {
      expect(probeWriteBlocked(f)).toBe(true);
    } finally {
      chmodSync(f, 0o644);
    }
  });
});
