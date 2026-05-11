import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { isKebabCase } from "../case";
import { updateHarnessConfig } from "../config-updater";
import { type AddType, scaffold } from "../scaffolders";

const VALID_TYPES: AddType[] = ["tool", "guard", "check"];

export async function add(type: string, name: string): Promise<void> {
  const cwd = process.cwd();

  if (!VALID_TYPES.includes(type as AddType)) {
    p.cancel(
      `Unknown type "${type}". Must be one of: ${VALID_TYPES.join(", ")}.`,
    );
    process.exit(1);
  }
  if (!isKebabCase(name)) {
    p.cancel(`Invalid name "${name}". Must be kebab-case (e.g. my-thing).`);
    process.exit(1);
  }

  p.intro(pc.cyan(`harness add ${type} ${name}`));

  const out = scaffold(type as AddType, name);
  const absPath = join(cwd, out.filePath);

  if (existsSync(absPath)) {
    p.cancel(`File already exists: ${out.filePath}`);
    process.exit(1);
  }

  // Write file
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, out.content);
  console.log(`  ${pc.dim("✓")} wrote ${pc.bold(out.filePath)}`);

  // Update harness.config.ts
  const configPath = join(cwd, "harness/harness.config.ts");
  if (!existsSync(configPath)) {
    console.log(
      `  ${pc.yellow("!")} ${pc.dim("harness/harness.config.ts not found — skipping registration")}`,
    );
  } else {
    const current = readFileSync(configPath, "utf-8");
    const result = updateHarnessConfig(
      current,
      out.configArrayName,
      out.configBinding,
      out.configImportPath,
      out.configIsDefault,
    );
    if (result.ok) {
      writeFileSync(configPath, result.content);
      console.log(
        `  ${pc.dim("✓")} registered ${pc.bold(out.configBinding)} in ${pc.bold("harness.config.ts")}`,
      );
    } else {
      console.log(
        `  ${pc.yellow("!")} could not auto-register (${result.reason}) — add manually:`,
      );
      const importLine = out.configIsDefault
        ? `import ${out.configBinding} from "${out.configImportPath}";`
        : `import { ${out.configBinding} } from "${out.configImportPath}";`;
      console.log(pc.dim(`     ${importLine}`));
      console.log(
        pc.dim(`     // and add ${out.configBinding} to the ${out.configArrayName} array`),
      );
    }
  }

  p.outro(
    pc.green(`Added ${type} "${name}". Edit ${out.filePath} to implement.`),
  );
}
