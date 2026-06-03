/**
 * Security Level 2: OS-enforced read-only protection of the harness surface,
 * written into `.claude/settings.json`. `denyWrite` blocks Bash subprocesses
 * (the vector the in-process guard can't cover); `permissions.deny` blocks the
 * Edit/Write tools (the sandbox covers only Bash). These edit the settings
 * object purely (in → out), merge idempotently, and remove only our entries —
 * removal leaves `sandbox.enabled` as-is (use `/sandbox` to fully disable).
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

/** Remove the harness sandbox + permission deny rules, keeping the user's other
 *  entries and tidying up empty containers we'd otherwise leave behind. */
export function removeHarnessSandbox(settings: Settings): Settings {
  const next: Settings = structuredClone(settings);

  if (next.sandbox?.filesystem?.denyWrite) {
    const denyWrite = without(next.sandbox.filesystem.denyWrite, HARNESS_DENY_WRITE);
    if (denyWrite.length > 0) next.sandbox.filesystem.denyWrite = denyWrite;
    else delete next.sandbox.filesystem.denyWrite;
    if (Object.keys(next.sandbox.filesystem).length === 0) delete next.sandbox.filesystem;
  }

  if (next.permissions?.deny) {
    const deny = without(next.permissions.deny, HARNESS_PERMISSION_DENY);
    if (deny.length > 0) next.permissions.deny = deny;
    else delete next.permissions.deny;
    if (Object.keys(next.permissions).length === 0) delete next.permissions;
  }

  return next;
}

/** Whether the harness sandbox protection is present (used to derive the level). */
export function hasHarnessSandbox(settings: Settings): boolean {
  const denyWrite = settings.sandbox?.filesystem?.denyWrite ?? [];
  return HARNESS_DENY_WRITE.every((p) => denyWrite.includes(p));
}
