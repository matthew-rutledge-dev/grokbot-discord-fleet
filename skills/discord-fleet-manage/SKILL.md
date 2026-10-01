---
name: discord-fleet-manage
description: use this when planning Discord channel bindings or other fleet manage ops (dry-run until wired)
---

# Discord fleet manage

## When to use

Planning channel bindings or other manage ops. Dry-run only until Matthew wires real Discord manage APIs.

## How

1. Confirm boundary (`discord-fleet-boundary`) — manage/status here; wake config only on the bridge.
2. Call MCP server `discord-fleet-manage`:
   - `describe_manage_boundary` — refresh: this plugin does not wake bots.
   - `plan_channel_binding` — optional `agentAlias`, `channelId`; returns a dry-run plan object. No Discord API calls, no side effects.
3. For runtime wake / live bot config, point sibling work at `grok-bot-discord-bridge` only — do not put wake secrets in this plugin.

## Evidence expected

- Dry-run plan JSON from `plan_channel_binding`
- Explicit "no side effects" / stub language until real APIs exist
