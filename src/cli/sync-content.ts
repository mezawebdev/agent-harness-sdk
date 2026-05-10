/** Shared sync logic used by `harness init` and `harness sync`.
 *
 * Tracks installed files in a `.harness/installed.json` manifest with
 * per-file checksums. On re-sync, files whose current checksum matches the
 * manifest are safely overwritten. Files that diverge (user-edited) are
 * skipped with a warning. Files with no manifest entry but already on disk
 * are also skipped (conservative — could be user content).
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { VERSION } from "../index";
import {
  type Manifest,
  checksum,
  readManifest,
  writeManifest,
} from "./manifest";

/** Resolves the SDK root regardless of whether we're running from src or dist. */
function sdkRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return dirname(dirname(here));
}

export type SyncOutcome = "wrote" | "skipped-modified" | "skipped-new";

export type SyncSummary = {
  files: { path: string; outcome: SyncOutcome }[];
};

type FileToSync = {
  /** Relative path under .claude/. */
  rel: string;
  /** Absolute source path (in SDK). */
  source: string;
};

function listSkillFiles(skillsSource: string): FileToSync[] {
  if (!existsSync(skillsSource)) return [];
  const out: FileToSync[] = [];
  const skills = readdirSync(skillsSource).filter((name) =>
    statSync(join(skillsSource, name)).isDirectory(),
  );
  for (const skill of skills) {
    const root = join(skillsSource, skill);
    walkDir(root, (abs) => {
      out.push({
        rel: join(".claude/skills", skill, relative(root, abs)),
        source: abs,
      });
    });
  }
  return out;
}

function listRuleFiles(rulesSource: string): FileToSync[] {
  if (!existsSync(rulesSource)) return [];
  return readdirSync(rulesSource)
    .filter(
      (name) =>
        name.endsWith(".md") && statSync(join(rulesSource, name)).isFile(),
    )
    .map((name) => ({
      rel: join(".claude/rules", name),
      source: join(rulesSource, name),
    }));
}

function listCommandFiles(commandsSource: string): FileToSync[] {
  if (!existsSync(commandsSource)) return [];
  return readdirSync(commandsSource)
    .filter(
      (name) =>
        name.endsWith(".md") && statSync(join(commandsSource, name)).isFile(),
    )
    .map((name) => ({
      rel: join(".claude/commands", name),
      source: join(commandsSource, name),
    }));
}

function walkDir(dir: string, visit: (file: string) => void): void {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) walkDir(abs, visit);
    else visit(abs);
  }
}

export function syncContent(projectDir: string): SyncSummary {
  const root = sdkRoot();
  const manifest: Manifest = readManifest(projectDir);
  manifest.sdkVersion = VERSION;
  manifest.files = manifest.files ?? {};

  const summary: SyncSummary = { files: [] };

  const all: FileToSync[] = [
    ...listSkillFiles(join(root, "src", "skills")),
    ...listRuleFiles(join(root, "src", "rules")),
    ...listCommandFiles(join(root, "src", "commands")),
  ];

  for (const { rel, source } of all) {
    const targetAbs = join(projectDir, rel);
    const sourceContent = readFileSync(source, "utf-8");
    const sourceChecksum = checksum(sourceContent);

    if (existsSync(targetAbs)) {
      const currentContent = readFileSync(targetAbs, "utf-8");
      const currentChecksum = checksum(currentContent);
      const recordedChecksum = manifest.files[rel]?.checksum;

      if (currentChecksum === sourceChecksum) {
        // Already up-to-date.
        manifest.files[rel] = {
          sourceVersion: VERSION,
          checksum: sourceChecksum,
        };
        continue;
      }

      if (!recordedChecksum) {
        // No manifest entry but file exists — could be user content. Skip.
        summary.files.push({ path: rel, outcome: "skipped-new" });
        continue;
      }

      if (recordedChecksum !== currentChecksum) {
        // User has edited locally. Skip to preserve their changes.
        summary.files.push({ path: rel, outcome: "skipped-modified" });
        continue;
      }
    }

    // Safe to write.
    mkdirSync(dirname(targetAbs), { recursive: true });
    writeFileSync(targetAbs, sourceContent);
    manifest.files[rel] = {
      sourceVersion: VERSION,
      checksum: sourceChecksum,
    };
    summary.files.push({ path: rel, outcome: "wrote" });
  }

  writeManifest(projectDir, manifest);
  return summary;
}
