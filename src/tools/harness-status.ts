import { defineTool } from "../define";
import { readLog } from "../observability/log";
import { toolOk } from "../types";

/**
 * Library tool. Reads .harness/log.jsonl and returns aggregated stats:
 * total event count, count per event type, and the last 20 entries.
 */
export const harnessStatus = defineTool({
  name: "harness_status",
  config: {
    title: "Harness status",
    description:
      "Aggregated read of the harness audit log. Returns total event count, counts per event type, and the most recent 20 events. Useful for harness-evolve and ad-hoc inspection of what the harness has been doing.",
    inputSchema: {},
  },
  handler: async () => {
    const entries = readLog();

    const byEvent: Record<string, number> = {};
    for (const e of entries) {
      byEvent[e.event] = (byEvent[e.event] ?? 0) + 1;
    }

    const recent = entries.slice(-20).map((e) => ({
      ts: e.ts,
      event: e.event,
      tool_name: e.tool_name,
      file_path: e.file_path,
      ok: e.ok,
    }));

    return toolOk({
      events: entries.length,
      byEvent,
      recent,
    });
  },
});
