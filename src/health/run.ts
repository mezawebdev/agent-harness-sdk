import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { HarnessConfig } from "../define";
import { projectDir } from "../paths";
import { auditPrimitives, type DiscoveredFile, type PrimitiveType } from "./audit";
import { triggerPrimitive } from "./trigger";
import type { HookInput } from "../types";

type Envelope =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

function print(env: Envelope): void {
  process.stdout.write(JSON.stringify(env));
}

async function loadConfig(dir: string): Promise<HarnessConfig> {
  const configPath = join(dir, "harness", "harness.config.ts");
  if (!existsSync(configPath)) {
    throw new Error(`harness config not found at ${configPath}`);
  }
  const mod = (await import(pathToFileURL(configPath).href)) as {
    default: HarnessConfig;
  };
  return mod.default;
}

const DIR_BY_TYPE: Record<PrimitiveType, string> = {
  guard: "guards",
  check: "checks",
  tool: "tools",
};

type DiscoverResult = {
  discovered: DiscoveredFile[];
  unloadable: { file: string; error: string }[];
};

/** Import every primitive file under harness/{guards,checks,tools}/ and read the
 *  `.name` off the primitive-shaped export, so drift can compare disk to config. */
async function discoverLocal(dir: string): Promise<DiscoverResult> {
  const discovered: DiscoveredFile[] = [];
  const unloadable: { file: string; error: string }[] = [];

  for (const type of Object.keys(DIR_BY_TYPE) as PrimitiveType[]) {
    const subdir = join(dir, "harness", DIR_BY_TYPE[type]);
    if (!existsSync(subdir)) continue;
    const files = readdirSync(subdir).filter(
      (f) =>
        f.endsWith(".ts") &&
        f !== "index.ts" &&
        !f.endsWith(".test.ts") &&
        !f.endsWith(".spec.ts"),
    );
    for (const f of files) {
      const abs = join(subdir, f);
      const relFile = `harness/${DIR_BY_TYPE[type]}/${f}`;
      let mod: Record<string, unknown>;
      try {
        mod = (await import(pathToFileURL(abs).href)) as Record<string, unknown>;
      } catch (err) {
        unloadable.push({
          file: relFile,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
      for (const val of Object.values(mod)) {
        const primitive = val as { name?: unknown; run?: unknown; handler?: unknown; config?: unknown };
        let isPrimitive = false;
        if (type === "tool") {
          isPrimitive =
            primitive !== null &&
            typeof primitive === "object" &&
            typeof primitive.name === "string" &&
            typeof primitive.handler === "function" &&
            typeof primitive.config === "object" &&
            primitive.config !== null;
        } else {
          // guard or check
          isPrimitive =
            primitive !== null &&
            typeof primitive === "object" &&
            typeof primitive.name === "string" &&
            typeof primitive.run === "function";
        }
        if (isPrimitive) {
          discovered.push({ type, name: primitive.name as string, file: relFile });
        }
      }
    }
  }
  return { discovered, unloadable };
}

function parseTriggerArgs(args: string[]): { type: string; name: string; input: HookInput } {
  // shape: trigger <type> <name> --input <json>
  const [, type, name] = args;
  const flagIdx = args.indexOf("--input");
  if (!type || !name || flagIdx === -1 || !args[flagIdx + 1]) {
    throw new Error("usage: trigger <guard|check> <name> --input <hookInputJson>");
  }
  const input = JSON.parse(args[flagIdx + 1]) as HookInput;
  return { type, name, input };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dir = projectDir();

  if (args[0] === "trigger") {
    const { type, name, input } = parseTriggerArgs(args);
    if (type === "tool") {
      print({ ok: false, error: "tools are not behaviorally triggered — they are structurally validated only" });
      return;
    }
    if (type !== "guard" && type !== "check") {
      print({ ok: false, error: `unknown primitive type "${type}" — expected guard or check` });
      return;
    }
    const config = await loadConfig(dir);
    const out = await triggerPrimitive(config, type, name, input);
    print({ ok: true, data: out });
    return;
  }

  // structural pass
  const config = await loadConfig(dir);
  const { discovered, unloadable } = await discoverLocal(dir);
  print({ ok: true, data: auditPrimitives(config, discovered, unloadable) });
}

main().catch((err: unknown) => {
  print({ ok: false, error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
