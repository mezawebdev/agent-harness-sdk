import { closeSync, openSync } from "node:fs";
import { parse } from "dotenv";
import { hasHarnessSandbox } from "./sandbox-protection";

/** The flag (in `.env`) that expresses Level 0 / the in-session unlock. */
export const UNLOCK = "HARNESS_UNLOCK";

type Settings = Record<string, unknown>;

/** Derive the current level from observable state: `HARNESS_UNLOCK` truthy in
 *  `.env` → 0; harness sandbox block present → 2; otherwise → 1. (Level 3 is OS
 *  state, reported separately via {@link probeWriteBlocked}.) */
export function deriveLevel(state: { env: string; settings: Settings }): 0 | 1 | 2 {
  const unlock = parse(state.env)[UNLOCK]?.trim().toLowerCase();
  if (unlock && unlock !== "0" && unlock !== "false") return 0;
  if (hasHarnessSandbox(state.settings)) return 2;
  return 1;
}

/** Whether the OS refuses writes to `file` (immutable bit / ownership). Opens
 *  for append without writing, so it never mutates the file. */
export function probeWriteBlocked(file: string): boolean {
  try {
    closeSync(openSync(file, "a"));
    return false;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return code === "EPERM" || code === "EACCES" || code === "EROFS";
  }
}
