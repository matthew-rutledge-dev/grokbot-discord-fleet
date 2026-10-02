---
name: discord-fleet-status
description: use this when checking Discord fleet health, bridge /healthz, Discord bot identity, guilds, or channel lists
---

# Discord fleet status

## When to use

Health/status checks for the Discord fleet wired by this plugin's variables. Read-only: optional bridge HTTP and/or Discord REST against **the installer's** bot/guild.

## How

1. Confirm boundary (see `discord-fleet-boundary`) — this is status, not wake. Credentials come from plugin variables (their token), not a shared provider.
2. If MCP servers fail to start with missing `@modelcontextprotocol/sdk` / `tsx`, the install skipped deps — run `./scripts/bootstrap-mcp.sh` from the plugin root, then retry.
3. Call MCP server `discord-fleet-status`:
   - `fleet_health` — bridge `GET /healthz` when `DISCORD_BRIDGE_HEALTH_URL` is set; Discord `/users/@me` + guilds when `DISCORD_BOT_TOKEN` is set. Report which sources were available.
   - `list_channel_map` — schema from bridge docs + Discord channels for `guildId` / `DISCORD_GUILD_ID` when token present. Live enabled rows still live on the bridge host the operator runs.
4. Treat tool output as evidence. If token or bridge URL is missing, say so — do not invent live Discord data. Point them at Plugins → Configure / plugin variables if unset.

## Evidence expected

- Tool result JSON from `fleet_health` and/or `list_channel_map`
- Explicit note when Discord REST or bridge probe was skipped (missing env / plugin vars)
