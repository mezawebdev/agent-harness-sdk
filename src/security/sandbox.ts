/**
 * Security Level 2: OS-enforced read-only protection of the harness surface,
 * written into `.claude/settings.json`. `denyWrite` blocks Bash subprocesses
 * (the vector the in-process guard can't cover); `permissions.deny` blocks the
 * Edit/Write tools (the sandbox covers only Bash). These edit the settings
 * object purely (in → out), merge idempotently, and remove only our entries. A
 * downgrade strips our denyWrite/permissions (current *and* superseded) and drops
 * the whole `sandbox` block when nothing but the `enabled` flag we set remains.
 */

/** Paths the harness marks read-only at the OS level (sandbox `denyWrite`).
 *  Only the harness surface — `.env.agents` is the unlock file; the app's own
 *  `.env` is left to the opt-in `protect-env-files` guard. */
export const HARNESS_DENY_WRITE = [
  "harness/**",
  "**/.env.agents",
  ".claude/settings.json",
];

/** Claude Code permission deny rules covering the file tools (sandbox covers
 *  only Bash). */
export const HARNESS_PERMISSION_DENY = [
  "Edit(harness/**)",
  "Write(harness/**)",
  "Edit(**/.env.agents)",
  "Write(**/.env.agents)",
];

/** Patterns earlier versions wrote that current ones no longer do. A downgrade
 *  strips these too, so a Level-2 block written before HARNESS_DENY_WRITE changed
 *  (e.g. the `.env` → `.env.agents` move) is still fully cleared. Append here
 *  whenever a pattern above is renamed or dropped. */
const LEGACY_DENY_WRITE = ["**/.env"];
const LEGACY_PERMISSION_DENY = ["Edit(**/.env)"];

/** The entries present in *every* version's harness block — the env pattern is
 *  the only one that has ever changed — so detection keys off these and survives
 *  list changes. */
const HARNESS_SANDBOX_ANCHORS = ["harness/**", ".claude/settings.json"];

type Settings = {
  sandbox?: {
    enabled?: boolean;
    filesystem?: { denyWrite?: string[]; [k: string]: unknown };
    [k: string]: unknown;
  };
  permissions?: { deny?: string[]; [k: string]: unknown };
  [k: string]: unknown;
};

const union = (existing: string[] = [], ours: string[]): string[] => [
  ...existing,
  ...ours.filter((p) => !existing.includes(p)),
];

const without = (existing: string[] = [], ours: string[]): string[] =>
  existing.filter((p) => !ours.includes(p));

/** Add the harness sandbox + permission deny rules (Level 2). Idempotent;
 *  does not mutate the input. */
export function addHarnessSandbox(settings: Settings): Settings {
  const next: Settings = structuredClone(settings);
  const sandbox = next.sandbox ?? {};
  const filesystem = sandbox.filesystem ?? {};
  filesystem.denyWrite = union(filesystem.denyWrite, HARNESS_DENY_WRITE);
  sandbox.filesystem = filesystem;
  sandbox.enabled = true;
  next.sandbox = sandbox;

  const permissions = next.permissions ?? {};
  permissions.deny = union(permissions.deny, HARNESS_PERMISSION_DENY);
  next.permissions = permissions;

  return next;
}

/** Remove the harness sandbox + permission deny rules (current and superseded),
 *  keeping the user's other entries and tidying up the containers we created —
 *  including the `sandbox` object itself when only our `enabled` flag is left, so
 *  a downgrade to Level 0/1 fully disables the sandbox. */
export function removeHarnessSandbox(settings: Settings): Settings {
  const next: Settings = structuredClone(settings);

  const sandbox = next.sandbox;
  const filesystem = sandbox?.filesystem;
  if (sandbox && filesystem?.denyWrite) {
    const denyWrite = without(filesystem.denyWrite, [
      ...HARNESS_DENY_WRITE,
      ...LEGACY_DENY_WRITE,
    ]);
    if (denyWrite.length > 0) {
      filesystem.denyWrite = denyWrite;
    } else {
      delete filesystem.denyWrite;
      if (Object.keys(filesystem).length === 0) delete sandbox.filesystem;
      // Drop the sandbox block entirely if all that remains is the `enabled`
      // flag we set — otherwise the OS sandbox stays on after a downgrade.
      const keys = Object.keys(sandbox);
      if (keys.length === 0 || (keys.length === 1 && keys[0] === "enabled")) {
        delete next.sandbox;
      }
    }
  }

  if (next.permissions?.deny) {
    const deny = without(next.permissions.deny, [
      ...HARNESS_PERMISSION_DENY,
      ...LEGACY_PERMISSION_DENY,
    ]);
    if (deny.length > 0) next.permissions.deny = deny;
    else delete next.permissions.deny;
    if (next.permissions && Object.keys(next.permissions).length === 0) {
      delete next.permissions;
    }
  }

  return next;
}

/** Whether the harness sandbox protection is present (used to derive the level).
 *  Keys off the stable anchors, so a block written by an older version — with a
 *  superseded env pattern — is still recognized (and thus removable). */
export function hasHarnessSandbox(settings: Settings): boolean {
  const denyWrite = settings.sandbox?.filesystem?.denyWrite ?? [];
  return HARNESS_SANDBOX_ANCHORS.every((p) => denyWrite.includes(p));
}
