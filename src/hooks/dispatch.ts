import { logEvent } from "../observability/log";
import type { Check, Guard } from "../types";
import { block, pass, readHookInput } from "./utils";

/**
 * Reads PreToolUse hook input from stdin, runs all matching guards in parallel,
 * blocks (exit 2) if any deny, otherwise passes (exit 0). Process exits inside.
 * Auto-emits one event per fire to .harness/log.jsonl.
 */
export async function createPreToolUseDispatcher(
  guards: Guard[],
): Promise<never> {
  const start = Date.now();
  const input = readHookInput();
  const filePath = input.tool_input?.file_path;
  const toolName = input.tool_name;

  const active = guards.filter((g) => g.matches(input));
  if (active.length === 0) {
    logEvent("pre-tool-use.passed", {
      tool_name: toolName,
      file_path: filePath,
      active: [],
      duration_ms: Date.now() - start,
    });
    pass();
  }

  const results = await Promise.all(
    active.map(async (g) => ({ g, r: await g.run(input) })),
  );
  const denied = results.filter((x) => !x.r.allow);

  logEvent(denied.length > 0 ? "pre-tool-use.denied" : "pre-tool-use.passed", {
    tool_name: toolName,
    file_path: filePath,
    active: active.map((g) => g.name),
    denied: denied.map((x) => ({
      name: x.g.name,
      reason: (x.r as { allow: false; reason: string }).reason,
    })),
    duration_ms: Date.now() - start,
  });

  if (denied.length > 0) {
    block(
      denied
        .map((x) => (x.r as { allow: false; reason: string }).reason)
        .join("\n\n"),
    );
  }

  pass(`pre-tool-use: ${active.map((x) => x.name).join(", ")} ok`);
}

/**
 * Reads PostToolUse hook input from stdin, runs all matching checks in parallel,
 * blocks (exit 2) if any fail, otherwise passes (exit 0). Process exits inside.
 * Auto-emits one event per fire to .harness/log.jsonl.
 */
export async function createPostToolUseDispatcher(
  checks: Check[],
): Promise<never> {
  const start = Date.now();
  const input = readHookInput();
  const filePath = input.tool_input?.file_path ?? "";
  const toolName = input.tool_name;

  const active = checks.filter((c) => c.matches(filePath, input));
  if (active.length === 0) {
    logEvent("post-tool-use.passed", {
      tool_name: toolName,
      file_path: filePath,
      active: [],
      duration_ms: Date.now() - start,
    });
    pass();
  }

  const results = await Promise.all(
    active.map(async (c) => ({ c, r: await c.run(filePath, input) })),
  );
  const failures = results.filter((x) => !x.r.ok);

  logEvent(failures.length > 0 ? "post-tool-use.failed" : "post-tool-use.passed", {
    tool_name: toolName,
    file_path: filePath,
    active: active.map((c) => c.name),
    failed: failures.map((x) => ({
      name: x.c.name,
      message: (x.r as { ok: false; message: string }).message,
    })),
    duration_ms: Date.now() - start,
  });

  if (failures.length > 0) {
    block(
      failures
        .map((x) => (x.r as { ok: false; message: string }).message)
        .join("\n\n"),
    );
  }

  pass(`post-tool-use: ${active.map((x) => x.name).join(", ")} ok`);
}
