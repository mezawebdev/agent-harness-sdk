import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { Check, Guard, Tool } from "../../types";
import type { HarnessConfig } from "../../define";
import { validateCheck, validateGuard, validateTool, auditPrimitives } from "../audit";
import type { DiscoveredFile } from "../audit";

describe("validateGuard", () => {
  it("passes a well-formed guard", () => {
    const g: Guard = {
      name: "protect-env-files",
      tools: ["Write", "Edit"],
      run: async () => ({ allow: true }),
    };
    expect(validateGuard(g)).toEqual({ passed: true, issues: [] });
  });

  it("fails when name is missing", () => {
    const g = { run: async () => ({ allow: true }) } as unknown as Guard;
    const r = validateGuard(g);
    expect(r.passed).toBe(false);
    expect(r.issues.join(" ")).toContain("name");
  });
});

describe("validateCheck", () => {
  it("passes a well-formed check", () => {
    const c: Check = {
      name: "validate-services",
      files: ["**/services/*.ts"],
      run: async () => ({ ok: true }),
    };
    expect(validateCheck(c)).toEqual({ passed: true, issues: [] });
  });

  it("fails when name is missing/empty", () => {
    const c = { name: "", run: async () => ({ ok: true }) } as unknown as Check;
    const r = validateCheck(c);
    expect(r.passed).toBe(false);
    expect(r.issues.join(" ")).toContain("name");
  });
});

describe("validateTool", () => {
  it("passes a well-formed tool", () => {
    const t: Tool = {
      name: "fetch_weather",
      config: { description: "d", inputSchema: { city: z.string() } },
      handler: async () => ({ content: [{ type: "text", text: "{}" }] }),
    };
    expect(validateTool(t)).toEqual({ passed: true, issues: [] });
  });

  it("fails on non-snake_case name", () => {
    const t: Tool = {
      name: "fetchWeather",
      config: { description: "d" },
      handler: async () => ({ content: [{ type: "text", text: "{}" }] }),
    };
    const r = validateTool(t);
    expect(r.passed).toBe(false);
    expect(r.issues.join(" ")).toContain("snake_case");
  });

  it("fails when name is empty", () => {
    const t = {
      name: "",
      config: { description: "d" },
      handler: async () => ({ content: [{ type: "text", text: "{}" }] }),
    } as unknown as Tool;
    const r = validateTool(t);
    expect(r.passed).toBe(false);
    expect(r.issues.join(" ")).toContain("snake_case");
  });
});

describe("auditPrimitives", () => {
  const guard: Guard = {
    name: "protect-env-files",
    tools: ["Write"],
    when: () => true,
    run: async () => ({ allow: true }),
  };
  const config: HarnessConfig = { guards: [guard], checks: [], tools: [] };

  it("reports one entry per registered primitive with structural result", () => {
    const inv = auditPrimitives(config, []);
    expect(inv.primitives).toHaveLength(1);
    expect(inv.primitives[0]).toMatchObject({
      type: "guard",
      name: "protect-env-files",
      structural: { passed: true, issues: [] },
    });
  });

  it("summarizes conditions (tools, files, hasWhen)", () => {
    const inv = auditPrimitives(config, []);
    expect(inv.primitives[0].conditions).toEqual({
      tools: ["Write"],
      hasWhen: true,
    });
  });

  it("flags a discovered local file whose primitive is not registered", () => {
    const inv = auditPrimitives(config, [
      { type: "guard", name: "protect-env-files", file: "harness/guards/protect-env-files.ts" },
      { type: "guard", name: "block-pushes", file: "harness/guards/block-pushes.ts" },
    ]);
    expect(inv.drift.unregistered).toEqual([
      { type: "guard", name: "block-pushes", file: "harness/guards/block-pushes.ts" },
    ]);
  });

  it("does not flag drift for a discovered file that is registered", () => {
    const inv = auditPrimitives(config, [
      { type: "guard", name: "protect-env-files", file: "harness/guards/protect-env-files.ts" },
    ]);
    expect(inv.drift.unregistered).toEqual([]);
  });

  it("returns empty inventory for an empty config", () => {
    expect(auditPrimitives({}, [])).toEqual({
      primitives: [],
      drift: { unregistered: [] },
      unloadable: [],
    });
  });

  it("drift keys on type, not just name", () => {
    const inv = auditPrimitives(config, [
      { type: "check", name: "protect-env-files", file: "harness/checks/protect-env-files.ts" },
    ]);
    expect(inv.drift.unregistered).toEqual([
      { type: "check", name: "protect-env-files", file: "harness/checks/protect-env-files.ts" },
    ]);
  });

  it("attaches file to primitive report when discovered entry matches", () => {
    const discovered: DiscoveredFile[] = [
      { type: "guard", name: "protect-env-files", file: "harness/guards/g1.ts" },
    ];
    const inv = auditPrimitives(config, discovered);
    expect(inv.primitives[0].file).toBe("harness/guards/g1.ts");
  });

  it("leaves file undefined for a library-style primitive with no discovered match", () => {
    const inv = auditPrimitives(config, []);
    expect(inv.primitives[0].file).toBeUndefined();
  });

  it("returns unloadable array passed in from caller", () => {
    const inv = auditPrimitives({}, [], [{ file: "harness/guards/bad.ts", error: "boom" }]);
    expect(inv.unloadable).toEqual([{ file: "harness/guards/bad.ts", error: "boom" }]);
  });

  it("returns empty unloadable when called with 2 args", () => {
    const inv = auditPrimitives({}, []);
    expect(inv.unloadable).toEqual([]);
  });
});

