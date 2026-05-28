import { describe, expect, it } from "vitest";
import type { HarnessConfig } from "../../define";
import type { Check, Guard } from "../../types";
import { tool } from "../../testing";
import { triggerPrimitive } from "../trigger";

const denyEnv: Guard = {
  name: "protect-env-files",
  tools: ["Write"],
  files: ["**/.env"],
  run: async () => ({ allow: false, reason: "blocked by protect-env-files" }),
};

const failService: Check = {
  name: "validate-services",
  files: ["**/services/*.ts"],
  run: async () => ({ ok: false, message: "lint error" }),
};

const config: HarnessConfig = { guards: [denyEnv], checks: [failService], tools: [] };

describe("triggerPrimitive", () => {
  it("runs a guard and reports a deny", async () => {
    const out = await triggerPrimitive(
      config,
      "guard",
      "protect-env-files",
      tool("Write", { file_path: "/repo/.env" }),
    );
    expect(out).toEqual({
      type: "guard",
      active: true,
      denied: true,
      reason: "blocked by protect-env-files",
    });
  });

  it("reports a guard as inactive when conditions do not match", async () => {
    const out = await triggerPrimitive(
      config,
      "guard",
      "protect-env-files",
      tool("Write", { file_path: "/repo/README.md" }),
    );
    expect(out).toMatchObject({ type: "guard", active: false, denied: false });
  });

  it("runs a check and reports a failure", async () => {
    const out = await triggerPrimitive(
      config,
      "check",
      "validate-services",
      tool("Edit", { file_path: "/repo/src/services/x.ts" }),
    );
    expect(out).toEqual({
      type: "check",
      active: true,
      failed: true,
      message: "lint error",
    });
  });

  it("throws when the primitive name is not registered", async () => {
    await expect(
      triggerPrimitive(config, "guard", "nope", tool("Write", { file_path: "/repo/.env" })),
    ).rejects.toThrow(/not registered/);
  });

  it("throws when a check name is not registered", async () => {
    await expect(
      triggerPrimitive(config, "check", "nope", tool("Edit", { file_path: "/repo/src/services/x.ts" })),
    ).rejects.toThrow(/not registered/);
  });
});
