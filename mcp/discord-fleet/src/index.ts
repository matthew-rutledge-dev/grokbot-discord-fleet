#!/usr/bin/env node
/**
 * discord-fleet MCP — one server for Discord fleet status + manage.
 * Status: optional bridge /healthz + Discord REST reads.
 * Manage: boundary docs, dry-run plans, confirm-gated Discord REST reads and
 * writes (post / moderation). DISCORD_FLEET_READ_ONLY=1 hides write tools.
 * Not on the wake path: no sendPrompt, no gateway, no bridge /callback.
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
  readOnlyFromEnv,
} from "./tools.js";
import { SERVER_NAME, VERSION } from "./version.js";

export function createServer(readOnly = readOnlyFromEnv()): Server {
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
        (await handleManageTool(name, args));
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
  const transport = new StdioServerTransport();
  await createServer().connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
