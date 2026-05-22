/**
 * Sync manifest. Records which SDK version installed each library-shipped
 * file and its checksum at install time. Lets `harness update` detect user
 * edits and lets the SessionStart hook detect drift between the synced
 * content and the currently installed SDK version.
 *
 * Lives at `harness/harness.lock` — git-tracked so it travels with the repo
 * to all teammates. New collaborators inherit the manifest on clone, so
 * drift detection works for them on the first Claude Code session.
 *
 * Auto-migrates from the legacy gitignored path `.harness/installed.json`
 * on first read for projects initialised before 0.1.4.
 */
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

export type ManifestEntry = {
  sourceVersion: string;
  checksum: string;
};

export type Manifest = {
  sdkVersion: string;
  files: Record<string, ManifestEntry>;
};

const MANIFEST_REL = "harness/harness.lock";
const LEGACY_MANIFEST_REL = ".harness/installed.json";

export function manifestPath(projectDir: string): string {
  return join(projectDir, MANIFEST_REL);
}

function legacyManifestPath(projectDir: string): string {
  return join(projectDir, LEGACY_MANIFEST_REL);
}

/** Copy the legacy `.harness/installed.json` to the new `harness/harness.lock`
 *  location if the new one doesn't exist. Silent on failure — fall through
 *  to the empty-manifest default. */
function migrateLegacyManifest(projectDir: string): void {
  const newPath = manifestPath(projectDir);
  const oldPath = legacyManifestPath(projectDir);
  if (existsSync(newPath)) return;
  if (!existsSync(oldPath)) return;
  try {
    mkdirSync(dirname(newPath), { recursive: true });
    copyFileSync(oldPath, newPath);
  } catch {
    // fall through — readManifest will return an empty manifest
  }
}

export function readManifest(projectDir: string): Manifest {
  migrateLegacyManifest(projectDir);
  const path = manifestPath(projectDir);
  if (!existsSync(path)) return { sdkVersion: "", files: {} };
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Manifest;
  } catch {
    return { sdkVersion: "", files: {} };
  }
}

export function writeManifest(projectDir: string, manifest: Manifest): void {
  const path = manifestPath(projectDir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
}

export function checksum(content: string): string {
  return (
    "sha256:" +
    createHash("sha256").update(content).digest("hex").slice(0, 16)
  );
}
