/**
 * Read-only mode switch for the discord-fleet MCP server.
 *
 * Fails closed:
 * - unset, empty, or an unexpanded ${...} placeholder -> off
 * - explicit off values (0, false, no, off; case-insensitive) -> off
 * - recognised on values (1, true, yes, on) -> on
 * - ANY other non-empty value -> on, with a warning for the operator
 */
import { readEnv } from "./env.js";

export const READ_ONLY_ENV = "DISCORD_FLEET_READ_ONLY";

const ON_VALUES = ["1", "true", "yes", "on"];
const OFF_VALUES = ["0", "false", "no", "off"];

export type ReadOnlyResolution = {
  readOnly: boolean;
  /** Set when the value was not a recognised on/off value (treated as on). */
  warning?: string;
};

/** Resolve an already-read env value (undefined = unset / empty / placeholder). */
export function resolveReadOnly(value: string | undefined | null): ReadOnlyResolution {
  if (typeof value !== "string") return { readOnly: false };
  const v = value.trim().toLowerCase();
  if (v === "") return { readOnly: false };
  if (OFF_VALUES.includes(v)) return { readOnly: false };
  if (ON_VALUES.includes(v)) return { readOnly: true };
  const shown = JSON.stringify(value.trim().slice(0, 32));
  return {
    readOnly: true,
    warning: `discord-fleet: ${READ_ONLY_ENV}=${shown} is not a recognised value; treating it as ON (read-only, write tools hidden). Use 1/true/yes/on or 0/false/no/off.`,
  };
}

/** Boolean form of resolveReadOnly. */
export function parseReadOnly(value: string | undefined | null): boolean {
  return resolveReadOnly(value).readOnly;
}

/** Read DISCORD_FLEET_READ_ONLY via the shared env reader (placeholders = unset). */
export function readOnlyResolutionFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ReadOnlyResolution {
  return resolveReadOnly(readEnv(READ_ONLY_ENV, env));
}

export function readOnlyFromEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return readOnlyResolutionFromEnv(env).readOnly;
}
