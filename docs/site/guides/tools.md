# Tools

**A tool is a deterministic MCP operation.** Same input → same output, every
time. Reach for a tool whenever a step would be error-prone to do in prose —
fetching data, querying a database, scaffolding a file, validating a config.

## When to author one

Write a tool when you want to *replace* an unreliable freeform step with a
mechanical one. If the agent keeps doing something slightly wrong by hand, and
the correct behavior is well-defined, make it a tool.

## Minimal example

```ts
// harness/tools/fetch-weather.ts
import { defineTool, toolOk, toolErr, z } from "agent-harness-sdk";

export default defineTool({
  name: "fetch_weather",
  config: {
    title: "Fetch weather",
    description: "Get the current temperature for a city. Use when the user asks about weather.",
    inputSchema: { city: z.string() },
  },
  handler: async ({ city }) => {
    const res = await fetch(`https://api.example.com/weather?q=${city}`);
    if (!res.ok) return toolErr(`weather lookup failed for ${city} (${res.status})`);
    const { tempC } = (await res.json()) as { tempC: number };
    return toolOk({ city, tempC });
  },
});
```

Register it in `harness/harness.config.ts`:

```ts
import fetchWeather from "./tools/fetch-weather";

export default defineHarness({
  tools: [fetchWeather],
});
```

It surfaces to the agent as `mcp__<server>__fetch_weather`.

## The contract

- **Names are `snake_case`** (MCP convention).
- **Inputs are zod-validated** at the boundary via `inputSchema`. `z` is
  re-exported from the SDK, so you don't import zod separately. Bad input never
  reaches your handler; the handler's `args` are typed from the schema. Omit
  `inputSchema` entirely for a no-argument tool.
- **Return the envelope, never throw.** Build it with the helpers:

  | Helper | Produces |
  |---|---|
  | `toolOk(data)` | `{ ok: true, data }` |
  | `toolErr(message)` | `{ ok: false, error: message }` |

- **`description` is for routing.** Make it specific enough that Claude knows
  *when* to call the tool, not just what it does.

