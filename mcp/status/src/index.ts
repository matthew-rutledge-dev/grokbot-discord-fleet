#!/usr/bin/env node
/**
 * discord-fleet-status MCP — bridge /healthz + Discord REST reads.
 * Not on the wake path. No sendPrompt. Token from env only.
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
  type DiscordGuildPartial,
  type DiscordUser,
} from "./discord.js";

const BRIDGE_REPO = "matthew-rutledge-dev/grok-bot-discord-bridge";
const WAKE_HOST_HINT =
  "/opt/sites/discord-fleet-wake on servergen1 (Diablo owns — do not deploy from this plugin)";

/** Documented channel-map schema (SoT lives on bridge host, not in this plugin). */
const CHANNEL_MAP_SCHEMA = {
  version: 1,
  defaultSendPromptUrl: null as string | null,
  channels: [
    {
      enabled: false,
      channelId: "<snowflake>",
      label: "optional",
      agentId: "",
      sendPromptUrl: null as string | null,
      requireMention: false,
    },
  ],
};

const server = new Server(
  { name: "discord-fleet-status", version: "0.2.0" },
  { capabilities: { tools: {} } },
);

function jsonResult(body: unknown, isError = false) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(body, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

function bridgeHealthUrl(): string | undefined {
  const explicit = process.env.DISCORD_BRIDGE_HEALTH_URL?.trim();
  if (explicit) return explicit;
  return undefined;
}

async function probeBridgeHealth(url: string): Promise<{
  reachable: boolean;
  url: string;
  statusCode?: number;
  body?: unknown;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);
    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* keep raw */
    }
    return {
      reachable: res.ok,
      url,
      statusCode: res.status,
      body,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { reachable: false, url, error: msg };
  }
}

async function discordIdentity(token: string) {
  const me = await discordGet<DiscordUser>("/users/@me", token);
  const guilds = await discordGet<DiscordGuildPartial[]>(
    "/users/@me/guilds",
    token,
  );
  return {
    bot: {
      id: me.id,
      username: me.username,
      global_name: me.global_name ?? null,
      bot: me.bot ?? true,
    },
    guildCount: guilds.length,
    guilds: guilds.map((g) => ({
      id: g.id,
      name: g.name,
      owner: g.owner ?? false,
    })),
  };
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "fleet_health",
      description:
        "Fleet health: optional bridge GET /healthz (DISCORD_BRIDGE_HEALTH_URL) plus Discord REST /users/@me and guilds when DISCORD_BOT_TOKEN is set. Read-only. Not wake.",
      inputSchema: {
        type: "object",
        properties: {
          includeGuilds: {
            type: "boolean",
            description:
              "Include guild list from Discord REST (default true when token present)",
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: "list_channel_map",
      description:
        "Read-only channel map shape (bridge schema) and, when token + guild id are available, Discord guild channels for that guild. Live enabled map rows stay on the bridge host.",
      inputSchema: {
        type: "object",
        properties: {
          guildId: {
            type: "string",
            description:
              "Discord guild snowflake. Defaults to DISCORD_GUILD_ID env.",
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

  try {
    if (name === "fleet_health") {
      const includeGuilds = args.includeGuilds !== false;
      const healthUrl = bridgeHealthUrl();
      const bridge = healthUrl
        ? await probeBridgeHealth(healthUrl)
        : {
            reachable: false,
            url: null as string | null,
            note: "DISCORD_BRIDGE_HEALTH_URL unset — skip bridge probe. Bridge SoT is GET /healthz on host loopback :18083 (tunnel if remote).",
          };

      let discord: unknown = null;
      let discordError: string | null = null;
      if (hasBotToken()) {
        try {
          const token = requireBotToken();
          const identity = await discordIdentity(token);
          discord = includeGuilds
            ? identity
            : { bot: identity.bot, guildCount: identity.guildCount };
        } catch (err) {
          if (err instanceof DiscordApiError) {
            discordError = `${err.message} body=${err.body}`;
          } else {
            discordError = err instanceof Error ? err.message : String(err);
          }
        }
      } else {
        discordError =
          "DISCORD_BOT_TOKEN not set — Discord REST skipped. Vault hint: DISCORD_FLEET_WAKE (host).";
      }

      const ok =
        (typeof bridge === "object" &&
          bridge !== null &&
          "reachable" in bridge &&
          (bridge as { reachable: boolean }).reachable) ||
        (discord !== null && discordError === null);

      return jsonResult({
        ok,
        plugin: "discord-fleet-status",
        version: "0.2.0",
        wakesBots: false,
        bridgeRepo: BRIDGE_REPO,
        wakeHostHint: WAKE_HOST_HINT,
        bridgeHealth: bridge,
        discord,
        discordError,
        envHints: {
          DISCORD_BOT_TOKEN: hasBotToken() ? "set" : "missing",
          DISCORD_BRIDGE_HEALTH_URL: healthUrl ? "set" : "missing",
          DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID?.trim()
            ? "set"
            : "missing",
        },
      });
    }

    if (name === "list_channel_map") {
      const guildId =
        (typeof args.guildId === "string" && args.guildId.trim()) ||
        process.env.DISCORD_GUILD_ID?.trim() ||
        null;

      const body: Record<string, unknown> = {
        note: "Live channel-map.json + security.json live on the bridge host, not in this plugin. Schema below matches bridge README.",
        bridgeRepo: BRIDGE_REPO,
        channelMapSchema: CHANNEL_MAP_SCHEMA,
        securityModel:
          "deny-by-default: guild allowlist → users → roles → channels → enabled map row → mention",
        guildId,
        discordChannels: null as unknown,
      };

      if (!guildId) {
        body.discordChannelsError =
          "No guildId argument and DISCORD_GUILD_ID unset — returning schema only.";
        return jsonResult(body);
      }

      if (!hasBotToken()) {
        body.discordChannelsError =
          "DISCORD_BOT_TOKEN not set — cannot list Discord channels for guild.";
        return jsonResult(body);
      }

      const token = requireBotToken();
      const channels = await discordGet<DiscordChannel[]>(
        `/guilds/${guildId}/channels`,
        token,
      );
      body.discordChannels = channels
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
        );
      return jsonResult(body);
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
