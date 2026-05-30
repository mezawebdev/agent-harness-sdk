import { Command } from "commander";
import { add } from "./commands/add";
import { health } from "./commands/health";
import { init } from "./commands/init";
import { list } from "./commands/list";
import { security } from "./commands/security";
import { update } from "./commands/update";

const program = new Command();

program
  .name("harness")
  .description("Agent harness scaffolder + maintenance CLI")
  .version("0.0.0");

program
  .command("init")
  .description("Scaffold a fresh harness into the current project")
  .action(async () => {
    await init();
  });

program
  .command("update")
  .description(
    "Update library skills, rules, and commands from agent-harness-sdk (preserves local edits)",
  )
  .action(async () => {
    await update();
  });

program
  .command("add")
  .description("Scaffold a new harness primitive")
  .argument("<type>", "tool | guard | check")
  .argument("<name>", "kebab-case name")
  .action(async (type: string, name: string) => {
    await add(type, name);
  });

program
  .command("list")
  .description("List all /harness subcommands with examples")
  .action(() => {
    list();
  });

program
  .command("security")
  .description(
    "Set the harness security level (0 off, 1 guard, 2 sandbox, 3 external); no arg reports the current level",
  )
  .argument("[level]", "0 | 1 | 2 | 3")
  .action(async (level?: string) => {
    await security(level);
  });

program
  .command("health")
  .description("Validate registered guards/checks/tools (structural + trigger)")
  .allowUnknownOption()
  .allowExcessArguments(true)
  // --help is forwarded to the tsx runner rather than handled by commander
  .helpOption(false)
  .action(() => {
    // Pass everything after the `health` token straight to the tsx entry.
    health(process.argv.slice(3));
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
