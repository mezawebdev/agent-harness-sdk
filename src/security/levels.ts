import { parse } from "dotenv";
import { hasHarnessSandbox } from "./sandbox";

/** The flag (in `.env.agents`) that expresses Level 0 / the in-session unlock. */
export const UNLOCK = "HARNESS_UNLOCK";

type Settings = Record<string, unknown>;

/** Derive the active level from observable state: `HARNESS_UNLOCK` truthy in
 *  `.env.agents` → 0; harness sandbox block present → 2; otherwise → 1. (Level 3
 *  is OS state, detected separately by a write probe.) */
export function deriveLevel(state: { env: string; settings: Settings }): 0 | 1 | 2 {
  const unlock = parse(state.env)[UNLOCK]?.trim().toLowerCase();
  if (unlock && unlock !== "0" && unlock !== "false") return 0;
  if (hasHarnessSandbox(state.settings)) return 2;
  return 1;
}

/** A kind of audit check, and the outcome a probe can observe. */
export type VectorKind = "fs-wall" | "guard";
export type Observed = "wrote" | "blocked" | "allowed" | "denied" | "error";

/** What outcome each level expects for a given check kind. fs-wall: writable at
 *  0-1 (no OS wall), blocked at 2-3. guard: inert at 0, denies at 1+. */
export function expectedFor(kind: VectorKind, level: number): Observed {
  if (kind === "fs-wall") return level >= 2 ? "blocked" : "wrote";
  return level === 0 ? "allowed" : "denied";
}
