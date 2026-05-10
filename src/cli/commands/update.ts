import * as p from "@clack/prompts";
import pc from "picocolors";
import { syncContent } from "../sync-content";

export async function update(): Promise<void> {
  const cwd = process.cwd();

  p.intro(pc.cyan("agent-harness-sdk update"));

  const s = p.spinner();
  s.start("Updating library skills, rules, and commands");
  const summary = syncContent(cwd);
  s.stop("Updated");

  const wrote = summary.files.filter((f) => f.outcome === "wrote");
  const skippedMod = summary.files.filter(
    (f) => f.outcome === "skipped-modified",
  );
  const skippedNew = summary.files.filter((f) => f.outcome === "skipped-new");

  for (const f of wrote) {
    console.log(`  ${pc.dim("✓")} ${pc.bold(f.path)}`);
  }
  for (const f of skippedMod) {
    console.log(
      `  ${pc.yellow("!")} ${pc.bold(f.path)} ${pc.dim("(skipped — locally modified)")}`,
    );
  }
  for (const f of skippedNew) {
    console.log(
      `  ${pc.yellow("!")} ${pc.bold(f.path)} ${pc.dim("(skipped — exists, no manifest entry)")}`,
    );
  }

  if (skippedMod.length + skippedNew.length > 0) {
    console.log(
      `\n  ${pc.dim("To overwrite skipped files, delete them and re-run update.")}`,
    );
  }

  p.outro(pc.green("Done."));
}
