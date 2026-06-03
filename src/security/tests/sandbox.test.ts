import { describe, expect, it } from "vitest";
import {
  HARNESS_DENY_WRITE,
  HARNESS_PERMISSION_DENY,
  addHarnessSandbox,
  hasHarnessSandbox,
  removeHarnessSandbox,
} from "../sandbox";

describe("addHarnessSandbox", () => {
  it("enables the sandbox and adds our denyWrite + permission deny rules", () => {
    const out = addHarnessSandbox({});
    expect(out.sandbox?.enabled).toBe(true);
    expect(out.sandbox?.filesystem?.denyWrite).toEqual(HARNESS_DENY_WRITE);
    expect(out.permissions?.deny).toEqual(HARNESS_PERMISSION_DENY);
  });

  it("preserves the user's existing denyWrite and permission deny entries", () => {
    const out = addHarnessSandbox({
      sandbox: { enabled: true, filesystem: { denyWrite: ["/etc/**"] } },
      permissions: { deny: ["Read(~/.ssh)"] },
    });
    expect(out.sandbox?.filesystem?.denyWrite).toEqual([
      "/etc/**",
      ...HARNESS_DENY_WRITE,
    ]);
    expect(out.permissions?.deny).toEqual(["Read(~/.ssh)", ...HARNESS_PERMISSION_DENY]);
  });

  it("is idempotent — adding twice does not duplicate entries", () => {
    const once = addHarnessSandbox({});
    const twice = addHarnessSandbox(once);
    expect(twice.sandbox?.filesystem?.denyWrite).toEqual(HARNESS_DENY_WRITE);
    expect(twice.permissions?.deny).toEqual(HARNESS_PERMISSION_DENY);
  });

  it("does not mutate the input object", () => {
    const input = {};
    addHarnessSandbox(input);
    expect(input).toEqual({});
  });
});

describe("removeHarnessSandbox", () => {
  it("removes our entries while keeping the user's", () => {
    const added = addHarnessSandbox({
      sandbox: { enabled: true, filesystem: { denyWrite: ["/etc/**"] } },
      permissions: { deny: ["Read(~/.ssh)"] },
    });
    const out = removeHarnessSandbox(added);
    expect(out.sandbox?.filesystem?.denyWrite).toEqual(["/etc/**"]);
    expect(out.permissions?.deny).toEqual(["Read(~/.ssh)"]);
  });

  it("cleans up empty containers it created — including the sandbox block", () => {
    const out = removeHarnessSandbox(addHarnessSandbox({}));
    // a downgrade fully disables the sandbox, not just our denyWrite
    expect(out.sandbox).toBeUndefined();
    expect(out.permissions?.deny).toBeUndefined();
  });

  it("keeps the sandbox block when the user has their own filesystem rules", () => {
    const out = removeHarnessSandbox(
      addHarnessSandbox({
        sandbox: { enabled: true, filesystem: { denyWrite: ["/etc/**"] } },
      }),
    );
    expect(out.sandbox?.filesystem?.denyWrite).toEqual(["/etc/**"]);
  });

  it("fully removes a block written by an older version (superseded **/.env pattern)", () => {
    // Simulates `security 2` on an old SDK, then `security 0` after the
    // .env → .env.agents change: the legacy entries must still be stripped.
    const legacy = {
      sandbox: {
        enabled: true,
        filesystem: {
          denyWrite: ["harness/**", "**/.env", ".claude/settings.json"],
        },
      },
      permissions: { deny: ["Edit(harness/**)", "Write(harness/**)", "Edit(**/.env)"] },
    };
    expect(hasHarnessSandbox(legacy)).toBe(true); // detected via stable anchors
    const out = removeHarnessSandbox(legacy);
    expect(out.sandbox).toBeUndefined();
    expect(out.permissions?.deny).toBeUndefined();
  });

  it("is a no-op when our entries aren't present", () => {
    const before = { permissions: { allow: ["Bash(npm:*)"] } };
    expect(removeHarnessSandbox(before)).toEqual(before);
  });
});

describe("hasHarnessSandbox", () => {
  it("is true once added, false after removal", () => {
    expect(hasHarnessSandbox({})).toBe(false);
    const added = addHarnessSandbox({});
    expect(hasHarnessSandbox(added)).toBe(true);
    expect(hasHarnessSandbox(removeHarnessSandbox(added))).toBe(false);
  });
});
