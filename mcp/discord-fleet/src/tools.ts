/**
 * Tool registry for the single discord-fleet MCP server.
 *
 * All status + manage tools live in one server. Set
 * DISCORD_FLEET_READ_ONLY on (1/true/yes/on, or any unrecognised non-empty
 * value, which fails closed) to hide every tool that can
 * write to Discord (post / moderation). Hidden tools are also refused at call
 * time. Write tools keep their own confirm=true gate in both modes.
 */
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { MANAGE_TOOLS } from "./manage.js";
import { STATUS_TOOLS } from "./status.js";

export {
  READ_ONLY_ENV,
  parseReadOnly,
  readOnlyFromEnv,
  readOnlyResolutionFromEnv,
  resolveReadOnly,
  describeReadOnly,
  type ReadOnlyResolution,
  type ReadOnlySource,
} from "./readonly.js";

/** Tools that can change Discord state when called with confirm=true. */
export const WRITE_TOOL_NAMES: ReadonlySet<string> = new Set([
  "post_channel_message",
  "timeout_member",
  "kick_member",
  "ban_member",
  "unban_member",
  "delete_message",
  "purge_channel_messages",
]);

export const ALL_TOOLS: Tool[] = [...STATUS_TOOLS, ...MANAGE_TOOLS];

export function isWriteTool(name: string): boolean {
  return WRITE_TOOL_NAMES.has(name);
}

export function listTools(readOnly: boolean): Tool[] {
  return readOnly ? ALL_TOOLS.filter((t) => !isWriteTool(t.name)) : ALL_TOOLS;
}
