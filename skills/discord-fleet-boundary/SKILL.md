---
name: discord-fleet-boundary
description: use this when any Discord fleet work comes up — status, manage, wake questions, or channel binding
---

# Discord fleet boundary

## When to use

Any Discord fleet task: health, channel maps, bindings, wake questions, or "which repo owns this?"

## Hard boundary

- **This plugin** = manage + status MCP stubs and skills only.
- **Wake path** = separate: `matthew-rutledge-dev/grok-bot-discord-bridge` and host path `/opt/sites/discord-fleet-wake` on servergen1 (Diablo owns). Zion Gateway → `sendPrompt` / webhook via that bridge — not this plugin.
- Never put secrets (tokens, webhooks, `.env`) in git or in this plugin tree.
- Never merge this plugin into the general/Betty catalog.

## What to do

1. Status/health → skill `discord-fleet-status` + status MCP.
2. Binding / manage planning → skill `discord-fleet-manage` + manage MCP (dry-run).
3. Actually waking a bot → stop here; point at the bridge / wake host. Do not invent wake calls from this plugin.
