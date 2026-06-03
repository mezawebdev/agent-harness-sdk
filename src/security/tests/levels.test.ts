import { describe, expect, it } from "vitest";
import { deriveLevel, expectedFor } from "../levels";

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
