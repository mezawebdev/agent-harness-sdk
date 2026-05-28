import type { Check, Guard, Tool } from "../types";
import type { HarnessConfig } from "../define";

export type PrimitiveType = "tool" | "guard" | "check";

export type StructuralResult = { passed: boolean; issues: string[] };

const isSnakeCase = (s: string): boolean => /^[a-z][a-z0-9_]*$/.test(s);

export function validateGuard(guard: Guard): StructuralResult {
  if (typeof guard.name !== "string" || guard.name.length === 0) {
    return { passed: false, issues: ["guard `name` must be a non-empty string"] };
  }
  return { passed: true, issues: [] };
}

export function validateCheck(check: Check): StructuralResult {
  if (typeof check.name !== "string" || check.name.length === 0) {
    return { passed: false, issues: ["check `name` must be a non-empty string"] };
  }
  return { passed: true, issues: [] };
}

export function validateTool(tool: Tool): StructuralResult {
  const issues: string[] = [];
  if (typeof tool?.name !== "string") {
    issues.push("tool `name` must be a string");
  } else if (!isSnakeCase(tool.name)) {
    issues.push("tool `name` must be a non-empty snake_case string");
  }
  return { passed: issues.length === 0, issues };
}

export type ConditionsSummary = {
  tools?: string[];
  files?: string[];
  hasWhen?: boolean;
  hasMatches?: boolean;
};

export type PrimitiveReport = {
  type: PrimitiveType;
  name: string;
  file?: string;
  conditions?: ConditionsSummary;
  structural: StructuralResult;
};

export type DiscoveredFile = { type: PrimitiveType; name: string; file: string };

export type PrimitiveAudit = {
  primitives: PrimitiveReport[];
  drift: { unregistered: DiscoveredFile[] };
  unloadable: { file: string; error: string }[];
};

function summarizeConditions(p: Guard | Check): ConditionsSummary | undefined {
  const s: ConditionsSummary = {};
  if (p.tools !== undefined) s.tools = [...p.tools] as string[];
  if (p.files !== undefined) s.files = [...p.files];
  if (p.when !== undefined) s.hasWhen = true;
  if (p.matches !== undefined) s.hasMatches = true;
  return Object.keys(s).length > 0 ? s : undefined;
}

export function auditPrimitives(
  config: HarnessConfig,
  discovered: DiscoveredFile[],
  unloadable: { file: string; error: string }[] = [],
): PrimitiveAudit {
  const primitives: PrimitiveReport[] = [];

  for (const guard of config.guards ?? []) {
    primitives.push({
      type: "guard",
      name: guard.name,
      conditions: summarizeConditions(guard),
      structural: validateGuard(guard),
    });
  }
  for (const check of config.checks ?? []) {
    primitives.push({
      type: "check",
      name: check.name,
      conditions: summarizeConditions(check),
      structural: validateCheck(check),
    });
  }
  for (const tool of config.tools ?? []) {
    primitives.push({
      type: "tool",
      name: tool.name,
      structural: validateTool(tool),
    });
  }

  // Attach file from discovered to each registered primitive (match on type + name)
  const discoveredMap = new Map(discovered.map((d) => [`${d.type}:${d.name}`, d.file]));
  for (const p of primitives) {
    const key = `${p.type}:${p.name}`;
    if (discoveredMap.has(key)) {
      p.file = discoveredMap.get(key);
    }
  }

  const registered = new Set(primitives.map((p) => `${p.type}:${p.name}`));
  const unregistered = discovered.filter(
    (d) => !registered.has(`${d.type}:${d.name}`),
  );

  return { primitives, drift: { unregistered }, unloadable };
}
