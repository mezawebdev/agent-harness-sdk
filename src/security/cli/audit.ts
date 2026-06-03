import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  type Observed,
  type VectorKind,
  deriveLevel,
  expectedFor,
} from "../levels";
import {
  type Settings,
  type WriteProbe,
  attemptWriteReversible,
  guardVerdict,
  probeWrite,
  probeWriteBlocked,
  readFileOrNull,
  readHarnessHookCommand,
} from "../probes";

type Finding = {
  label: string;
  kind: VectorKind;
  expected: Observed;
  observed: Observed;
  ok: boolean;
  /** Couldn't test (not a pass or a confirmed failure) — never drives a
   *  "not enforcing" verdict. */
  indeterminate?: boolean;
  note?: string;
};

export async function runAudit(cwd: string): Promise<number> {
  p.intro(pc.cyan("harness security audit"));

  const settingsPath = join(cwd, ".claude", "settings.json");
  const envPath = join(cwd, ".env.agents");
  let settings: Settings = {};
  try {
    settings = JSON.parse(readFileOrNull(settingsPath) ?? "{}") as Settings;
  } catch {
    /* malformed → treat as empty */
  }
  const env = readFileOrNull(envPath) ?? "";

  let level: number = deriveLevel({ env, settings });
  // Promote to 3 only from level 1: a write-block with no sandbox config means
  // the OS itself is hardened (chattr/chown). At level 2 it's just the sandbox.
  if (level === 1 && probeWriteBlocked(join(cwd, "harness", "harness.config.ts"))) {
    level = 3;
  }

  const findings: Finding[] = [];
  const record = (
    label: string,
    kind: VectorKind,
    observed: Observed,
    note?: string,
  ) => {
    const expected = expectedFor(kind, level);
    findings.push({ label, kind, expected, observed, ok: observed === expected, note });
  };

  // Writes issued by this process (not tool calls) → a "blocked" is the OS wall.
  const recordFs = (label: string, w: WriteProbe) =>
    record(
      label,
      "fs-wall",
      w.result,
      w.result === "blocked"
        ? `OS filesystem wall — direct syscall denied${w.code ? ` (${w.code})` : ""}, not a permission rule`
        : undefined,
    );

  const probe = join(cwd, "harness", ".redteam-probe");
  const probeRes = probeWrite(probe);
  if (probeRes.result === "wrote") rmSync(probe, { force: true });
  recordFs("fs write → harness/.redteam-probe", probeRes);

  recordFs(".env.agents write (HARNESS_UNLOCK)", attemptWriteReversible(envPath));
  recordFs("settings.json write", attemptWriteReversible(settingsPath));

  // Guard logic — run in-process (no subprocess; the exact code production runs).
  record(
    "guard logic: Edit(harness/harness.config.ts)",
    "guard",
    await guardVerdict({
      tool_name: "Edit",
      tool_input: { file_path: join(cwd, "harness", "harness.config.ts") },
    }),
  );
  record(
    "guard logic: Bash `harness security 0`",
    "guard",
    await guardVerdict({
      tool_name: "Bash",
      tool_input: { command: "npx harness security 0" },
    }),
  );

  // Wiring check: logic is proven in-process; this confirms the guard is hooked
  // so the live hook would invoke it.
  const hookCmd = readHarnessHookCommand(settings);
  if (!hookCmd) {
    findings.push({
      label: "guard hook wired in settings.json",
      kind: "guard",
      expected: "denied",
      observed: "error",
      ok: false,
      indeterminate: true,
      note:
        "no agent-harness-sdk PreToolUse hook matched in .claude/settings.json — either the guard isn't wired (it wouldn't run in real sessions), " +
        "or it's wired via a non-standard/source path the audit can't detect (e.g. this SDK's own dogfood `src/hooks/…`). " +
        "The guard LOGIC is verified above regardless; confirm the wiring in settings.json.",
    });
  }

  // Integrity: real files restored, probe gone.
  const intact = readFileOrNull(envPath) === (env || null) && !existsSync(probe);

  renderReport(level, findings, intact);
  return findings.every((f) => f.ok) && intact ? 0 : 1;
}

function renderReport(level: number, findings: Finding[], intact: boolean): void {
  const rows = findings.map((f) => {
    const mark = f.ok
      ? pc.green("✔")
      : f.indeterminate
        ? pc.yellow("⚠")
        : pc.red("✗");
    const inlineGap =
      f.ok && f.kind === "fs-wall" && f.observed === "wrote" && level <= 1
        ? pc.dim(" (expected at this level — raise to 2 for an FS wall)")
        : "";
    const extra = f.note ? `\n   ${pc.dim(f.note)}` : "";
    return `${mark} ${f.label}: ${pc.bold(f.observed)} ${pc.dim(`(expected ${f.expected})`)}${inlineGap}${extra}`;
  });

  // An all-blocked pass is the success condition at L2+, not missing tests.
  const fsWall = findings.filter((f) => f.kind === "fs-wall");
  const allFsBlocked = fsWall.length > 0 && fsWall.every((f) => f.observed === "blocked");
  let body = rows.join("\n");
  if (level >= 2 && allFsBlocked) {
    body += `\n\n${pc.green("✔ FS wall held")} — every write probe was denied by the OS. That's the pass condition at level 2+ (the probes can't write, by design).`;
  }
  p.note(body, `Level ${level} — observed vs expected`);

  // Confirmed failures drive the verdict; indeterminate ones are only warnings.
  const failures = findings.filter((f) => !f.ok && !f.indeterminate);
  const indeterminate = findings.filter((f) => f.indeterminate);

  if (!intact) {
    p.outro(pc.red("⚠ integrity check failed — a protected file was not restored. Inspect manually."));
  } else if (failures.length > 0) {
    p.outro(
      pc.red(
        `${failures.length} confirmed failure(s) — your level isn't enforcing as designed. ` +
          "Check: sandbox enabled + bubblewrap installed (Linux)?",
      ),
    );
  } else if (indeterminate.length > 0) {
    p.outro(
      pc.yellow(
        `No confirmed failures — but ${indeterminate.length} check(s) were indeterminate (couldn't verify, not a failure). See the ⚠ notes.`,
      ),
    );
  } else {
    p.outro(pc.green(`Level ${level} is enforcing as designed.`));
  }
}
