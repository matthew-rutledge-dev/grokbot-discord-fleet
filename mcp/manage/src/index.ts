#!/usr/bin/env node
/**
 * discord-fleet-manage MCP — boundary + dry-run plans + gated Discord REST.
 * Confirm-gated reads + confirm-gated message post. No wake / sendPrompt.
 * Bridge channel-map / security.json writes are NOT implemented here.
 * Token from env only.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  applyMemberOverwrite,
  channelTypeName,
  computeChannelPermissions,
  discordGet,
  discordPost,
  DiscordApiError,
  permissionFlags,
  Perm,
  requireBotToken,
  type DiscordChannel,
  type DiscordGuild,
  type DiscordGuildMember,
  type DiscordMessage,
  type DiscordRole,
  type DiscordUser,
} from "./discord.js";

const BRIDGE_REPO = "matthew-rutledge-dev/grok-bot-discord-bridge";
const WAKE_HOST_HINT =
  "Use your own host and deploy path for optional bridge setup; do not deploy from this plugin";
const MSG_LIMIT_MAX = 50;
const CONTENT_PREVIEW_MAX = 500;

const server = new Server(
  { name: "discord-fleet-manage", version: "0.3.22" },
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

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "describe_manage_boundary",
      description:
        "Explains manage/status vs wake: this plugin does NOT wake bots or call sendPrompt. Lists confirm-gated Discord REST tools.",
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
    {
      name: "list_channel_messages",
      description:
        "Read-only Discord REST GET /channels/{id}/messages (last N, max 50). Requires confirm=true. Needs DISCORD_BOT_TOKEN. Not wake.",
      inputSchema: {
        type: "object",
        properties: {
          channelId: {
            type: "string",
            description: "Discord channel snowflake",
          },
          limit: {
            type: "number",
            description: `Number of recent messages (1–${MSG_LIMIT_MAX}; default 20)`,
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
    {
      name: "post_channel_message",
      description:
        "Confirm-gated Discord REST POST /channels/{id}/messages. Requires confirm=true to send; without confirm returns a dry-run preview only. Refuses empty content. Needs DISCORD_BOT_TOKEN. Not wake / not sendPrompt / not bridge /callback.",
      inputSchema: {
        type: "object",
        properties: {
          channelId: {
            type: "string",
            description: "Discord channel snowflake",
          },
          content: {
            type: "string",
            description: "Message content (non-empty; Discord max 2000 chars)",
          },
          confirm: {
            type: "boolean",
            description:
              "Must be true to actually post. If omitted/false, returns dry-run preview with no Discord write.",
          },
        },
        required: ["channelId", "content"],
        additionalProperties: false,
      },
    },
    {
      name: "check_bot_channel_permissions",
      description:
        "Confirm-gated check of the bot's effective permissions in a channel (VIEW_CHANNEL / SEND_MESSAGES / READ_MESSAGE_HISTORY + related flags). Requires confirm=true. Needs DISCORD_BOT_TOKEN. Computes from guild roles + channel overwrites (Discord has no single 'my channel perms' REST for bots).",
      inputSchema: {
        type: "object",
        properties: {
          channelId: {
            type: "string",
            description: "Discord channel snowflake",
          },
          guildId: {
            type: "string",
            description:
              "Optional guild snowflake. Defaults to channel.guild_id, then DISCORD_GUILD_ID.",
          },
          confirm: {
            type: "boolean",
            description: "Must be true to run Discord REST reads",
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
        version: "0.3.22",
        wakesBots: false,
        sendPrompt: false,
        gatewayListen: false,
        wakePath:
          "Your gateway → sendPrompt/webhook via matthew-rutledge-dev/grok-bot-discord-bridge",
        wakeHostHint: WAKE_HOST_HINT,
        bridgeHttp: {
          healthz: "GET /healthz (liveness + discordReady)",
          callback: "POST /callback (agent delivery — not this plugin)",
        },
        managePolicy: {
          plan_channel_binding: "dry-run only",
          inspect_guild: "read-only Discord REST; requires confirm=true",
          resolve_channel: "read-only Discord REST; requires confirm=true",
          list_channel_messages:
            "read-only Discord REST message history; requires confirm=true; limit capped at 50",
          post_channel_message:
            "confirm-gated Discord REST create message; dry-run preview without confirm=true; refuses empty content",
          check_bot_channel_permissions:
            "read-only computed bot channel permissions; requires confirm=true",
          bridgeConfigWrites:
            "channel-map.json / security.json writes not implemented — enable map rows on bridge host only",
        },
        secrets:
          "DISCORD_BOT_TOKEN from env / plugin variables; use your host vault for secrets. Never commit tokens.",
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
          "Optionally check_bot_channel_permissions (confirm=true) for View/Send/History",
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
          guild_id: channel.guild_id ?? null,
          parent_id: channel.parent_id ?? null,
          topic: channel.topic ?? null,
        },
        note: "Read-only. Use plan_channel_binding to draft a map row; apply on bridge host.",
      });
    }

    if (name === "list_channel_messages") {
      const refused = requireConfirm(args, "list_channel_messages");
      if (refused) return jsonResult({ ok: false, error: refused }, true);

      const channelId =
        typeof args.channelId === "string" ? args.channelId.trim() : "";
      if (!channelId) {
        return jsonResult(
          { ok: false, error: "channelId is required" },
          true,
        );
      }

      let limit = 20;
      if (typeof args.limit === "number" && Number.isFinite(args.limit)) {
        limit = Math.floor(args.limit);
      }
      if (limit < 1) limit = 1;
      if (limit > MSG_LIMIT_MAX) limit = MSG_LIMIT_MAX;

      const token = requireBotToken();
      const messages = await discordGet<DiscordMessage[]>(
        `/channels/${channelId}/messages?limit=${limit}`,
        token,
      );

      return jsonResult({
        ok: true,
        confirm: true,
        destructive: false,
        discordWrites: false,
        channelId,
        limit,
        count: messages.length,
        messages: messages.map((m) => ({
          id: m.id,
          author: m.author
            ? {
                id: m.author.id,
                username: m.author.username,
                bot: m.author.bot ?? false,
              }
            : null,
          content: truncate(m.content ?? "", CONTENT_PREVIEW_MAX),
          timestamp: m.timestamp ?? null,
          type: m.type ?? null,
          attachmentCount: m.attachments?.length ?? 0,
        })),
        note: "Read-only history. Newest first (Discord default). Content truncated for MCP payload size.",
      });
    }

    if (name === "post_channel_message") {
      const channelId =
        typeof args.channelId === "string" ? args.channelId.trim() : "";
      const content =
        typeof args.content === "string" ? args.content : "";
      if (!channelId) {
        return jsonResult(
          { ok: false, error: "channelId is required" },
          true,
        );
      }
      if (!content.trim()) {
        return jsonResult(
          {
            ok: false,
            error: "content is required and must be non-empty. No Discord call made.",
          },
          true,
        );
      }
      if (content.length > 2000) {
        return jsonResult(
          {
            ok: false,
            error: `content exceeds Discord 2000-character limit (${content.length}). No Discord call made.`,
          },
          true,
        );
      }

      if (args.confirm !== true) {
        return jsonResult({
          ok: true,
          dryRun: true,
          sideEffects: false,
          discordWrites: false,
          wouldPost: {
            channelId,
            contentPreview: truncate(content, CONTENT_PREVIEW_MAX),
            contentLength: content.length,
          },
          note: "Dry-run preview only. Re-call with confirm=true to POST the message. Not wake / not bridge /callback.",
        });
      }

      const token = requireBotToken();
      const created = await discordPost<DiscordMessage>(
        `/channels/${channelId}/messages`,
        token,
        { content },
      );

      return jsonResult({
        ok: true,
        confirm: true,
        dryRun: false,
        discordWrites: true,
        wake: false,
        message: {
          id: created.id,
          channel_id: created.channel_id ?? channelId,
          contentPreview: truncate(created.content ?? content, CONTENT_PREVIEW_MAX),
          timestamp: created.timestamp ?? null,
        },
        note: "Message created via Discord REST. This is not wake/sendPrompt and does not call bridge /callback.",
      });
    }

    if (name === "check_bot_channel_permissions") {
      const refused = requireConfirm(args, "check_bot_channel_permissions");
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
      const [me, channel] = await Promise.all([
        discordGet<DiscordUser>("/users/@me", token),
        discordGet<DiscordChannel>(`/channels/${channelId}`, token),
      ]);

      const guildId =
        (typeof args.guildId === "string" && args.guildId.trim()) ||
        channel.guild_id ||
        process.env.DISCORD_GUILD_ID?.trim() ||
        null;

      // DM / Group DM — no guild overwrites; bot typically can interact if channel resolved.
      if (!guildId || channel.type === 1 || channel.type === 3) {
        const flags = permissionFlags(
          Perm.VIEW_CHANNEL |
            Perm.SEND_MESSAGES |
            Perm.READ_MESSAGE_HISTORY |
            Perm.ATTACH_FILES |
            Perm.EMBED_LINKS |
            Perm.ADD_REACTIONS,
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
            guild_id: channel.guild_id ?? null,
          },
          bot: { id: me.id, username: me.username },
          guildId: null,
          computed: false,
          assumption: "dm_or_no_guild",
          permissions: flags,
          note: "DM/Group DM (or no guild id): Discord does not expose overwrite math; assuming typical bot DM capabilities after channel resolve succeeded.",
        });
      }

      const [member, roles] = await Promise.all([
        discordGet<DiscordGuildMember>(
          `/guilds/${guildId}/members/${me.id}`,
          token,
        ),
        discordGet<DiscordRole[]>(`/guilds/${guildId}/roles`, token),
      ]);

      // Ensure channel overwrites are present; guild channel list may omit them —
      // GET /channels/{id} includes permission_overwrites for guild channels.
      const overwrites = channel.permission_overwrites ?? [];
      let perms = computeChannelPermissions({
        guildId,
        memberRoleIds: member.roles ?? [],
        roles,
        overwrites,
      });
      if ((perms & Perm.ADMINISTRATOR) === Perm.ADMINISTRATOR) {
        // ADMINISTRATOR short-circuit already in permissionFlags
      } else {
        perms = applyMemberOverwrite(perms, me.id, overwrites);
      }
      const flags = permissionFlags(perms);

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
          guild_id: channel.guild_id ?? null,
        },
        bot: { id: me.id, username: me.username },
        guildId,
        memberRoleIds: member.roles ?? [],
        computed: true,
        permissions: flags,
        note: "Computed from @everyone + member roles + channel overwrites (Discord REST has no single bot channel-perm endpoint). Useful before post_channel_message or enabling a bridge map row.",
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
