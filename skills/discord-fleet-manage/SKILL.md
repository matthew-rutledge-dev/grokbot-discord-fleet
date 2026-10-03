---
name: discord-fleet-manage
description: use this when planning Discord channel bindings or running confirm-gated Discord REST manage actions (inspect, history, post, permissions, moderation)
---

# Discord fleet manage

## When to use

Planning channel bindings or running confirm-gated Discord REST manage actions (including moderation). No wake. No `sendPrompt`. Bridge `channel-map.json` / `security.json` writes stay on the bridge host.

## How

1. Confirm boundary (`discord-fleet-boundary`) — manage/status here; wake config only on the bridge.
2. Confirm Discord bot permissions (README **Discord bot permissions** / **Discord bot token & invite**) — messaging bits for inspect/history/post; **Moderate Members** / **Kick** / **Ban** / **Manage Messages** + role hierarchy for moderation tools.
3. Call MCP server `discord-fleet-manage`:
   - `describe_manage_boundary` — refresh: this plugin does not wake bots / call sendPrompt; lists tool policy.
   - `plan_channel_binding` — optional `agentAlias` / `agentId` / `channelId` / `label` / `requireMention`; returns a dry-run draft map row. No Discord API calls.
   - `inspect_guild` — Discord REST snapshot; **requires `confirm=true`** and `DISCORD_BOT_TOKEN`.
   - `resolve_channel` — Discord REST channel lookup; **requires `confirm=true`** and token.
   - `list_channel_messages` — recent messages (limit max 50); **requires `confirm=true`**.
   - `post_channel_message` — create message; dry-run preview without `confirm=true`; **confirm=true** to send; refuses empty content; returns message id. Not bridge `/callback`.
   - `check_bot_channel_permissions` — bot View/Send/History/Manage Messages (+ Kick/Ban/Moderate from guild roles); **requires `confirm=true`**.
   - `timeout_member` — `guildId`, `userId`, `durationSeconds` (0 clears), optional `reason`; dry-run without confirm; **confirm=true** to apply.
   - `kick_member` / `ban_member` / `unban_member` — `guildId`, `userId`, optional `reason` (`ban_member` also `deleteMessageSeconds`); dry-run without confirm.
   - `delete_message` — `channelId`, `messageId`; dry-run without confirm.
   - `purge_channel_messages` — `channelId` + `limit` and/or `messageIds` (cap 100); bulk-delete when Discord allows; dry-run without confirm.
   - `evaluate_bridge_bot_enable` — `siteId`, optional `botsEnabled` (omit = on), optional `sites` (`siteId` + `enabled`). Runs only when global is on AND that site is on. Does not write either store. No Discord call.
4. Prefer `check_bot_channel_permissions` before posting, purging, or enabling a map row.
5. For runtime wake / enabling map rows, point work at `grok-bot-discord-bridge` on the wake host only — do not put wake secrets in this plugin.

## Evidence expected

- Dry-run plan JSON from `plan_channel_binding`, and/or gated tool JSON with `confirm: true` (or `dryRun: true` for unconfirmed writes)
- Explicit boundary language (`wake: false` / `discordWrites` accurate / no sendPrompt)
