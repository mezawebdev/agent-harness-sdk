import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deriveLevel, probeWriteBlocked } from "../security-level";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "harness-security-"));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("probeWriteBlocked", () => {
  it("is false for a normal writable file", () => {
    const f = join(dir, "writable.txt");
    writeFileSync(f, "hi");
    expect(probeWriteBlocked(f)).toBe(false);
  });
});

describe("deriveLevel", () => {
  it("reports 0 when HARNESS_UNLOCK is truthy in .env", () => {
    expect(deriveLevel({ env: "HARNESS_UNLOCK=1\n", settings: {} })).toBe(0);
  });

  it("reports 2 when the sandbox protection block is present", () => {
    const settings = {
      sandbox: { filesystem: { denyWrite: ["harness/**", "**/.env", ".claude/settings.json"] } },
    };
    expect(deriveLevel({ env: "", settings })).toBe(2);
  });

  it("reports 1 by default (locked guard, no sandbox)", () => {
    expect(deriveLevel({ env: "FOO=bar\n", settings: {} })).toBe(1);
  });

  it("treats HARNESS_UNLOCK=0 as not unlocked", () => {
    expect(deriveLevel({ env: "HARNESS_UNLOCK=0\n", settings: {} })).toBe(1);
  });
});
