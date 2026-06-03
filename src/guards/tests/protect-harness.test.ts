import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { bashTool, editTool, runGuard, tool, writeTool } from "../../testing";
import { protectHarness } from "../protect-harness";

// A settings.json wired with the harness hook command (contains the marker
// "agent-harness-sdk/dist/hooks/"). The guard reads this from disk to decide
// whether a settings.json edit would tamper with the hook wiring.
const WIRED_SETTINGS = {
  hooks: {
    PreToolUse: [
      {
        matcher: "*",
        hooks: [
          {
            type: "command",
            command:
              "node node_modules/agent-harness-sdk/dist/hooks/pre-tool-use.js",
          },
        ],
      },
    ],
  },
  permissions: { allow: ["Bash(npm:*)"] },
};

let projectDir: string;

beforeAll(() => {
  projectDir = mkdtempSync(join(tmpdir(), "protect-harness-"));
  mkdirSync(join(projectDir, ".claude"), { recursive: true });
  writeFileSync(
    join(projectDir, ".claude/settings.json"),
    `${JSON.stringify(WIRED_SETTINGS, null, 2)}\n`,
  );
});

afterAll(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

// Unlock is read only from the project .env. Write one to unlock; locked is the
// default, so remove it after each test to keep tests independent.
function setUnlock(value: string) {
  writeFileSync(join(projectDir, ".env"), `HARNESS_UNLOCK=${value}\n`);
}
afterEach(() => {
  try {
    unlinkSync(join(projectDir, ".env"));
  } catch {
    // no .env written this test — fine.
  }
});

const at = (rel: string) => join(projectDir, rel);
const run = (input: Parameters<typeof runGuard>[1]) =>
  runGuard(protectHarness, input, { projectDir });

describe("protectHarness — locked (default)", () => {
  it("denies writing harness/harness.config.ts", async () => {
    const result = await run(writeTool(at("harness/harness.config.ts")));
    expect(result.denied).toBe(true);
    expect(result.reason).toContain("protect-harness");
    expect(result.reason).toContain("HARNESS_UNLOCK");
  });

  it("denies editing a guard under harness/", async () => {
    const result = await run(editTool(at("harness/guards/anything.ts")));
    expect(result.denied).toBe(true);
  });

  it("denies writing .env (self-unlock invariant)", async () => {
    const result = await run(writeTool(at(".env")));
    expect(result.denied).toBe(true);
  });

  it("denies a settings.json edit that strips the harness hook", async () => {
    const result = await run(
      tool("Edit", {
        file_path: at(".claude/settings.json"),
        old_string:
          "node node_modules/agent-harness-sdk/dist/hooks/pre-tool-use.js",
        new_string: "echo disabled",
      }),
    );
    expect(result.denied).toBe(true);
  });

  it("allows a settings.json edit to a non-hook section", async () => {
    const result = await run(
      tool("Edit", {
        file_path: at(".claude/settings.json"),
        old_string: "Bash(npm:*)",
        new_string: "Bash(git:*)",
      }),
    );
    expect(result.denied).toBe(false);
  });

  it("does not block ordinary app code", async () => {
    const result = await run(writeTool(at("src/index.ts")));
    expect(result.denied).toBe(false);
  });
});

describe("protectHarness — Bash `harness security` is human-only", () => {
  it("denies the agent invoking `npx harness security`", async () => {
    const result = await run(bashTool("npx harness security 0"));
    expect(result.denied).toBe(true);
    expect(result.reason).toContain("human");
  });

  it("denies other level-change forms", async () => {
    expect((await run(bashTool("harness security 1"))).denied).toBe(true);
    expect(
      (await run(bashTool("npx --no-install harness security 2"))).denied,
    ).toBe(true);
  });

  it("denies running the CLI entry directly (bypassing the `harness` bin)", async () => {
    expect(
      (
        await run(
          bashTool(
            "node node_modules/agent-harness-sdk/dist/cli/index.js security 0",
          ),
        )
      ).denied,
    ).toBe(true);
  });

  it("does not false-positive on grepping for a level string", async () => {
    expect(
      (await run(bashTool('grep -r "security 0" harness/'))).denied,
    ).toBe(false);
  });

  it("allows `harness security audit` (not a level change)", async () => {
    expect((await run(bashTool("npx harness security audit"))).denied).toBe(
      false,
    );
  });

  it("allows the no-arg `harness security` report", async () => {
    expect((await run(bashTool("npx harness security"))).denied).toBe(false);
  });

  it("allows unrelated Bash commands", async () => {
    expect((await run(bashTool("npm test"))).denied).toBe(false);
  });

  it("denies `harness add` while locked (scaffolding is a harness change)", async () => {
    const result = await run(bashTool("npx harness add guard my-guard"));
    expect(result.denied).toBe(true);
    expect(result.reason).toContain("HARNESS_UNLOCK");
  });

  it("denies `harness update` while locked", async () => {
    expect((await run(bashTool("npx harness update"))).denied).toBe(true);
  });

  it("denies the direct-entry add form", async () => {
    expect(
      (
        await run(
          bashTool("node node_modules/agent-harness-sdk/dist/cli/index.js add guard x"),
        )
      ).denied,
    ).toBe(true);
  });

  it("does not false-positive on `git add harness/...`", async () => {
    expect(
      (await run(bashTool("git add harness/guards/foo.ts"))).denied,
    ).toBe(false);
  });

  it("allows `harness add` when unlocked", async () => {
    setUnlock("1");
    expect((await run(bashTool("npx harness add guard my-guard"))).denied).toBe(
      false,
    );
  });

  it("allows `harness security` when the harness is unlocked", async () => {
    setUnlock("1");
    expect((await run(bashTool("npx harness security 0"))).denied).toBe(false);
  });
});

describe("protectHarness — unlocked via project .env (HARNESS_UNLOCK=1)", () => {
  it("allows editing harness files", async () => {
    setUnlock("1");
    const result = await run(writeTool(at("harness/harness.config.ts")));
    expect(result.denied).toBe(false);
  });

  it("allows .env (protect-env-files handles that separately)", async () => {
    setUnlock("1");
    const result = await run(writeTool(at(".env")));
    expect(result.denied).toBe(false);
  });

  it("treats HARNESS_UNLOCK=0 as locked", async () => {
    setUnlock("0");
    const result = await run(writeTool(at("harness/harness.config.ts")));
    expect(result.denied).toBe(true);
  });

  it("ignores an ambient process.env unlock (only the project .env counts)", async () => {
    const prev = process.env.HARNESS_UNLOCK;
    process.env.HARNESS_UNLOCK = "1"; // shell/system env — must NOT unlock
    try {
      const result = await run(writeTool(at("harness/harness.config.ts")));
      expect(result.denied).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.HARNESS_UNLOCK;
      else process.env.HARNESS_UNLOCK = prev;
    }
  });
});
