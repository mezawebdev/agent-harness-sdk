import { runCheck, runGuard } from "../testing";
import type { HarnessConfig } from "../define";
import type { HookInput } from "../types";

export type TriggerOutput =
  | { type: "guard"; active: boolean; denied: boolean; reason: string | null }
  | { type: "check"; active: boolean; failed: boolean; message: string | null };

/** Run one guard or check through the real activation + run() pipeline against
 *  a synthetic hook input. Never performs the underlying tool action. */
export async function triggerPrimitive(
  config: HarnessConfig,
  type: "guard" | "check",
  name: string,
  input: HookInput,
): Promise<TriggerOutput> {
  if (type === "guard") {
    const guard = (config.guards ?? []).find((g) => g.name === name);
    if (!guard) throw new Error(`guard "${name}" is not registered`);
    const r = await runGuard(guard, input);
    return { type: "guard", active: r.active, denied: r.denied, reason: r.reason };
  }
  const check = (config.checks ?? []).find((c) => c.name === name);
  if (!check) throw new Error(`check "${name}" is not registered`);
  const r = await runCheck(check, input);
  return { type: "check", active: r.active, failed: r.failed, message: r.message };
}
