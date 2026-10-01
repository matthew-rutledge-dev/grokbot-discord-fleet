---
name: discord-fleet-manage
description: use this when planning Discord channel bindings or inspecting guild/channel metadata for the fleet (dry-run / confirm-gated reads)
---

# Discord fleet manage

## When to use

Planning channel bindings or inspecting Discord guild/channel metadata. No wake. No Discord writes from this plugin.

## How

1. Confirm boundary (`discord-fleet-boundary`) — manage/status here; wake config only on the bridge.
2. Call MCP server `discord-fleet-manage`:
   - `describe_manage_boundary` — refresh: this plugin does not wake bots / call sendPrompt.
   - `plan_channel_binding` — optional `agentAlias` / `agentId` / `channelId` / `label` / `requireMention`; returns a dry-run draft map row. No Discord API calls.
   - `inspect_guild` — Discord REST snapshot; **requires `confirm=true`** and `DISCORD_BOT_TOKEN`.
   - `resolve_channel` — Discord REST channel lookup; **requires `confirm=true`** and token.
3. For runtime wake / enabling map rows, point work at `grok-bot-discord-bridge` on the wake host only — do not put wake secrets in this plugin.

## Evidence expected

- Dry-run plan JSON from `plan_channel_binding`, and/or gated inspect JSON with `confirm: true`
- Explicit "no side effects" / "discordWrites: false" language
