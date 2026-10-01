---
name: discord-fleet-status
description: use this when checking Discord fleet health, status, or the stub channel map
---

# Discord fleet status

## When to use

Health/status checks for Matthew's Grok Bot Discord fleet. Read-only stubs until wired to the bridge status endpoint.

## How

1. Confirm boundary (see `discord-fleet-boundary`) — this is status, not wake.
2. Call MCP server `discord-fleet-status`:
   - `fleet_health` — expect stub JSON with `ok: true` and bridge/wake hints (not live Discord).
   - `list_channel_map_stub` — expect `{ channels: [], note: ... }`; live map stays on the bridge host.
3. Treat tool output as evidence. If stubs only, say so — do not pretend live Discord data.

## Evidence expected

- Tool result JSON from `fleet_health` and/or `list_channel_map_stub`
- Note that real status will come from the bridge later; this plugin does not hold secrets
