import { describe, expect, it } from "vitest";
import { shouldRun } from "../conditions";
import { Tools } from "../tool-names";
import type { Conditions } from "../types";

const input = (tool_name?: string, file_path?: string) => ({
  tool_name,
  tool_input: file_path ? { file_path } : undefined,
});

describe("shouldRun", () => {
  it("no conditions → always active", () => {
    expect(shouldRun({}, input("Bash"))).toBe(true);
    expect(shouldRun({}, input())).toBe(true);
  });

  describe("tools", () => {
    const c: Conditions = { tools: [Tools.Edit, Tools.Write] };
    it("matches a listed tool", () => {
      expect(shouldRun(c, input("Edit"))).toBe(true);
      expect(shouldRun(c, input("Write"))).toBe(true);
    });
    it("rejects an unlisted tool", () => {
      expect(shouldRun(c, input("Bash"))).toBe(false);
    });
    it("rejects when tool_name is absent", () => {
      expect(shouldRun(c, input(undefined))).toBe(false);
    });
  });

  describe("files", () => {
    const c: Conditions = { files: ["**/.claude/**", "**/*.env"] };
    it("matches a glob", () => {
      expect(shouldRun(c, input("Write", "/repo/.claude/rules/x.md"))).toBe(true);
      expect(shouldRun(c, input("Write", "/repo/app/.env"))).toBe(true);
    });
    it("rejects a non-matching path", () => {
      expect(shouldRun(c, input("Write", "/repo/src/index.ts"))).toBe(false);
    });
    it("rejects when file_path is absent (e.g. Bash)", () => {
      expect(shouldRun(c, input("Bash"))).toBe(false);
    });
  });

  describe("when", () => {
    it("honors a custom predicate", () => {
      expect(shouldRun({ when: () => true }, input("Bash"))).toBe(true);
      expect(shouldRun({ when: () => false }, input("Bash"))).toBe(false);
    });
  });

  describe("AND across conditions", () => {
    const c: Conditions = {
      tools: [Tools.Write],
      files: ["**/.claude/**"],
      when: (i) => i.tool_name !== "Read",
    };
    it("active only when every condition passes", () => {
      expect(shouldRun(c, input("Write", "/repo/.claude/x.md"))).toBe(true);
    });
    it("inactive when any single condition fails", () => {
      expect(shouldRun(c, input("Edit", "/repo/.claude/x.md"))).toBe(false); // tool
      expect(shouldRun(c, input("Write", "/repo/src/x.ts"))).toBe(false); // file
    });
  });
});
