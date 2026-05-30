/**
 * Security **Level 2** materialization: the OS-enforced read-only protection of
 * the harness surface, expressed as Claude Code sandbox + permission rules in
 * `.claude/settings.json`.
 *
 * - `sandbox.filesystem.denyWrite` → the OS blocks writes at the syscall level
 *   for every Bash subprocess (the vector the in-process guard can't cover).
 * - `permissions.deny` → Claude Code blocks the Edit/Write file tools (the
 *   sandbox only covers Bash subprocesses).
 *
 * These functions edit a settings *object* (pure in → out, no I/O), merging our
 * entries idempotently while preserving the user's. Removal takes out only our
 * entries. Note: removal does **not** flip `sandbox.enabled` back off — fully
 * disabling the sandbox is left to the user (`/sandbox`), since they may rely on
 * it for other reasons.
 */

/** Paths the harness marks read-only at the OS level (sandbox `denyWrite`). */
export const HARNESS_DENY_WRITE = [
  "harness/**",
  "**/.env",
  ".claude/settings.json",
];

/** Claude Code permission deny rules covering the file tools (sandbox covers
 *  only Bash). */
export const HARNESS_PERMISSION_DENY = [
  "Edit(harness/**)",
  "Write(harness/**)",
  "Edit(**/.env)",
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
