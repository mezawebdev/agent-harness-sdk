# Examples

Short, copy-pasteable primitives. Each is independent — grab what you need and
drop it into `harness/guards/`, `harness/checks/`, or `harness/tools/`, then
register it in `harness.config.ts`. Several are drawn from this SDK's own
harness.

Primitives are project-dependent, so treat globs, commands, and messages as
starting points to adapt.

[[toc]]

## Guards

### Block secret-file writes

Stops the agent from editing `.env` files. Shipped with the SDK as
`protectEnvFiles` — import it directly, or adapt the pattern for other secrets.

```ts
import { defineGuard, guardDeny, Tools } from "agent-harness-sdk";

export const protectEnvFiles = defineGuard({
  name: "protect-env-files",
  tools: [Tools.Edit, Tools.Write, Tools.MultiEdit],
  files: ["**/.env", "**/.env.*", "**/*.pem", "**/secrets.*"],
  run: async (input) => {
    const file = input.tool_input?.file_path ?? "";
    return guardDeny(`protect-env-files: ${file} is protected — ask the user to edit it manually.`);
  },
});
```

### Block `git push` / force-push

Disables pushing from automation. Tighten the regex to only block force-pushes if
you allow normal pushes.

```ts
import { defineGuard, guardAllow, guardDeny, Tools } from "agent-harness-sdk";

export const blockForcePush = defineGuard({
  name: "block-force-push",
  tools: [Tools.Bash],
  run: async (input) => {
    const cmd = (input.tool_input as { command?: string })?.command ?? "";
    if (/\bgit\s+push\b.*(--force|-f)\b/.test(cmd)) {
      return guardDeny("block-force-push: force-pushing is disabled — ask the user to do it manually.");
    }
    return guardAllow();
  },
});
```

### Deny destructive bash

Catches a few classic foot-guns before they run.

```ts
import { defineGuard, guardAllow, guardDeny, Tools } from "agent-harness-sdk";

const DESTRUCTIVE = [/\brm\s+-rf\s+\//, /\bgit\s+reset\s+--hard\b/, /:\(\)\{.*\};:/];

export const denyDestructiveBash = defineGuard({
  name: "deny-destructive-bash",
  tools: [Tools.Bash],
  run: async (input) => {
    const cmd = (input.tool_input as { command?: string })?.command ?? "";
    const hit = DESTRUCTIVE.find((re) => re.test(cmd));
    return hit
      ? guardDeny(`deny-destructive-bash: refusing to run \`${cmd}\` — looks destructive.`)
      : guardAllow();
  },
});
```

### Keep edits inside an allowed scope

Blocks writes outside a set of directories — useful for sandboxing an agent to one
package.

```ts
import { defineGuard, guardAllow, guardDeny, projectDir, Tools } from "agent-harness-sdk";
import { relative, resolve } from "node:path";

const ALLOWED = ["src", "tests"];

export const scopeEditsToSrc = defineGuard({
  name: "scope-edits-to-src",
  tools: [Tools.Edit, Tools.Write, Tools.MultiEdit],
  run: async (input) => {
    const file = input.tool_input?.file_path ?? "";
    const rel = relative(projectDir(), resolve(file));
    const inScope = ALLOWED.some((dir) => rel === dir || rel.startsWith(`${dir}/`));
    return inScope
      ? guardAllow()
      : guardDeny(`scope-edits-to-src: ${rel} is outside the allowed scope (${ALLOWED.join(", ")}).`);
  },
});
```

### Enforce test-file colocation

From this SDK's own harness: a `*.test.ts` file must live in a `tests/` directory
next to the code it covers. Detectable from the path alone, so it's a guard.

```ts
import { basename, dirname, join, relative } from "node:path";
import { defineGuard, guardAllow, guardDeny, projectDir, Tools } from "agent-harness-sdk";

export const colocateTestFiles = defineGuard({
  name: "colocate-test-files",
  tools: [Tools.Edit, Tools.Write, Tools.MultiEdit],
  files: ["**/*.test.ts", "**/*.test.tsx"],
  run: async (input) => {
    const file = input.tool_input?.file_path ?? "";
    const dir = dirname(file);
    if (basename(dir) === "tests") return guardAllow();
    const root = projectDir();
    const correct = relative(root, join(dir, "tests", basename(file)));
    return guardDeny(`colocate-test-files: ${relative(root, file)} must live in a \`tests/\` dir. Move it to ${correct}.`);
  },
});
```

## Checks

### Lint the edited file

Run ESLint on just the file that changed and feed failures back to Claude.

```ts
import { defineCheck, checkFail, checkOk, projectDir, Tools } from "agent-harness-sdk";
import { execSync } from "node:child_process";

export const lintEditedFile = defineCheck({
  name: "lint-edited-file",
  tools: [Tools.Edit, Tools.Write, Tools.MultiEdit],
  files: ["**/*.ts", "**/*.tsx"],
  run: async (filePath) => {
    try {
      execSync(`npx --no-install eslint "${filePath}"`, { stdio: "pipe", cwd: projectDir() });
      return checkOk();
    } catch (err) {
      return checkFail(`lint-edited-file failed:\n${(err as { stdout?: Buffer }).stdout?.toString() ?? ""}`);
    }
  },
});
```

### Typecheck after edits

Run the project typechecker after a TS edit.

```ts
import { defineCheck, checkFail, checkOk, projectDir, Tools } from "agent-harness-sdk";
import { execSync } from "node:child_process";

export const typecheck = defineCheck({
  name: "typecheck",
  tools: [Tools.Edit, Tools.Write, Tools.MultiEdit],
  files: ["**/*.ts", "**/*.tsx"],
  run: async () => {
    try {
      execSync("npx --no-install tsc --noEmit", { stdio: "pipe", cwd: projectDir() });
      return checkOk();
    } catch (err) {
      return checkFail(`typecheck failed:\n${(err as { stdout?: Buffer }).stdout?.toString() ?? ""}`);
    }
  },
});
```

### Run tests for the touched module

Map an edited source file to its test file and run only those tests.

```ts
import { defineCheck, checkFail, checkOk, projectDir, Tools } from "agent-harness-sdk";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

export const testTouchedModule = defineCheck({
  name: "test-touched-module",
  tools: [Tools.Edit, Tools.Write, Tools.MultiEdit],
  files: ["src/**/*.ts"],
  run: async (filePath) => {
    const testFile = filePath.replace(/\/([^/]+)\.ts$/, "/tests/$1.test.ts");
    if (!existsSync(testFile)) return checkOk(); // no test → nothing to run
    try {
      execSync(`npx --no-install vitest run "${testFile}"`, { stdio: "pipe", cwd: projectDir() });
      return checkOk();
    } catch (err) {
      return checkFail(`test-touched-module failed:\n${(err as { stdout?: Buffer }).stdout?.toString() ?? ""}`);
    }
  },
});
```

### Detect placeholder / TODO drift

Reject edits that leave `TODO`, `FIXME`, or `XXX` markers behind.

```ts
import { defineCheck, checkFail, checkOk, Tools } from "agent-harness-sdk";
import { readFileSync } from "node:fs";

export const noPlaceholders = defineCheck({
  name: "no-placeholders",
  tools: [Tools.Edit, Tools.Write, Tools.MultiEdit],
  files: ["src/**/*.ts"],
  run: async (filePath) => {
    const text = readFileSync(filePath, "utf8");
    const hit = /\b(TODO|FIXME|XXX)\b/.exec(text);
    return hit
      ? checkFail(`no-placeholders: ${filePath} still contains a ${hit[1]} marker — resolve it before finishing.`)
      : checkOk();
  },
});
```

### Enforce a naming convention

Pure-JS inspection — no shelling out. Here: React components must be PascalCase.

```ts
import { defineCheck, checkFail, checkOk, Tools } from "agent-harness-sdk";
import { basename } from "node:path";

export const componentsArePascalCase = defineCheck({
  name: "components-are-pascal-case",
  tools: [Tools.Write, Tools.Edit, Tools.MultiEdit],
  files: ["src/components/**/*.tsx"],
  run: async (filePath) => {
    const name = basename(filePath, ".tsx");
    return /^[A-Z][A-Za-z0-9]*$/.test(name)
      ? checkOk()
      : checkFail(`components-are-pascal-case: "${name}.tsx" must be PascalCase (e.g. MyComponent.tsx).`);
  },
});
```

## Tools

### Fetch & format data

The canonical tool: hit an API, return a clean envelope.

```ts
import { defineTool, toolOk, toolErr, z } from "agent-harness-sdk";

export default defineTool({
  name: "fetch_issue",
  config: {
    description: "Fetch a GitHub issue by number. Use when the user references an issue.",
    inputSchema: { repo: z.string(), number: z.number() },
  },
  handler: async ({ repo, number }) => {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues/${number}`);
    if (!res.ok) return toolErr(`fetch_issue: ${repo}#${number} → ${res.status}`);
    const { title, state } = (await res.json()) as { title: string; state: string };
    return toolOk({ title, state });
  },
});
```

### Query a local database

Wrap a read query so the agent never hand-writes SQL.

```ts
import { defineTool, toolOk, toolErr, z } from "agent-harness-sdk";
import Database from "better-sqlite3";

export default defineTool({
  name: "find_user",
  config: {
    description: "Look up a user by email in the local dev database.",
    inputSchema: { email: z.string().email() },
  },
  handler: async ({ email }) => {
    try {
      const db = new Database("dev.sqlite", { readonly: true });
      const row = db.prepare("SELECT id, name FROM users WHERE email = ?").get(email);
      return row ? toolOk(row) : toolErr(`find_user: no user with email ${email}`);
    } catch (err) {
      return toolErr(`find_user: ${(err as Error).message}`);
    }
  },
});
```

### Validate a config file

Turn an error-prone "is this config valid?" judgement into a deterministic check
the agent can call.

```ts
import { defineTool, toolOk, toolErr, z } from "agent-harness-sdk";
import { readFileSync } from "node:fs";

const Schema = z.object({
  port: z.number().int().positive(),
  host: z.string(),
  features: z.array(z.string()),
});

export default defineTool({
  name: "validate_config",
  config: {
    description: "Validate a JSON config file against the app schema. Use before deploying.",
    inputSchema: { path: z.string() },
  },
  handler: async ({ path }) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path, "utf8"));
    } catch (err) {
      return toolErr(`validate_config: cannot read/parse ${path}: ${(err as Error).message}`);
    }
    const result = Schema.safeParse(parsed);
    return result.success
      ? toolOk({ valid: true })
      : toolErr(`validate_config: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  },
});
```

### Scaffold a file from a template

Generate boilerplate deterministically instead of letting the agent free-hand it.

```ts
import { defineTool, toolOk, toolErr, z } from "agent-harness-sdk";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export default defineTool({
  name: "scaffold_component",
  config: {
    description: "Create a new React component file with the standard boilerplate.",
    inputSchema: { name: z.string().regex(/^[A-Z][A-Za-z0-9]*$/), dir: z.string().default("src/components") },
  },
  handler: async ({ name, dir }) => {
    const path = `${dir}/${name}.tsx`;
    if (existsSync(path)) return toolErr(`scaffold_component: ${path} already exists`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `export function ${name}() {\n  return <div>${name}</div>;\n}\n`);
    return toolOk({ created: path });
  },
});
```

