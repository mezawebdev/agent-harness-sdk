import { Command } from "commander";
import { add } from "./commands/add";
import { init } from "./commands/init";
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

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
