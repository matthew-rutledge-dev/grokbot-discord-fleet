#!/usr/bin/env node
/**
 * discord-fleet MCP — one server for Discord fleet status + manage.
 * Status: optional bridge /healthz + Discord REST reads.
 * Manage: boundary docs, dry-run plans, Discord REST reads (no confirm) and
 * confirm-gated writes (post / moderation). Read-only mode
 * (DISCORD_FLEET_READ_ONLY on; unrecognised non-empty values also mean on)
 * hides write tools.
 * Not on the wake path: no sendPrompt, no gateway, no bridge /discord/callback.
 * Token from env only.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { DiscordApiError } from "./discord.js";
import { handleManageTool } from "./manage.js";
import { jsonResult } from "./result.js";
import { handleStatusTool } from "./status.js";
import {
  READ_ONLY_ENV,
  isWriteTool,
  listTools,
  readOnlyResolutionFromEnv,
  type ReadOnlyResolution,
} from "./tools.js";
import { SERVER_NAME, VERSION } from "./version.js";

/** Read-only is resolved once at start; every handler uses this resolution. */
export function createServer(readOnlyState: ReadOnlyResolution): Server {
  const readOnly = readOnlyState.readOnly;
  const server = new Server(
    { name: SERVER_NAME, version: VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: listTools(readOnly),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;

    if (readOnly && isWriteTool(name)) {
      return jsonResult(
        {
          ok: false,
          readOnly: true,
          error: `Refused: ${name} is a write tool and ${READ_ONLY_ENV} is on. No Discord call made.`,
        },
        true,
      );
    }

    try {
      const result =
        (await handleStatusTool(name, args)) ??
        (await handleManageTool(name, args, { readOnly: readOnlyState }));
      if (result) return result;
      return jsonResult({ error: `Unknown tool: ${name}` }, true);
    } catch (err) {
      if (err instanceof DiscordApiError) {
        return jsonResult(
          { error: err.message, status: err.status, body: err.body },
          true,
        );
      }
      const msg = err instanceof Error ? err.message : String(err);
      return jsonResult({ error: msg }, true);
    }
  });

  return server;
}

async function main() {
  const readOnlyState = readOnlyResolutionFromEnv();
  if (readOnlyState.warning) console.error(readOnlyState.warning);
  const transport = new StdioServerTransport();
  await createServer(readOnlyState).connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
