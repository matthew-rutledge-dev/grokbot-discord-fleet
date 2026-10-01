---
name: discord-fleet-boundary
description: use this when any Discord fleet work comes up — status, manage, wake questions, or channel binding
---

# Discord fleet boundary

## When to use

Any Discord fleet task: health, channel maps, bindings, wake questions, or "which repo owns this?"

## Hard boundary

- **This plugin** = manage + status MCP (Discord REST reads + optional bridge `/healthz`) and skills only.
- **Wake path** = separate, **optional**, and **self-hosted by the operator**: `matthew-rutledge-dev/grok-bot-discord-bridge` on **their** machine. Gateway → `sendPrompt` / webhook via that bridge — not this plugin. Marketplace installers are **not** joining Matthew's Discord or infra.
- **Credentials are per-installer.** Set plugin variables `DISCORD_BOT_TOKEN` (required for Discord REST), optional `DISCORD_GUILD_ID`, optional `DISCORD_BRIDGE_HEALTH_URL`. Prefer vault → runtime env over plaintext `.env` on disk when avoidable. Never put secrets in git or in this plugin tree.
- **Not a shared provider.** Matthew's host vault key `DISCORD_FLEET_WAKE` and servergen1 path `/opt/sites/discord-fleet-wake` (Diablo owns) are **Matthew operator-only** — do not treat them as the marketplace default or point other users at them.
- Never merge this plugin into the general/Betty catalog.
- Never deploy to `/opt/sites/discord-fleet-wake` from this plugin for marketplace users (Matthew-operator work only, and only on explicit ask via bridge-setup).
- **DMs:** optional bridge `security.dm.*` + same `/callback` with DM `channelId`. This plugin has **no** `send_dm` MCP. Guild channel-map does not route DMs; set `defaultAgentId` on the bridge or they deny `dm_no_agent`.

## What to do

1. Status/health → skill `discord-fleet-status` + status MCP (uses **their** plugin vars).
2. Binding / manage planning → skill `discord-fleet-manage` + manage MCP (dry-run / `confirm=true` reads).
3. Actually waking a bot or editing live map/security → stop here; point at **their** optional self-hosted bridge (skill `discord-fleet-bridge-setup` on explicit ask). Do not invent wake calls from this plugin.
4. Discord wake inbound / callback hop context → skill `discord-fleet-hop-shorthand` (inbound shape `d:<slug>:<msgId>` — DMs default slug `dm`, `g` may be `null`; thin JSON `{id,g,u,map}`, then human content; never put codes in Discord channel/DM replies; same `/callback`).
