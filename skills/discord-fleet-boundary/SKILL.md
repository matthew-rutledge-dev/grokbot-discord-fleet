---
name: discord-fleet-boundary
description: use this when any Discord fleet work comes up — status, manage, wake questions, or channel binding
---

# Discord fleet boundary

## When to use

Any Discord fleet task: health, channel maps, bindings, wake questions, or "which repo owns this?"

## Hard boundary

- **This plugin** = one `discord-fleet` MCP server with manage + status tools (Discord REST — reads with no confirm, plus `confirm=true`-gated post / moderation — + optional bridge `/healthz`; read-only mode (`DISCORD_FLEET_READ_ONLY` on: `1`/`true`/`yes`/`on`, or any unrecognised non-empty value) hides the write tools, reads stay available) and skills only.
- **First-time / local clone:** after copying the plugin tree, run `./scripts/bootstrap-mcp.sh` or `.\scripts\bootstrap-mcp.ps1` (or `npm ci && npm run build` in `mcp/discord-fleet`) before expecting the `discord-fleet` MCP server to load. No silent postinstall.
- **Wake path** = separate, **optional**, and **self-hosted by the operator**: a compatible host bridge on **their** machine (for example the Discord adapter of [grok-bot-universal-bridge](https://github.com/matthew-rutledge-dev/grok-bot-universal-bridge), the reference host bridge). Discord → host bridge → Gateway `sendPrompt` / webhook routine — not this plugin. Marketplace installers use their own Discord and infrastructure.
- **Credentials are per-installer.** Set plugin variables `DISCORD_BOT_TOKEN` (required for Discord REST), optional `DISCORD_GUILD_ID`, optional `DISCORD_BRIDGE_HEALTH_URL`, optional `DISCORD_BRIDGE_CALLBACK_TOKEN` / `DISCORD_BRIDGE_CALLBACK_URL` (for wake self-callback / dual-deliver without a host vault hop — see skill `discord-fleet-callback-setup`). Prefer vault → runtime env over plaintext `.env` on disk when avoidable. Never put secrets in git or in this plugin tree. Full bot-create / invite / intent / **permission** steps: plugin README **Discord bot token & invite** and **Discord bot permissions**.
- **Not a shared provider.** Each installation supplies its own host vault, plugin variables, credentials, and deploy path; these are never marketplace defaults.
- Never merge this plugin into a shared general catalog without an explicit maintainer decision.
- Never deploy to a host or path you do not own from this plugin; use the explicit bridge-setup flow for your own deployment.
- **Two enable layers, not one flag.** Global `botsEnabled` (default ON; a missing flag means on) is independent of per-site `sites[].enabled` / channel-map `channels[].enabled`. A bridge bot runs for a site only when global is on AND that site is on. Toggling a site does not change the global flag, and changing the global flag does not rewrite site flags. Evaluate with the `discord-fleet` tool `evaluate_bridge_bot_enable` (`bridgeBotRunsForSite`). This plugin does not start or stop bridge processes.
- **DMs:** optional bridge DM route (`match: {dm: "true"}`, `allowActors`, `agent`) + same `/discord/callback`; DM replies send `channelId` = the wake trailer's `c`. This plugin has **no** `send_dm` MCP. Guild routes do not route DMs.
- **Media:** optional bridge inbound `a=` trailer keys (CDN URL refs — fetch promptly) and outbound `/discord/callback` JSON `attachments`. This plugin does not own wake or call the callback; document for installers' own bridge only. Never put hop codes in Discord replies.

## What to do

1. Status/health → skill `discord-fleet-status` + `discord-fleet` status tools (uses **their** plugin vars).
2. Binding / manage / moderation → skill `discord-fleet-manage` + `discord-fleet` manage tools (dry-run plans; Discord REST reads with no confirm: inspect, history, bot perms; `confirm=true` writes: post, timeout/kick/ban/unban, delete/purge). Still no wake. Ensure README **Discord bot permissions** are granted (role hierarchy for member actions).
3. Actually waking a bot or editing live map/security → stop here; point at **their** optional self-hosted bridge (skill `discord-fleet-bridge-setup` on explicit ask). Do not invent wake calls from this plugin.
4. Wake replies / self-callback without host vault → skill `discord-fleet-callback-setup` (file `DISCORD_BRIDGE_CALLBACK_TOKEN` + `DISCORD_BRIDGE_CALLBACK_URL`; per-bot Secrets for multi-agent fleets).
5. Discord wake inbound → skill `discord-bridge-dual-deliver` only (a wake loads no other hop skill; compact trailer `⟂ d:<slug>:<msgId> u=… c=…`, or legacy `d:` line + thin JSON from older host bridges; never put codes in Discord channel/DM replies; same `/discord/callback` with optional attachments).
