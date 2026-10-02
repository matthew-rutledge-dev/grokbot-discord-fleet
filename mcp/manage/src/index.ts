#!/usr/bin/env node
/**
 * discord-fleet-manage MCP — boundary + dry-run plans + gated Discord REST.
 * Confirm-gated reads + confirm-gated writes (post / moderation). No wake / sendPrompt.
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
  discordDelete,
  discordGet,
  discordPatch,
  discordPost,
  discordPut,
  DiscordApiError,
  isBulkDeleteEligible,
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
const PURGE_LIMIT_MAX = 100;
const CONTENT_PREVIEW_MAX = 500;
const TIMEOUT_MAX_SECONDS = 28 * 24 * 60 * 60; // Discord max ~28 days
const DELETE_MESSAGE_SECONDS_MAX = 604800; // Discord ban delete_message_seconds max 7d

const server = new Server(
  { name: "discord-fleet-manage", version: "0.3.24" },
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

function asTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function optionalReason(args: Record<string, unknown>): string | undefined {
  const r = asTrimmedString(args.reason);
  return r || undefined;
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "describe_manage_boundary",
      description:
        "Explains manage/status vs wake: this plugin does NOT wake bots or call sendPrompt. Lists confirm-gated Discord REST tools (inspect, history, post, moderation).",
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
        "Confirm-gated check of the bot's effective permissions in a channel (VIEW/SEND/HISTORY/MANAGE_MESSAGES + guild Kick/Ban/Moderate when computable). Requires confirm=true. Needs DISCORD_BOT_TOKEN.",
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
    {
      name: "timeout_member",
      description:
        "Confirm-gated Discord timeout (Moderate Members). PATCH member communication_disabled_until. durationSeconds=0 clears timeout. Dry-run without confirm=true. Needs DISCORD_BOT_TOKEN. Not wake.",
      inputSchema: {
        type: "object",
        properties: {
          guildId: {
            type: "string",
            description:
              "Guild snowflake. Defaults to DISCORD_GUILD_ID env when omitted.",
          },
          userId: {
            type: "string",
            description: "Target user snowflake",
          },
          durationSeconds: {
            type: "number",
            description:
              "Timeout length in seconds (0 clears). Max ~28 days (2419200).",
          },
          reason: {
            type: "string",
            description: "Optional audit-log reason",
          },
          confirm: {
            type: "boolean",
            description:
              "Must be true to apply. If omitted/false, returns dry-run preview only.",
          },
        },
        required: ["userId", "durationSeconds"],
        additionalProperties: false,
      },
    },
    {
      name: "kick_member",
      description:
        "Confirm-gated Discord kick (Kick Members). Dry-run without confirm=true. Needs DISCORD_BOT_TOKEN. Not wake.",
      inputSchema: {
        type: "object",
        properties: {
          guildId: {
            type: "string",
            description:
              "Guild snowflake. Defaults to DISCORD_GUILD_ID env when omitted.",
          },
          userId: {
            type: "string",
            description: "Target user snowflake",
          },
          reason: {
            type: "string",
            description: "Optional audit-log reason",
          },
          confirm: {
            type: "boolean",
            description:
              "Must be true to kick. If omitted/false, returns dry-run preview only.",
          },
        },
        required: ["userId"],
        additionalProperties: false,
      },
    },
    {
      name: "ban_member",
      description:
        "Confirm-gated Discord ban (Ban Members). Optional deleteMessageSeconds (0–604800). Dry-run without confirm=true. Needs DISCORD_BOT_TOKEN. Not wake.",
      inputSchema: {
        type: "object",
        properties: {
          guildId: {
            type: "string",
            description:
              "Guild snowflake. Defaults to DISCORD_GUILD_ID env when omitted.",
          },
          userId: {
            type: "string",
            description: "Target user snowflake",
          },
          deleteMessageSeconds: {
            type: "number",
            description:
              "Optional seconds of message history to delete (0–604800; Discord max 7d)",
          },
          reason: {
            type: "string",
            description: "Optional audit-log reason",
          },
          confirm: {
            type: "boolean",
            description:
              "Must be true to ban. If omitted/false, returns dry-run preview only.",
          },
        },
        required: ["userId"],
        additionalProperties: false,
      },
    },
    {
      name: "unban_member",
      description:
        "Confirm-gated Discord unban (Ban Members). Dry-run without confirm=true. Needs DISCORD_BOT_TOKEN. Not wake.",
      inputSchema: {
        type: "object",
        properties: {
          guildId: {
            type: "string",
            description:
              "Guild snowflake. Defaults to DISCORD_GUILD_ID env when omitted.",
          },
          userId: {
            type: "string",
            description: "Target user snowflake",
          },
          reason: {
            type: "string",
            description: "Optional audit-log reason",
          },
          confirm: {
            type: "boolean",
            description:
              "Must be true to unban. If omitted/false, returns dry-run preview only.",
          },
        },
        required: ["userId"],
        additionalProperties: false,
      },
    },
    {
      name: "delete_message",
      description:
        "Confirm-gated Discord DELETE /channels/{id}/messages/{id} (Manage Messages for others' messages). Dry-run without confirm=true. Needs DISCORD_BOT_TOKEN. Not wake.",
      inputSchema: {
        type: "object",
        properties: {
          channelId: {
            type: "string",
            description: "Discord channel snowflake",
          },
          messageId: {
            type: "string",
            description: "Discord message snowflake",
          },
          reason: {
            type: "string",
            description: "Optional audit-log reason",
          },
          confirm: {
            type: "boolean",
            description:
              "Must be true to delete. If omitted/false, returns dry-run preview only.",
          },
        },
        required: ["channelId", "messageId"],
        additionalProperties: false,
      },
    },
    {
      name: "purge_channel_messages",
      description:
        "Confirm-gated purge: provide messageIds and/or limit (cap 100). Uses bulk-delete when Discord allows (≥2 and <100 ids, each <14d old); otherwise notes limitations / single-deletes for leftovers. Dry-run without confirm=true. Needs Manage Messages + DISCORD_BOT_TOKEN. Not wake.",
      inputSchema: {
        type: "object",
        properties: {
          channelId: {
            type: "string",
            description: "Discord channel snowflake",
          },
          limit: {
            type: "number",
            description: `Fetch last N messages to purge (1–${PURGE_LIMIT_MAX}). Used when messageIds omitted or to expand the set.`,
          },
          messageIds: {
            type: "array",
            items: { type: "string" },
            description: "Explicit message snowflakes to delete (capped at 100 total)",
          },
          reason: {
            type: "string",
            description: "Optional audit-log reason (applied to bulk/single deletes)",
          },
          confirm: {
            type: "boolean",
            description:
              "Must be true to purge. If omitted/false, returns dry-run plan only.",
          },
        },
        required: ["channelId"],
        additionalProperties: false,
      },
    },
  ],
}));

function resolveGuildId(args: Record<string, unknown>): string | null {
  return (
    (typeof args.guildId === "string" && args.guildId.trim()) ||
    process.env.DISCORD_GUILD_ID?.trim() ||
    null
  );
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = (request.params.arguments ?? {}) as Record<string, unknown>;

  try {
    if (name === "describe_manage_boundary") {
      return jsonResult({
        pluginRole: "manage + status only",
        version: "0.3.24",
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
            "read-only computed bot channel/guild permissions; requires confirm=true",
          timeout_member:
            "confirm-gated Moderate Members timeout; durationSeconds=0 clears; dry-run without confirm=true",
          kick_member:
            "confirm-gated Kick Members; dry-run without confirm=true",
          ban_member:
            "confirm-gated Ban Members; optional deleteMessageSeconds; dry-run without confirm=true",
          unban_member:
            "confirm-gated Ban Members unban; dry-run without confirm=true",
          delete_message:
            "confirm-gated Manage Messages delete; dry-run without confirm=true",
          purge_channel_messages:
            "confirm-gated Manage Messages purge (bulk-delete when eligible, else noted limits); dry-run without confirm=true; cap 100",
          bridgeConfigWrites:
            "channel-map.json / security.json writes not implemented — enable map rows on bridge host only",
        },
        requiredDiscordPermissions:
          "See README § Discord bot permissions — View/Send/History (+ Attach/Embed); moderation: Moderate Members, Kick, Ban, Manage Messages; role hierarchy required",
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
          "Optionally check_bot_channel_permissions (confirm=true) for View/Send/History (+ mod flags)",
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

      const guildId = resolveGuildId(args);
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

      const channelId = asTrimmedString(args.channelId);
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

      const channelId = asTrimmedString(args.channelId);
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
      const channelId = asTrimmedString(args.channelId);
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

      const channelId = asTrimmedString(args.channelId);
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
          note: "DM/Group DM (or no guild id): Discord does not expose overwrite math; assuming typical bot DM capabilities after channel resolve succeeded. Guild moderation perms do not apply in DMs.",
        });
      }

      const [member, roles] = await Promise.all([
        discordGet<DiscordGuildMember>(
          `/guilds/${guildId}/members/${me.id}`,
          token,
        ),
        discordGet<DiscordRole[]>(`/guilds/${guildId}/roles`, token),
      ]);

      const overwrites = channel.permission_overwrites ?? [];
      let perms = computeChannelPermissions({
        guildId,
        memberRoleIds: member.roles ?? [],
        roles,
        overwrites,
      });
      if ((perms & Perm.ADMINISTRATOR) !== Perm.ADMINISTRATOR) {
        perms = applyMemberOverwrite(perms, me.id, overwrites);
      }
      // Guild-scoped bits (kick/ban/moderate) come from role aggregate, not channel overwrites —
      // re-OR role permissions so named flags still show even when channel overwrites strip channel bits.
      let guildPerms = BigInt(
        roles.find((r) => r.id === guildId)?.permissions ?? "0",
      );
      for (const roleId of member.roles ?? []) {
        const role = roles.find((r) => r.id === roleId);
        if (role?.permissions) guildPerms |= BigInt(role.permissions);
      }
      if ((guildPerms & Perm.ADMINISTRATOR) === Perm.ADMINISTRATOR) {
        perms = Perm.ADMINISTRATOR;
      } else {
        perms |=
          guildPerms &
          (Perm.KICK_MEMBERS | Perm.BAN_MEMBERS | Perm.MODERATE_MEMBERS);
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
        note: "Computed from @everyone + member roles + channel overwrites; Kick/Ban/Moderate OR'd from guild role aggregate. Role hierarchy still required for acting on higher/equal roles. See README Discord bot permissions.",
      });
    }

    if (name === "timeout_member") {
      const userId = asTrimmedString(args.userId);
      if (!userId) {
        return jsonResult({ ok: false, error: "userId is required" }, true);
      }
      if (
        typeof args.durationSeconds !== "number" ||
        !Number.isFinite(args.durationSeconds)
      ) {
        return jsonResult(
          {
            ok: false,
            error:
              "durationSeconds is required (number; 0 clears timeout). No Discord call made.",
          },
          true,
        );
      }
      let durationSeconds = Math.floor(args.durationSeconds);
      if (durationSeconds < 0) {
        return jsonResult(
          {
            ok: false,
            error: "durationSeconds must be >= 0. No Discord call made.",
          },
          true,
        );
      }
      if (durationSeconds > TIMEOUT_MAX_SECONDS) {
        return jsonResult(
          {
            ok: false,
            error: `durationSeconds exceeds Discord max (~28 days / ${TIMEOUT_MAX_SECONDS}). No Discord call made.`,
          },
          true,
        );
      }
      const guildId = resolveGuildId(args);
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
      const reason = optionalReason(args);
      const until =
        durationSeconds === 0
          ? null
          : new Date(Date.now() + durationSeconds * 1000).toISOString();

      if (args.confirm !== true) {
        return jsonResult({
          ok: true,
          dryRun: true,
          sideEffects: false,
          discordWrites: false,
          wouldTimeout: {
            guildId,
            userId,
            durationSeconds,
            communication_disabled_until: until,
            reason: reason ?? null,
            clears: durationSeconds === 0,
          },
          note: "Dry-run preview only. Re-call with confirm=true to apply. Requires Moderate Members + role hierarchy. Not wake.",
        });
      }

      const token = requireBotToken();
      const member = await discordPatch<DiscordGuildMember>(
        `/guilds/${guildId}/members/${userId}`,
        token,
        { communication_disabled_until: until },
        reason,
      );

      return jsonResult({
        ok: true,
        confirm: true,
        dryRun: false,
        discordWrites: true,
        wake: false,
        action: durationSeconds === 0 ? "timeout_cleared" : "timeout_applied",
        guildId,
        userId,
        durationSeconds,
        communication_disabled_until:
          member.communication_disabled_until ?? until,
        reason: reason ?? null,
        note: "Timeout applied via Discord REST. Bot role must be above the target. Not wake/sendPrompt.",
      });
    }

    if (name === "kick_member") {
      const userId = asTrimmedString(args.userId);
      if (!userId) {
        return jsonResult({ ok: false, error: "userId is required" }, true);
      }
      const guildId = resolveGuildId(args);
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
      const reason = optionalReason(args);

      if (args.confirm !== true) {
        return jsonResult({
          ok: true,
          dryRun: true,
          sideEffects: false,
          discordWrites: false,
          wouldKick: { guildId, userId, reason: reason ?? null },
          note: "Dry-run preview only. Re-call with confirm=true to kick. Requires Kick Members + role hierarchy. Not wake.",
        });
      }

      const token = requireBotToken();
      await discordDelete(
        `/guilds/${guildId}/members/${userId}`,
        token,
        reason,
      );

      return jsonResult({
        ok: true,
        confirm: true,
        dryRun: false,
        discordWrites: true,
        wake: false,
        action: "kicked",
        guildId,
        userId,
        reason: reason ?? null,
        note: "Member kicked via Discord REST. Bot role must be above the target. Not wake/sendPrompt.",
      });
    }

    if (name === "ban_member") {
      const userId = asTrimmedString(args.userId);
      if (!userId) {
        return jsonResult({ ok: false, error: "userId is required" }, true);
      }
      const guildId = resolveGuildId(args);
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
      let deleteMessageSeconds: number | undefined;
      if (
        typeof args.deleteMessageSeconds === "number" &&
        Number.isFinite(args.deleteMessageSeconds)
      ) {
        deleteMessageSeconds = Math.floor(args.deleteMessageSeconds);
        if (
          deleteMessageSeconds < 0 ||
          deleteMessageSeconds > DELETE_MESSAGE_SECONDS_MAX
        ) {
          return jsonResult(
            {
              ok: false,
              error: `deleteMessageSeconds must be 0–${DELETE_MESSAGE_SECONDS_MAX}. No Discord call made.`,
            },
            true,
          );
        }
      }
      const reason = optionalReason(args);
      const body: Record<string, unknown> = {};
      if (deleteMessageSeconds !== undefined) {
        body.delete_message_seconds = deleteMessageSeconds;
      }

      if (args.confirm !== true) {
        return jsonResult({
          ok: true,
          dryRun: true,
          sideEffects: false,
          discordWrites: false,
          wouldBan: {
            guildId,
            userId,
            deleteMessageSeconds: deleteMessageSeconds ?? null,
            reason: reason ?? null,
          },
          note: "Dry-run preview only. Re-call with confirm=true to ban. Requires Ban Members + role hierarchy. Not wake.",
        });
      }

      const token = requireBotToken();
      await discordPut(
        `/guilds/${guildId}/bans/${userId}`,
        token,
        body,
        reason,
      );

      return jsonResult({
        ok: true,
        confirm: true,
        dryRun: false,
        discordWrites: true,
        wake: false,
        action: "banned",
        guildId,
        userId,
        deleteMessageSeconds: deleteMessageSeconds ?? null,
        reason: reason ?? null,
        note: "Member banned via Discord REST. Bot role must be above the target. Not wake/sendPrompt.",
      });
    }

    if (name === "unban_member") {
      const userId = asTrimmedString(args.userId);
      if (!userId) {
        return jsonResult({ ok: false, error: "userId is required" }, true);
      }
      const guildId = resolveGuildId(args);
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
      const reason = optionalReason(args);

      if (args.confirm !== true) {
        return jsonResult({
          ok: true,
          dryRun: true,
          sideEffects: false,
          discordWrites: false,
          wouldUnban: { guildId, userId, reason: reason ?? null },
          note: "Dry-run preview only. Re-call with confirm=true to unban. Requires Ban Members. Not wake.",
        });
      }

      const token = requireBotToken();
      await discordDelete(`/guilds/${guildId}/bans/${userId}`, token, reason);

      return jsonResult({
        ok: true,
        confirm: true,
        dryRun: false,
        discordWrites: true,
        wake: false,
        action: "unbanned",
        guildId,
        userId,
        reason: reason ?? null,
        note: "Member unbanned via Discord REST. Not wake/sendPrompt.",
      });
    }

    if (name === "delete_message") {
      const channelId = asTrimmedString(args.channelId);
      const messageId = asTrimmedString(args.messageId);
      if (!channelId) {
        return jsonResult({ ok: false, error: "channelId is required" }, true);
      }
      if (!messageId) {
        return jsonResult({ ok: false, error: "messageId is required" }, true);
      }
      const reason = optionalReason(args);

      if (args.confirm !== true) {
        return jsonResult({
          ok: true,
          dryRun: true,
          sideEffects: false,
          discordWrites: false,
          wouldDelete: { channelId, messageId, reason: reason ?? null },
          note: "Dry-run preview only. Re-call with confirm=true to delete. Managing others' messages needs Manage Messages. Not wake.",
        });
      }

      const token = requireBotToken();
      await discordDelete(
        `/channels/${channelId}/messages/${messageId}`,
        token,
        reason,
      );

      return jsonResult({
        ok: true,
        confirm: true,
        dryRun: false,
        discordWrites: true,
        wake: false,
        action: "message_deleted",
        channelId,
        messageId,
        reason: reason ?? null,
        note: "Message deleted via Discord REST. Not wake/sendPrompt.",
      });
    }

    if (name === "purge_channel_messages") {
      const channelId = asTrimmedString(args.channelId);
      if (!channelId) {
        return jsonResult({ ok: false, error: "channelId is required" }, true);
      }

      const rawIds = Array.isArray(args.messageIds)
        ? args.messageIds
            .filter((x): x is string => typeof x === "string")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      let limit: number | null = null;
      if (typeof args.limit === "number" && Number.isFinite(args.limit)) {
        limit = Math.floor(args.limit);
        if (limit < 1) limit = 1;
        if (limit > PURGE_LIMIT_MAX) limit = PURGE_LIMIT_MAX;
      }

      if (rawIds.length === 0 && limit == null) {
        return jsonResult(
          {
            ok: false,
            error:
              "Provide messageIds and/or limit (1–100). No Discord call made.",
          },
          true,
        );
      }

      const reason = optionalReason(args);
      const token = requireBotToken();

      // Resolve candidate ids (may need a read even for dry-run when using limit)
      let ids = [...new Set(rawIds)];
      let fetchedFromLimit = 0;
      if (limit != null) {
        const fetched = await discordGet<DiscordMessage[]>(
          `/channels/${channelId}/messages?limit=${limit}`,
          token,
        );
        fetchedFromLimit = fetched.length;
        for (const m of fetched) {
          if (m.id) ids.push(m.id);
        }
        ids = [...new Set(ids)];
      }

      if (ids.length > PURGE_LIMIT_MAX) {
        ids = ids.slice(0, PURGE_LIMIT_MAX);
      }

      const eligible = ids.filter((id) => isBulkDeleteEligible(id));
      const tooOld = ids.filter((id) => !isBulkDeleteEligible(id));

      let bulkPlan: string[] = [];
      let singlePlan: string[] = [];
      if (eligible.length >= 2) {
        // Discord bulk-delete: 2–100 messages
        bulkPlan = eligible.slice(0, PURGE_LIMIT_MAX);
        const leftoverEligible = eligible.slice(bulkPlan.length);
        singlePlan = [...leftoverEligible, ...tooOld];
      } else {
        // 0 or 1 eligible → no bulk; single-delete all
        singlePlan = ids;
      }

      const plan = {
        channelId,
        totalCandidates: ids.length,
        fetchedFromLimit,
        bulkDeleteIds: bulkPlan,
        singleDeleteIds: singlePlan,
        skippedTooOldForBulk: tooOld,
        limitations: [
          "Discord bulk-delete requires 2–100 message ids, each younger than 14 days.",
          "Messages ≥14 days old cannot use bulk-delete; this tool falls back to single DELETE (still needs Manage Messages for others' messages).",
          `Cap ${PURGE_LIMIT_MAX} messages per call.`,
        ],
        reason: reason ?? null,
      };

      if (args.confirm !== true) {
        return jsonResult({
          ok: true,
          dryRun: true,
          sideEffects: false,
          discordWrites: false,
          wouldPurge: plan,
          note: "Dry-run plan only (history may have been read when limit was set). Re-call with confirm=true to delete. Not wake.",
        });
      }

      const bulkDeleted: string[] = [];
      const singleDeleted: string[] = [];
      const errors: Array<{ id?: string; phase: string; error: string }> = [];

      if (bulkPlan.length >= 2) {
        try {
          await discordPost(
            `/channels/${channelId}/messages/bulk-delete`,
            token,
            { messages: bulkPlan },
            reason,
          );
          bulkDeleted.push(...bulkPlan);
        } catch (err) {
          const msg =
            err instanceof DiscordApiError
              ? `${err.message} body=${err.body}`
              : err instanceof Error
                ? err.message
                : String(err);
          errors.push({ phase: "bulk-delete", error: msg });
          // Fall back to single deletes for the bulk set
          singlePlan = [...bulkPlan, ...singlePlan];
        }
      }

      for (const id of singlePlan) {
        try {
          await discordDelete(
            `/channels/${channelId}/messages/${id}`,
            token,
            reason,
          );
          singleDeleted.push(id);
        } catch (err) {
          const msg =
            err instanceof DiscordApiError
              ? `${err.message} body=${err.body}`
              : err instanceof Error
                ? err.message
                : String(err);
          errors.push({ id, phase: "single-delete", error: msg });
        }
      }

      return jsonResult({
        ok: errors.length === 0,
        confirm: true,
        dryRun: false,
        discordWrites: true,
        wake: false,
        action: "purged",
        channelId,
        bulkDeletedCount: bulkDeleted.length,
        singleDeletedCount: singleDeleted.length,
        bulkDeleted,
        singleDeleted,
        skippedTooOldForBulk: tooOld,
        errors,
        limitations: plan.limitations,
        note: "Purge via Discord REST (bulk when eligible). Not wake/sendPrompt.",
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
