/**
 * Best-effort updater for harness/harness.config.ts. Inserts an import after
 * the last existing import and appends the binding to the end of the named
 * array, preserving any in-array comments.
 *
 * Returns { ok: true, content } on success, or { ok: false, reason } if the
 * file's shape couldn't be matched (the caller should fall back to printing
 * manual instructions).
 */

export type UpdateOk = { ok: true; content: string };
export type UpdateErr = { ok: false; reason: string };
export type UpdateResult = UpdateOk | UpdateErr;

/**
 * Find the last character of the last non-empty, non-comment line.
 * Used to decide whether the previous entry needs a trailing comma before
 * we append a new one — comments shouldn't influence that decision.
 */
function lastSemanticChar(content: string): string {
  const lines = content.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line === "" || line.startsWith("//")) continue;
    return line.charAt(line.length - 1);
  }
  return "[";
}

export function updateHarnessConfig(
  current: string,
  arrayName: "tools" | "guards" | "checks",
  binding: string,
  importPath: string,
  isDefault: boolean,
): UpdateResult {
  const importLine = isDefault
    ? `import ${binding} from "${importPath}";`
    : `import { ${binding} } from "${importPath}";`;

  // 1. Insert import after the last `import ...;` statement.
  // Track whether we're mid-import (handles multi-line `import { a, b } from "..."`).
  const lines = current.split("\n");
  let lastImportEndIdx = -1;
  let inImport = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\b/.test(lines[i])) inImport = true;
    if (inImport && /;\s*$/.test(lines[i])) {
      lastImportEndIdx = i;
      inImport = false;
    }
  }
  if (lastImportEndIdx === -1) {
    return { ok: false, reason: "no import statements found" };
  }
  if (lines.includes(importLine)) {
    return { ok: false, reason: `import for ${binding} already present` };
  }
  lines.splice(lastImportEndIdx + 1, 0, importLine);
  let updated = lines.join("\n");

  // 2. Append binding before the closing `]` of the named array.
  // Captures: (1) array opener through content, (2) trailing whitespace before ].
  const arrayPattern = new RegExp(
    `(${arrayName}:\\s*\\[[\\s\\S]*?)(\\s*)\\]`,
  );
  const match = updated.match(arrayPattern);
  if (!match) {
    return { ok: false, reason: `no "${arrayName}: [" array found` };
  }

  const before = match[1];
  const trailingWs = match[2];
  const lastChar = lastSemanticChar(before);
  const needsComma = lastChar !== "[" && lastChar !== ",";
  const inlineArray = !before.includes("\n");

  // Insert the new entry on its own line. If the array was inline, also
  // promote the closing bracket to a new line for consistency.
  const insertion = `${needsComma ? "," : ""}\n    ${binding},`;
  const finalTrailing = trailingWs || (inlineArray ? "\n  " : "");
  updated = updated.replace(
    arrayPattern,
    `${before}${insertion}${finalTrailing}]`,
  );

  return { ok: true, content: updated };
}
