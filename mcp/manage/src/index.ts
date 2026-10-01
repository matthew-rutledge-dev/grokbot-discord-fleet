#!/usr/bin/env node
/**
 * Stub stdio MCP: discord-fleet-manage
 * Dry-run only. No Discord API calls. No tokens.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "discord-fleet-manage", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "describe_manage_boundary",
      description:
        "Explains manage/status vs wake: this plugin does NOT wake bots.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "plan_channel_binding",
      description:
        "Dry-run channel binding plan. Optional agentAlias and channelId. No side effects.",
      inputSchema: {
        type: "object",
        properties: {
          agentAlias: {
            type: "string",
            description: "Optional agent alias for the planned binding",
          },
          channelId: {
            type: "string",
            description: "Optional Discord channel id for the planned binding",
          },
        },
        additionalProperties: false,
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = (request.params.arguments ?? {}) as Record<string, unknown>;

  if (name === "describe_manage_boundary") {
    const body = {
      pluginRole: "manage + status only",
      wakesBots: false,
      wakePath:
        "Zion Gateway → sendPrompt/webhook via matthew-rutledge-dev/grok-bot-discord-bridge",
      wakeHostHint:
        "/opt/sites/discord-fleet-wake on servergen1 (Diablo owns)",
      note: "Do not invent wake calls from this plugin. No secrets in git.",
    };
    return {
      content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
    };
  }

  if (name === "plan_channel_binding") {
    const agentAlias =
      typeof args.agentAlias === "string" ? args.agentAlias : null;
    const channelId =
      typeof args.channelId === "string" ? args.channelId : null;
    const body = {
      dryRun: true,
      sideEffects: false,
      discordApiCalls: false,
      agentAlias,
      channelId,
      steps: [
        "Validate agentAlias and channelId against live map on bridge host (not in this plugin)",
        "Draft binding record (stub — no write)",
        "Matthew wires real Discord manage APIs later; until then this is plan-only",
      ],
      note: "Dry-run plan only. Runtime wake config stays on grok-bot-discord-bridge.",
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
