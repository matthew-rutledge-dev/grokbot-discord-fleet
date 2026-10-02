---
name: discord-fleet-boundary
description: use this when any Discord fleet work comes up — status, manage, wake questions, or channel binding
---

# Discord fleet boundary

## When to use

Any Discord fleet task: health, channel maps, bindings, wake questions, or "which repo owns this?"

## Hard boundary

- **This plugin** = manage + status MCP (Discord REST reads + optional bridge `/healthz`) and skills only.
- **First-time / local clone:** after copying the plugin tree, run `./scripts/bootstrap-mcp.sh` or `.\scripts\bootstrap-mcp.ps1` (or `npm ci` in `mcp/status` and `mcp/manage`) before expecting status/manage MCP to load. No silent postinstall.
- **Wake path** = separate, **optional**, and **self-hosted by the operator**: `matthew-rutledge-dev/grok-bot-discord-bridge` on **their** machine. Gateway → `sendPrompt` / webhook via that bridge — not this plugin. Marketplace installers use their own Discord and infrastructure.
- **Credentials are per-installer.** Set plugin variables `DISCORD_BOT_TOKEN` (required for Discord REST), optional `DISCORD_GUILD_ID`, optional `DISCORD_BRIDGE_HEALTH_URL`, optional `DISCORD_BRIDGE_CALLBACK_TOKEN` / `DISCORD_BRIDGE_CALLBACK_URL` (for wake self-callback / dual-deliver without a host vault hop — see skill `discord-fleet-callback-setup`). Prefer vault → runtime env over plaintext `.env` on disk when avoidable. Never put secrets in git or in this plugin tree.
- **Not a shared provider.** Each installation supplies its own host vault, plugin variables, credentials, and deploy path; these are never marketplace defaults.
- Never merge this plugin into a shared general catalog without an explicit maintainer decision.
- Never deploy to a host or path you do not own from this plugin; use the explicit bridge-setup flow for your own deployment.
- **DMs:** optional bridge `security.dm.*` + same `/callback` with DM `channelId`. This plugin has **no** `send_dm` MCP. Guild channel-map does not route DMs; set `defaultAgentId` on the bridge or they deny `dm_no_agent`.
- **Media:** optional bridge inbound thin-JSON `a:` (CDN URL refs — fetch promptly) and outbound `/callback` `attachments` or multipart files. This plugin does not own wake or call `/callback`; document for installers' own bridge only. Never put hop codes in Discord replies.

## What to do

1. Status/health → skill `discord-fleet-status` + status MCP (uses **their** plugin vars).
2. Binding / manage planning → skill `discord-fleet-manage` + manage MCP (dry-run / `confirm=true` reads).
3. Actually waking a bot or editing live map/security → stop here; point at **their** optional self-hosted bridge (skill `discord-fleet-bridge-setup` on explicit ask). Do not invent wake calls from this plugin.
4. Wake replies / self-callback without host vault → skill `discord-fleet-callback-setup` (file `DISCORD_BRIDGE_CALLBACK_TOKEN` + `DISCORD_BRIDGE_CALLBACK_URL`; per-bot Secrets for multi-agent fleets).
5. Discord wake inbound / callback hop context → skill `discord-fleet-hop-shorthand` (inbound shape `d:<slug>:<msgId>` — DMs default slug `dm`, `g` may be `null`; thin JSON `{id,g,u,map,a?}`, then human content; never put codes in Discord channel/DM replies; same `/callback` with optional attachments).
