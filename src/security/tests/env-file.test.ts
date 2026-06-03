import { describe, expect, it } from "vitest";
import { removeEnvLine, upsertEnvLine } from "../env-file";

describe("upsertEnvLine", () => {
  it("adds the key to empty content", () => {
    expect(upsertEnvLine("", "HARNESS_UNLOCK", "1")).toBe("HARNESS_UNLOCK=1\n");
  });

  it("appends to existing content, preserving other lines", () => {
    const before = "FOO=bar\nBAZ=qux\n";
    expect(upsertEnvLine(before, "HARNESS_UNLOCK", "1")).toBe(
      "FOO=bar\nBAZ=qux\nHARNESS_UNLOCK=1\n",
    );
  });

  it("appends a trailing newline when the file lacks one", () => {
    expect(upsertEnvLine("FOO=bar", "HARNESS_UNLOCK", "1")).toBe(
      "FOO=bar\nHARNESS_UNLOCK=1\n",
    );
  });

  it("replaces an existing value in place", () => {
    const before = "FOO=bar\nHARNESS_UNLOCK=0\nBAZ=qux\n";
    expect(upsertEnvLine(before, "HARNESS_UNLOCK", "1")).toBe(
      "FOO=bar\nHARNESS_UNLOCK=1\nBAZ=qux\n",
    );
  });

  it("does not clobber a similarly-named key", () => {
    const before = "MY_HARNESS_UNLOCK=0\n";
    expect(upsertEnvLine(before, "HARNESS_UNLOCK", "1")).toBe(
      "MY_HARNESS_UNLOCK=0\nHARNESS_UNLOCK=1\n",
    );
  });
});

describe("removeEnvLine", () => {
  it("removes the line when present", () => {
    const before = "FOO=bar\nHARNESS_UNLOCK=1\nBAZ=qux\n";
    expect(removeEnvLine(before, "HARNESS_UNLOCK")).toBe("FOO=bar\nBAZ=qux\n");
  });

  it("is a no-op when the key is absent", () => {
    const before = "FOO=bar\nBAZ=qux\n";
    expect(removeEnvLine(before, "HARNESS_UNLOCK")).toBe(before);
  });

  it("leaves a commented-out line alone", () => {
    const before = "# HARNESS_UNLOCK=1\nFOO=bar\n";
    expect(removeEnvLine(before, "HARNESS_UNLOCK")).toBe(before);
  });

  it("leaves a comment with no space after # alone", () => {
    const before = "#HARNESS_UNLOCK=1\nFOO=bar\n";
    expect(removeEnvLine(before, "HARNESS_UNLOCK")).toBe(before);
  });

  it("does not remove a similarly-named key", () => {
    const before = "MY_HARNESS_UNLOCK=1\n";
    expect(removeEnvLine(before, "HARNESS_UNLOCK")).toBe(before);
  });
});
