---
name: discord-fleet-manage
description: use this when planning Discord channel bindings or running confirm-gated Discord REST manage actions (inspect, history, post message, bot perms)
---

# Discord fleet manage

## When to use

Planning channel bindings or running confirm-gated Discord REST manage actions. No wake. No `sendPrompt`. Bridge `channel-map.json` / `security.json` writes stay on the bridge host.

## How

1. Confirm boundary (`discord-fleet-boundary`) — manage/status here; wake config only on the bridge.
2. Call MCP server `discord-fleet-manage`:
   - `describe_manage_boundary` — refresh: this plugin does not wake bots / call sendPrompt; lists tool policy.
   - `plan_channel_binding` — optional `agentAlias` / `agentId` / `channelId` / `label` / `requireMention`; returns a dry-run draft map row. No Discord API calls.
   - `inspect_guild` — Discord REST snapshot; **requires `confirm=true`** and `DISCORD_BOT_TOKEN`.
   - `resolve_channel` — Discord REST channel lookup; **requires `confirm=true`** and token.
   - `list_channel_messages` — recent messages (limit max 50); **requires `confirm=true`**.
   - `post_channel_message` — create message; dry-run preview without `confirm=true`; **confirm=true** to send; refuses empty content; returns message id. Not bridge `/callback`.
   - `check_bot_channel_permissions` — bot View/Send/History (+ related flags) for a channel; **requires `confirm=true`**.
3. Prefer `check_bot_channel_permissions` before posting or enabling a map row.
4. For runtime wake / enabling map rows, point work at `grok-bot-discord-bridge` on the wake host only — do not put wake secrets in this plugin.

## Evidence expected

- Dry-run plan JSON from `plan_channel_binding`, and/or gated tool JSON with `confirm: true` (or `dryRun: true` for unconfirmed `post_channel_message`)
- Explicit boundary language (`wake: false` / `discordWrites` accurate / no sendPrompt)
