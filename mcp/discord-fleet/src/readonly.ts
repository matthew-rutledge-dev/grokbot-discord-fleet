/** Read-only mode switch for the discord-fleet MCP server. */
import { readEnv } from "./env.js";

export const READ_ONLY_ENV = "DISCORD_FLEET_READ_ONLY";

/** Truthy values: 1, true, yes, on (case-insensitive). Anything else is off. */
export function parseReadOnly(value: string | undefined | null): boolean {
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function readOnlyFromEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return parseReadOnly(readEnv(READ_ONLY_ENV, env));
}
