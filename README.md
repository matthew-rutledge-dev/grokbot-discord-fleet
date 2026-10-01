# Grok Bot Discord Fleet (Cursor Plugin)

Cursor plugin home for **Discord fleet manage/status** MCP servers + skills.

**This is NOT the wake path.** Runtime wake (Zion Gateway → `sendPrompt` / webhook) lives in a separate repo:

- Bridge: [matthew-rutledge-dev/grok-bot-discord-bridge](https://github.com/matthew-rutledge-dev/grok-bot-discord-bridge)
- Host hint (servergen1, Diablo owns): `/opt/sites/discord-fleet-wake`

Do not merge this plugin into the general/Betty catalog. Do not put secrets in git. Do not deploy to the wake path from this plugin.

## What this plugin is

| Piece | Role |
|-------|------|
| `discord-fleet-status` MCP | Bridge `GET /healthz` probe + Discord REST identity/guild/channel reads |
| `discord-fleet-manage` MCP | Boundary docs, dry-run channel-map plans, gated read helpers (`confirm=true`) |
| Skills | Boundary, status checks, manage planning |

## Local install

Copy or symlink this tree to:

```text
~/.cursor/plugins/local/grokbot-discord-fleet/
```

Example:

```bash
mkdir -p ~/.cursor/plugins/local
cp -a /path/to/grokbot-discord-fleet ~/.cursor/plugins/local/grokbot-discord-fleet
# or: ln -s /path/to/grokbot-discord-fleet ~/.cursor/plugins/local/grokbot-discord-fleet
```

Primary manifest: `.cursor-plugin/plugin.json` (optional root `plugin.json` duplicates key fields for discovery).

After install, set plugin variables in Cursor (Plugins → Configure) or export them in the environment before starting Cursor.

## Environment / plugin variables

| Name | Required | Purpose |
|------|----------|---------|
| `DISCORD_BOT_TOKEN` | For Discord REST tools | Bot token. **Never commit.** Host vault key: `DISCORD_FLEET_WAKE` |
| `DISCORD_GUILD_ID` | Optional | Default guild snowflake for channel/guild tools |
| `DISCORD_BRIDGE_HEALTH_URL` | Optional | Full URL to bridge `GET /healthz` (e.g. `http://127.0.0.1:18083/healthz` via SSH tunnel) |

Bridge HTTP on the host is loopback-only (`127.0.0.1:18083`). From a laptop, tunnel first, then point `DISCORD_BRIDGE_HEALTH_URL` at the tunneled URL.

Local smoke (no Cursor):

```bash
cd ~/.cursor/plugins/local/grokbot-discord-fleet/mcp/status
export DISCORD_BOT_TOKEN=...   # from vault — do not paste into chat/git
export DISCORD_GUILD_ID=949100784186966066
npm ci
npx tsx -e 'import("./src/index.ts")'   # or drive via MCP client
```

## MCP servers (`mcp.json`)

Paths use `${CURSOR_PLUGIN_ROOT}` (Cursor expands this; not `${PLUGIN_ROOT}`).

- `discord-fleet-status` → `tsx ${CURSOR_PLUGIN_ROOT}/mcp/status/src/index.ts`
- `discord-fleet-manage` → `tsx ${CURSOR_PLUGIN_ROOT}/mcp/manage/src/index.ts`

### Status tools

- `fleet_health` — probe bridge `/healthz` when `DISCORD_BRIDGE_HEALTH_URL` is set; Discord REST `GET /users/@me` + guilds when token is set
- `list_channel_map` — documented bridge channel-map schema + Discord guild channels when token + guild id are available

### Manage tools

- `describe_manage_boundary` — this plugin does **not** wake bots / call `sendPrompt`
- `plan_channel_binding` — dry-run draft row for bridge `channel-map.json` (no writes)
- `inspect_guild` — Discord REST guild/roles/channels snapshot; requires `confirm=true`
- `resolve_channel` — Discord REST `GET /channels/{id}`; requires `confirm=true`

No Discord message sends, no map file writes, no gateway listen.

## Bridge HTTP (reference — SoT on host)

From bridge README / `http-server.ts` (read-only reference repo):

| Path | Method | Purpose |
|------|--------|---------|
| `/healthz` | GET | Liveness + `discordReady` / `hasTokenConfigured` |
| `/callback` | POST | Agent → Discord delivery (Bearer `CALLBACK_TOKEN`) — **not used by this plugin** |

## Skills

- `discord-fleet-boundary` — always on for fleet work; manage/status vs wake path
- `discord-fleet-status` — health/status checks via status MCP
- `discord-fleet-manage` — channel-binding plans / gated inspect (dry-run / confirm)

## Secrets

No tokens in git. Use env / Cursor plugin variables only. Host `.env` + vault `DISCORD_FLEET_WAKE` stay on the bridge host.

## License

MIT — Copyright (c) 2026 Matthew Rutledge
