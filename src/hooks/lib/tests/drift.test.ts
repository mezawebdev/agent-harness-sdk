import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VERSION } from "../../../index";
import { detectDrift, markNudged, nudgeKey, wasNudged } from "../drift";

describe("drift", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "harness-drift-"));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const writeManifestVersion = (sdkVersion: string) => {
    mkdirSync(join(dir, "harness"), { recursive: true });
    writeFileSync(
      join(dir, "harness/harness.lock"),
      JSON.stringify({ sdkVersion, files: {} }),
    );
  };

  describe("detectDrift", () => {
    it("returns null for an uninitialised project (no manifest)", () => {
      expect(detectDrift(dir)).toBeNull();
    });

    it("returns null when the manifest matches the installed version", () => {
      writeManifestVersion(VERSION);
      expect(detectDrift(dir)).toBeNull();
    });

    it("reports drift when the manifest lags the installed version", () => {
      writeManifestVersion("0.0.0-old");
      expect(detectDrift(dir)).toEqual({
        recorded: "0.0.0-old",
        current: VERSION,
      });
    });
  });

  describe("throttle", () => {
    it("records a nudge so the same session+version isn't nudged twice", () => {
      const key = nudgeKey("sess-1", VERSION);
      expect(wasNudged(dir, key)).toBe(false);
      markNudged(dir, key);
      expect(wasNudged(dir, key)).toBe(true);
    });

    it("keys by session+version, so a later upgrade in the same session nudges again", () => {
      markNudged(dir, nudgeKey("sess-1", "1.0.0"));
      expect(wasNudged(dir, nudgeKey("sess-1", "1.0.0"))).toBe(true);
      expect(wasNudged(dir, nudgeKey("sess-1", "1.1.0"))).toBe(false);
    });

    it("is idempotent — re-marking the same key doesn't duplicate it", () => {
      const key = nudgeKey("sess-1", VERSION);
      markNudged(dir, key);
      markNudged(dir, key);
      expect(wasNudged(dir, key)).toBe(true);
    });
  });
});
