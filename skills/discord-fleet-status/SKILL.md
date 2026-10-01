---
name: discord-fleet-status
description: use this when checking Discord fleet health, bridge /healthz, Discord bot identity, guilds, or channel lists
---

# Discord fleet status

## When to use

Health/status checks for Matthew's Grok Bot Discord fleet. Read-only: bridge HTTP and/or Discord REST.

## How

1. Confirm boundary (see `discord-fleet-boundary`) — this is status, not wake.
2. Call MCP server `discord-fleet-status`:
   - `fleet_health` — bridge `GET /healthz` when `DISCORD_BRIDGE_HEALTH_URL` is set; Discord `/users/@me` + guilds when `DISCORD_BOT_TOKEN` is set. Report which sources were available.
   - `list_channel_map` — schema from bridge docs + Discord channels for `guildId` / `DISCORD_GUILD_ID` when token present. Live enabled rows still live on the bridge host.
3. Treat tool output as evidence. If token or bridge URL is missing, say so — do not invent live Discord data.

## Evidence expected

- Tool result JSON from `fleet_health` and/or `list_channel_map`
- Explicit note when Discord REST or bridge probe was skipped (missing env)
