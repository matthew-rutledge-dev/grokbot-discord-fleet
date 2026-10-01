#!/usr/bin/env node
/**
 * Stub stdio MCP: discord-fleet-status
 * No Discord tokens. Wire to bridge status endpoint later.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "discord-fleet-status", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "fleet_health",
      description:
        "Stub fleet health check. Returns placeholder JSON; wire to bridge status later.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "list_channel_map_stub",
      description:
        "Read-only stub channel map. Live map lives on the bridge host, not in this plugin.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;

  if (name === "fleet_health") {
    const body = {
      ok: true,
      note: "stub — wire to bridge status endpoint later",
      bridgeRepo: "matthew-rutledge-dev/grok-bot-discord-bridge",
      wakeHostHint:
        "/opt/sites/discord-fleet-wake on servergen1 (Diablo owns)",
    };
    return {
      content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
    };
  }

  if (name === "list_channel_map_stub") {
    const body = {
      note: "read-only stub; live map lives on bridge host, not in this plugin",
      channels: [] as unknown[],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
    };
  }

  return {
    content: [{ type: "text", text: `Unknown tool: ${name}` }],
    isError: true,
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
