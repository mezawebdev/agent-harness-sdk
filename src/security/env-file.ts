/**
 * Minimal `.env` line editing for `harness security`. Operates on file *content*
 * (pure string in → string out) so it's trivially testable and preserves the
 * rest of the user's file. Matches a key only as a real `KEY=` assignment at the
 * start of a line — never a substring or a commented-out line.
 */

function isAssignment(line: string, key: string): boolean {
  return line.trimStart().startsWith(`${key}=`);
}

/** Set `key=value`, replacing an existing assignment in place or appending one
 *  (with a trailing newline) if absent. */
export function upsertEnvLine(content: string, key: string, value: string): string {
  const assignment = `${key}=${value}`;
  const lines = content.split("\n");
  const idx = lines.findIndex((l) => isAssignment(l, key));
  if (idx !== -1) {
    lines[idx] = assignment;
    return lines.join("\n");
  }
  const base = content.length > 0 && !content.endsWith("\n") ? `${content}\n` : content;
  return `${base}${assignment}\n`;
}

/** Remove the `key=...` assignment line if present; otherwise return unchanged. */
export function removeEnvLine(content: string, key: string): string {
  if (!content.split("\n").some((l) => isAssignment(l, key))) return content;
  const kept = content
    .split("\n")
    .filter((l) => !isAssignment(l, key))
    .join("\n");
  return kept;
}
