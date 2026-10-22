# Backlog — grokbot-discord-fleet

No secrets in this file.

## Discord-only follow-ups

- Document an SSH-tunnel recipe for `DISCORD_BRIDGE_HEALTH_URL` from a laptop.
- Optionally support reading a local copy of `channel-map.json` via an environment variable (never write from this plugin).

## Done

- Single MCP server (0.3.33): `discord-fleet` holds all status + manage tools; `DISCORD_FLEET_READ_ONLY=1` hides write/moderation tools.
- Manage MCP action slice (0.3.22): list_channel_messages, post_channel_message, check_bot_channel_permissions (confirm-gated; no wake).
- Manage MCP moderation slice (0.3.23): timeout/kick/ban/unban/delete/purge + README Discord bot permissions (confirm-gated; no wake).

- Discord media docs (0.3.10): inbound thin-JSON `a:` CDN refs + outbound `/callback` attachments (JSON/multipart); marketplace placeholders only; plugin still does not own wake.
- Plugin layout + Discord manage/status MCP (0.2.0): Discord REST + optional bridge `/healthz`; dry-run / confirm-gated manage; skills; pushed to the marketplace repository.
