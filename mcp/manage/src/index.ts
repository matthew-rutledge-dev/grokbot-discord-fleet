#!/usr/bin/env node
/**
 * discord-fleet-manage MCP — boundary + dry-run plans + gated read helpers.
 * No wake / sendPrompt. Writes to Discord or bridge config are NOT implemented.
 * Token from env only.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  channelTypeName,
  discordGet,
  DiscordApiError,
  hasBotToken,
  requireBotToken,
  type DiscordChannel,
  type DiscordGuild,
  type DiscordRole,
} from "./discord.js";

const BRIDGE_REPO = "matthew-rutledge-dev/grok-bot-discord-bridge";
const WAKE_HOST_HINT =
  "/opt/sites/discord-fleet-wake on servergen1 (Diablo owns — do not deploy from this plugin)";

const server = new Server(
  { name: "discord-fleet-manage", version: "0.2.0" },
  { capabilities: { tools: {} } },
);

function jsonResult(body: unknown, isError = false) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(body, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

function requireConfirm(args: Record<string, unknown>, tool: string): string | null {
  if (args.confirm === true) return null;
  return `Refused: ${tool} requires confirm=true (explicit confirmation). No Discord call made.`;
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "describe_manage_boundary",
      description:
        "Explains manage/status vs wake: this plugin does NOT wake bots or call sendPrompt.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "plan_channel_binding",
      description:
        "Dry-run channel binding plan for bridge channel-map.json. Optional agentAlias/agentId and channelId. No Discord writes, no side effects.",
      inputSchema: {
        type: "object",
        properties: {
          agentAlias: {
            type: "string",
            description: "Optional human alias for the planned agent",
          },
          agentId: {
            type: "string",
            description: "Optional Grok Bot agentId for the map row",
          },
          channelId: {
            type: "string",
            description: "Optional Discord channel snowflake",
          },
          label: {
            type: "string",
            description: "Optional label for the map row",
          },
          requireMention: {
            type: "boolean",
            description: "Optional requireMention for the draft row",
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: "inspect_guild",
      description:
        "Non-destructive Discord REST snapshot: guild metadata, roles, and channels. Requires confirm=true. Needs DISCORD_BOT_TOKEN.",
      inputSchema: {
        type: "object",
        properties: {
          guildId: {
            type: "string",
            description:
              "Guild snowflake. Defaults to DISCORD_GUILD_ID env when omitted.",
          },
          confirm: {
            type: "boolean",
            description: "Must be true to run the Discord REST reads",
          },
        },
        required: ["confirm"],
        additionalProperties: false,
      },
    },
    {
      name: "resolve_channel",
      description:
        "Non-destructive Discord REST GET /channels/{id}. Requires confirm=true. Needs DISCORD_BOT_TOKEN.",
      inputSchema: {
        type: "object",
        properties: {
          channelId: {
            type: "string",
            description: "Discord channel snowflake",
          },
          confirm: {
            type: "boolean",
            description: "Must be true to run the Discord REST read",
          },
        },
        required: ["channelId", "confirm"],
        additionalProperties: false,
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = (request.params.arguments ?? {}) as Record<string, unknown>;

  try {
    if (name === "describe_manage_boundary") {
      return jsonResult({
        pluginRole: "manage + status only",
        version: "0.2.0",
        wakesBots: false,
        sendPrompt: false,
        gatewayListen: false,
        wakePath:
          "Zion Gateway → sendPrompt/webhook via matthew-rutledge-dev/grok-bot-discord-bridge",
        wakeHostHint: WAKE_HOST_HINT,
        bridgeHttp: {
          healthz: "GET /healthz (liveness + discordReady)",
          callback: "POST /callback (agent delivery — not this plugin)",
        },
        managePolicy: {
          plan_channel_binding: "dry-run only",
          inspect_guild: "read-only Discord REST; requires confirm=true",
          resolve_channel: "read-only Discord REST; requires confirm=true",
          writes: "not implemented — enable map rows on bridge host only",
        },
        secrets:
          "DISCORD_BOT_TOKEN from env / plugin variables; host vault DISCORD_FLEET_WAKE. Never commit tokens.",
        note: "Do not invent wake calls from this plugin.",
      });
    }

    if (name === "plan_channel_binding") {
      const agentAlias =
        typeof args.agentAlias === "string" ? args.agentAlias : null;
      const agentId = typeof args.agentId === "string" ? args.agentId : null;
      const channelId =
        typeof args.channelId === "string" ? args.channelId : null;
      const label = typeof args.label === "string" ? args.label : null;
      const requireMention =
        typeof args.requireMention === "boolean" ? args.requireMention : false;

      const draftRow = {
        enabled: false,
        channelId: channelId ?? "<channel-snowflake>",
        label: label ?? agentAlias ?? "draft — keep enabled=false until go-live",
        agentId: agentId ?? "",
        sendPromptUrl: null,
        requireMention,
      };

      return jsonResult({
        dryRun: true,
        sideEffects: false,
        discordApiCalls: false,
        agentAlias,
        channelId,
        draftChannelMapRow: draftRow,
        steps: [
          "Confirm guild is allowlisted in bridge config/security.json",
          "Confirm channel exists (use resolve_channel with confirm=true if needed)",
          "Pick a real Grok Bot agentId (empty agentId stays deny)",
          "On bridge host only: add/edit config/channel-map.json row; leave enabled=false until ready",
          "Set enabled=true only after DISCORD_BOT_TOKEN is live and Compose is intentionally started",
          "Verify with bridge GET /healthz → discordReady: true (not this plugin)",
        ],
        bridgeRepo: BRIDGE_REPO,
        wakeHostHint: WAKE_HOST_HINT,
        note: "Dry-run plan only. This plugin never writes channel-map.json or wakes bots.",
      });
    }

    if (name === "inspect_guild") {
      const refused = requireConfirm(args, "inspect_guild");
      if (refused) return jsonResult({ ok: false, error: refused }, true);

      const guildId =
        (typeof args.guildId === "string" && args.guildId.trim()) ||
        process.env.DISCORD_GUILD_ID?.trim() ||
        null;
      if (!guildId) {
        return jsonResult(
          {
            ok: false,
            error:
              "guildId required (argument or DISCORD_GUILD_ID env). No Discord call made.",
          },
          true,
        );
      }

      const token = requireBotToken();
      const [guild, roles, channels] = await Promise.all([
        discordGet<DiscordGuild>(`/guilds/${guildId}?with_counts=true`, token),
        discordGet<DiscordRole[]>(`/guilds/${guildId}/roles`, token),
        discordGet<DiscordChannel[]>(`/guilds/${guildId}/channels`, token),
      ]);

      return jsonResult({
        ok: true,
        confirm: true,
        destructive: false,
        discordWrites: false,
        guild: {
          id: guild.id,
          name: guild.name,
          owner_id: guild.owner_id ?? null,
          approximate_member_count: guild.approximate_member_count ?? null,
        },
        roles: roles
          .map((r) => ({
            id: r.id,
            name: r.name,
            managed: r.managed ?? false,
            position: r.position ?? 0,
          }))
          .sort((a, b) => b.position - a.position),
        channels: channels
          .map((c) => ({
            id: c.id,
            name: c.name ?? null,
            type: c.type,
            typeName: channelTypeName(c.type),
            parent_id: c.parent_id ?? null,
            position: c.position ?? null,
          }))
          .sort(
            (a, b) =>
              (a.position ?? 0) - (b.position ?? 0) ||
              (a.name ?? "").localeCompare(b.name ?? ""),
          ),
        note: "Read-only snapshot. Enabling map rows / security edits happen on the bridge host only.",
      });
    }

    if (name === "resolve_channel") {
      const refused = requireConfirm(args, "resolve_channel");
      if (refused) return jsonResult({ ok: false, error: refused }, true);

      const channelId =
        typeof args.channelId === "string" ? args.channelId.trim() : "";
      if (!channelId) {
        return jsonResult(
          { ok: false, error: "channelId is required" },
          true,
        );
      }

      const token = requireBotToken();
      const channel = await discordGet<DiscordChannel>(
        `/channels/${channelId}`,
        token,
      );

      return jsonResult({
        ok: true,
        confirm: true,
        destructive: false,
        discordWrites: false,
        channel: {
          id: channel.id,
          name: channel.name ?? null,
          type: channel.type,
          typeName: channelTypeName(channel.type),
          parent_id: channel.parent_id ?? null,
          topic: channel.topic ?? null,
        },
        note: "Read-only. Use plan_channel_binding to draft a map row; apply on bridge host.",
      });
    }

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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
