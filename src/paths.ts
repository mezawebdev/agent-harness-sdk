/** The project root Claude Code is operating in — `CLAUDE_PROJECT_DIR` when set
 *  (Claude Code provides it to hooks), else the current working directory. */
export function projectDir(): string {
  return process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
}
