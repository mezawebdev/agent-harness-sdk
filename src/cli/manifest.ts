/**
 * Sync manifest. Records which SDK version installed each library-shipped
 * file and its checksum at install time. Lets `harness sync` detect user edits.
 *
 * Lives at `.harness/installed.json` (gitignored). One per developer.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type ManifestEntry = {
  sourceVersion: string;
  checksum: string;
};

export type Manifest = {
  sdkVersion: string;
  files: Record<string, ManifestEntry>;
};

const MANIFEST_REL = ".harness/installed.json";

export function manifestPath(projectDir: string): string {
  return join(projectDir, MANIFEST_REL);
}

export function readManifest(projectDir: string): Manifest {
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
