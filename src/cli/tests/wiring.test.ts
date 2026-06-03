import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HARNESS_HOOK_MARKER } from "../merge-config";
import { installWiring } from "../wiring";

type HookCommand = { type?: string; command?: string };
type HookEntry = { matcher?: string; hooks?: HookCommand[] };
type Settings = {
  hooks?: Record<string, HookEntry[]>;
  sandbox?: { enabled?: boolean; filesystem?: { denyWrite?: string[] } };
  permissions?: { deny?: string[] };
};

describe("installWiring", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "harness-wiring-"));
    mkdirSync(join(dir, ".claude"), { recursive: true });
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const settingsPath = () => join(dir, ".claude/settings.json");
  const readSettings = (): Settings =>
    JSON.parse(readFileSync(settingsPath(), "utf-8"));
  const isHarnessEntry = (e: HookEntry): boolean =>
    e.hooks?.some((h) => h.command?.includes(HARNESS_HOOK_MARKER)) ?? false;

  it("writes harness hooks into a fresh project", () => {
    const out = installWiring(dir);
    expect(out.settings).toBe("updated");
    expect((readSettings().hooks?.PreToolUse ?? []).some(isHarnessEntry)).toBe(
      true,
    );
  });

  it("refreshes a stale harness entry while preserving user hooks + the security level config", () => {
    // A project initialised on an older SDK: the harness PreToolUse matcher
    // predates the Bash fix, and the user has their own hook + a Level-2 block.
    writeFileSync(
      settingsPath(),
      `${JSON.stringify(
        {
          hooks: {
            PreToolUse: [
              {
                matcher: "Bash",
                hooks: [{ type: "command", command: "my-own-hook" }],
              },
              {
                matcher: "Edit|Write|MultiEdit",
                hooks: [
                  {
                    type: "command",
                    command:
                      "npx --no-install tsx node_modules/agent-harness-sdk/dist/hooks/pre-tool-use.js",
                  },
                ],
              },
            ],
          },
          sandbox: { enabled: true, filesystem: { denyWrite: ["harness/**"] } },
          permissions: { deny: ["Edit(harness/**)"] },
        },
        null,
        2,
      )}\n`,
    );

    const out = installWiring(dir);
    expect(out.settings).toBe("updated");

    const s = readSettings();
    const pre = s.hooks?.PreToolUse ?? [];
    // the user's own hook is preserved
    expect(
      pre.some((e) => e.hooks?.some((h) => h.command === "my-own-hook")),
    ).toBe(true);
    // the harness entry is refreshed to the current matcher (now includes Bash)
    expect(pre.find(isHarnessEntry)?.matcher).toBe("Edit|Write|MultiEdit|Bash");
    // the human-set security level config is left untouched
    expect(s.sandbox?.enabled).toBe(true);
    expect(s.permissions?.deny).toEqual(["Edit(harness/**)"]);
  });

  it("is idempotent — a second run reports unchanged", () => {
    installWiring(dir);
    const out = installWiring(dir);
    expect(out.settings).toBe("unchanged");
    expect(out.mcp).toBe("unchanged");
  });

  it("leaves wiring untouched in the SDK's own repo (so `update` there refreshes docs without duplicating hooks)", () => {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "agent-harness-sdk" }),
    );
    const out = installWiring(dir);
    expect(out).toEqual({ settings: "unchanged", mcp: "unchanged" });
    // it must not have written settings.json
    expect(existsSync(settingsPath())).toBe(false);
  });
});
