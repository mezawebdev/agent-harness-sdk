// Public surface of the security feature for the rest of the CLI to consume.
// The guard itself (protect-harness) lives in `src/guards/` and is imported
// from there — it is intentionally NOT re-exported here.
export { security } from "./cli/command";
export { addHarnessSandbox } from "./sandbox";
