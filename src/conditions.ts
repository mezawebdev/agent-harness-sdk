import picomatch from "picomatch";
import type { Conditions, HookInput } from "./types";

/** Compiled glob matchers, cached by pattern-set identity so a guard/check
 *  declared once doesn't recompile its globs on every tool call. */
const matcherCache = new WeakMap<string[], (path: string) => boolean>();

function fileMatcher(globs: string[]): (path: string) => boolean {
  let m = matcherCache.get(globs);
  if (!m) {
    // dot: true so wildcards match dotfiles (.env, .claude) — the common case here.
    m = picomatch(globs, { dot: true });
    matcherCache.set(globs, m);
  }
  return m;
}

/**
 * Evaluates the declarative conditions (`tools` / `files` / `when`) against a
 * hook input. Every provided condition must pass (AND); within `tools`/`files`
 * any member matches (OR). No conditions → always active.
 *
 * The deprecated `matches` predicate is intentionally NOT evaluated here — it
 * has a primitive-specific signature, so each dispatcher ANDs its own
 * `matches` result with this function's.
 */
export function shouldRun(c: Conditions, input: HookInput): boolean {
  if (c.tools && !c.tools.includes(input.tool_name ?? "")) return false;

  if (c.files) {
    const file = input.tool_input?.file_path;
    if (!file || !fileMatcher(c.files)(file)) return false;
  }

  if (c.when && !c.when(input)) return false;

  return true;
}
