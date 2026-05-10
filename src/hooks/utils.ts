import { readFileSync } from "node:fs";
import type { HookInput } from "../types";

export function readHookInput(): HookInput {
  return JSON.parse(readFileSync(0, "utf-8")) as HookInput;
}

export function pass(message?: string): never {
  if (message) process.stderr.write(`${message}\n`);
  process.exit(0);
}

export function block(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

export function projectDir(): string {
  return process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
}
