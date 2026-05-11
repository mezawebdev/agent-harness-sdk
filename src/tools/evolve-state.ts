/**
 * Library tools. Persist harness-evolve run state at .harness/evolve.json and
 * compute deltas (new / recurring / resolved) deterministically — without
 * relying on the LLM to remember findings between runs.
 *
 * Two tools:
 *   evolve_record_run     — write a run, get back deltas vs prior run
 *   evolve_dismiss_finding — silence a finding so future runs skip it
 *
 * State file schema (versioned):
 *   { version, lastRun, findings[], dismissed[], resolved[] }
 *
 * If the file is missing or corrupt, both tools fall back to an empty state.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { defineTool } from "../define";
import { projectDir } from "../hooks/utils";
import { toolErr, toolOk } from "../types";

const STATE_FILE = ".harness/evolve.json";
const STATE_VERSION = 1;
const RESOLVED_CAP = 100;

type Tier = "high" | "medium" | "speculative";
type Mode = "additive" | "subtractive" | "drift" | "investigate";

type Finding = {
  fingerprint: string;
  tier: Tier;
  mode: Mode;
  summary: string;
};

type StoredFinding = Finding & { firstSeen: string };

type Dismissed = {
  fingerprint: string;
  reason: string;
  dismissedAt: string;
};

type Resolved = StoredFinding & { resolvedAt: string };

type State = {
  version: number;
  lastRun: string | null;
  findings: StoredFinding[];
  dismissed: Dismissed[];
  resolved: Resolved[];
};

function statePath(): string {
  return join(projectDir(), STATE_FILE);
}

function emptyState(): State {
  return {
    version: STATE_VERSION,
    lastRun: null,
    findings: [],
    dismissed: [],
    resolved: [],
  };
}

function readState(): State {
  const path = statePath();
  if (!existsSync(path)) return emptyState();
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as Partial<State>;
    return {
      version: raw.version ?? STATE_VERSION,
      lastRun: raw.lastRun ?? null,
      findings: raw.findings ?? [],
      dismissed: raw.dismissed ?? [],
      resolved: raw.resolved ?? [],
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: State): void {
  const path = statePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}

function daysBetween(a: string, b: string): number {
  return Math.floor(
    (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24),
  );
}

const findingShape = z.object({
  fingerprint: z.string().min(1),
  tier: z.enum(["high", "medium", "speculative"]),
  mode: z.enum(["additive", "subtractive", "drift", "investigate"]),
  summary: z.string(),
});

export const evolveRecordRun = defineTool({
  name: "evolve_record_run",
  config: {
    title: "Record evolve run",
    description:
      "Persist a harness-evolve run to .harness/evolve.json and return deltas vs the prior run (new, recurring, resolved). Findings whose fingerprint was previously dismissed are filtered out and surfaced in filteredByDismissed for transparency. Used by the harness-evolve skill to surface only what's new since the last sweep — fingerprints must be stable across runs.",
    inputSchema: {
      findings: z.array(findingShape),
    },
  },
  handler: async ({ findings }) => {
    const state = readState();
    const now = new Date().toISOString();

    const dismissedSet = new Set(state.dismissed.map((d) => d.fingerprint));
    const priorByFingerprint = new Map(
      state.findings.map((f) => [f.fingerprint, f] as const),
    );

    const filteredByDismissed: Finding[] = [];
    const surviving: Finding[] = [];
    for (const f of findings) {
      if (dismissedSet.has(f.fingerprint)) {
        filteredByDismissed.push(f);
      } else {
        surviving.push(f);
      }
    }

    const currentSet = new Set(surviving.map((f) => f.fingerprint));

    const newFindings: Finding[] = [];
    const recurringFindings: StoredFinding[] = [];
    for (const f of surviving) {
      const prior = priorByFingerprint.get(f.fingerprint);
      if (prior) {
        recurringFindings.push({ ...f, firstSeen: prior.firstSeen });
      } else {
        newFindings.push(f);
      }
    }

    const resolved: Resolved[] = [];
    for (const prior of state.findings) {
      if (!currentSet.has(prior.fingerprint)) {
        resolved.push({ ...prior, resolvedAt: now });
      }
    }

    const nextFindings: StoredFinding[] = [
      ...newFindings.map((f) => ({ ...f, firstSeen: now })),
      ...recurringFindings,
    ];

    const trimmedResolved = [...state.resolved, ...resolved].slice(
      -RESOLVED_CAP,
    );

    const priorLastRun = state.lastRun;

    writeState({
      version: STATE_VERSION,
      lastRun: now,
      findings: nextFindings,
      dismissed: state.dismissed,
      resolved: trimmedResolved,
    });

    return toolOk({
      priorLastRun,
      currentRun: now,
      new: newFindings,
      recurring: recurringFindings.map((f) => ({
        fingerprint: f.fingerprint,
        tier: f.tier,
        mode: f.mode,
        summary: f.summary,
        firstSeen: f.firstSeen,
        daysActive: daysBetween(f.firstSeen, now),
      })),
      resolved: resolved.map((r) => ({
        fingerprint: r.fingerprint,
        tier: r.tier,
        mode: r.mode,
        summary: r.summary,
        firstSeen: r.firstSeen,
        resolvedAt: r.resolvedAt,
      })),
      filteredByDismissed,
    });
  },
});

export const evolveDismissFinding = defineTool({
  name: "evolve_dismiss_finding",
  config: {
    title: "Dismiss evolve finding",
    description:
      "Record a harness-evolve finding as dismissed so it won't be re-surfaced on future runs. Pass the exact fingerprint from a prior report and a short reason. Removes the finding from the active list immediately; future evolve_record_run calls will filter it out.",
    inputSchema: {
      fingerprint: z.string().min(1),
      reason: z.string().min(1),
    },
  },
  handler: async ({ fingerprint, reason }) => {
    const state = readState();
    if (state.dismissed.some((d) => d.fingerprint === fingerprint)) {
      return toolErr(`fingerprint already dismissed: ${fingerprint}`);
    }

    const now = new Date().toISOString();
    const dismissed: Dismissed = { fingerprint, reason, dismissedAt: now };

    writeState({
      ...state,
      findings: state.findings.filter((f) => f.fingerprint !== fingerprint),
      dismissed: [...state.dismissed, dismissed],
    });

    return toolOk({
      dismissedAt: now,
      totalDismissed: state.dismissed.length + 1,
    });
  },
});
