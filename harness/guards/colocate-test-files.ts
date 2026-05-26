import { basename, dirname, join, relative } from "node:path";
import {
  Tools,
  defineGuard,
  guardAllow,
  guardDeny,
  projectDir,
} from "../../src/index";

/**
 * Enforces test-file colocation: a `*.test.ts(x)` file must live in a `tests/`
 * directory sitting next to the code it covers (e.g. `src/hooks/match.ts` →
 * `src/hooks/tests/match.test.ts`), not as a loose sibling. Detectable from the
 * path alone, so it blocks the misplaced write up front and points at the right
 * location.
 */
export const colocateTestFiles = defineGuard({
  name: "colocate-test-files",
  tools: [Tools.Edit, Tools.Write, Tools.MultiEdit],
  files: ["**/*.test.ts", "**/*.test.tsx"],
  async run(input) {
    const file = input.tool_input?.file_path ?? "";
    const dir = dirname(file);
    if (basename(dir) === "tests") return guardAllow();

    const root = projectDir();
    const current = relative(root, file);
    const correct = relative(root, join(dir, "tests", basename(file)));
    return guardDeny(
      `colocate-test-files: ${current} must live in a \`tests/\` directory next to the code it covers. ` +
        `Move it to ${correct}.`,
    );
  },
});
