import pc from "picocolors";

export function list(): void {
  const lines: string[] = [
    pc.bold("Agent Harness — slash command reference"),
    "",
    `  ${pc.cyan("/harness add tool <name>")}     Scaffold a new MCP tool`,
    `                                ${pc.dim("Example: /harness add tool fetch-weather")}`,
    "",
    `  ${pc.cyan("/harness add guard <name>")}    Scaffold a pre-action guard`,
    `                                ${pc.dim("Example: /harness add guard block-pushes")}`,
    "",
    `  ${pc.cyan("/harness add check <name>")}    Scaffold a post-action check`,
    `                                ${pc.dim("Example: /harness add check validate-routes")}`,
    "",
    `  ${pc.cyan("/harness update")}              Sync library skills, rules, and slash command`,
    `                                ${pc.dim("(preserves local edits via checksum)")}`,
    "",
    `  ${pc.cyan("/harness evolve")}              Read-only audit of codebase + harness`,
    `                                ${pc.dim("Tiered proposals for additions, removals, drift")}`,
    "",
    `  ${pc.cyan("/harness list")}                Show this list`,
    `  ${pc.cyan("/harness help")}                Alias for /harness list`,
    "",
    pc.dim("Bootstrap (run from shell — slash command is installed by init):"),
    `  ${pc.cyan("npx harness init")}             Initialize a harness in the current project`,
    "",
  ];

  console.log(lines.join("\n"));
}
