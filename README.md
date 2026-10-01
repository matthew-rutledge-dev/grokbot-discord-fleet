# Grok Bot Discord Fleet

Plugin home for **Discord fleet manage/status** MCP servers + skills. Aligned for **Grok Build** (xAI plugin marketplace conventions) with optional Cursor dual-support.

**This is NOT the wake path.** Runtime wake (Zion Gateway → `sendPrompt` / webhook) lives in a separate repo:

- Bridge: [matthew-rutledge-dev/grok-bot-discord-bridge](https://github.com/matthew-rutledge-dev/grok-bot-discord-bridge)
- Host hint (servergen1, Diablo owns): `/opt/sites/discord-fleet-wake`

Do not merge this plugin into the general/Betty catalog. Do not put secrets in git. Do not deploy to the wake path from this plugin.

## What this plugin is

| Piece | Role |
|-------|------|
| `discord-fleet-status` MCP | Bridge `GET /healthz` probe + Discord REST identity/guild/channel reads |
| `discord-fleet-manage` MCP | Boundary docs, dry-run channel-map plans, gated read helpers (`confirm=true`) |
| Skills | Boundary, status, manage planning, operator-driven bridge setup |

## Layout (Grok-canonical)

| Path | Purpose |
|------|---------|
| `.grok-plugin/plugin.json` | **Primary** Grok Build / marketplace manifest |
| `.mcp.json` | MCP servers for Grok (catalog default name) |
| `skills/` | Skill folders with `SKILL.md` |
| `mcp/status`, `mcp/manage` | Local stdio MCP TypeScript sources |
| `.cursor-plugin/plugin.json` + `mcp.json` | Optional Cursor dual-support |

Marketplace index tooling (`xai-org/plugin-marketplace`) discovers `.grok-plugin/plugin.json` and defaults MCP scan to `.mcp.json`.

## Install — Grok Build

### After marketplace listing (later)

Once listed in [xai-org/plugin-marketplace](https://github.com/xai-org/plugin-marketplace):

```bash
grok plugin marketplace list
grok plugin install grokbot-discord-fleet --trust
```

Marketplace remote entries must pin a full 40-character commit SHA (this repo's `main` tip after alignment).

### From this repo now (before marketplace PR)

Grok loads plugins from `./.grok/plugins/`, `~/.grok/plugins/`, config `[plugins] paths`, or `--plugin-dir`:

```bash
# Clone / copy into user plugins
mkdir -p ~/.grok/plugins
git clone https://github.com/matthew-rutledge-dev/grokbot-discord-fleet.git ~/.grok/plugins/grokbot-discord-fleet
# or: grok --plugin-dir /path/to/grokbot-discord-fleet …
```

If your Grok Build build supports installing a local/git path via `grok plugin install`, prefer that over hand-copy; otherwise use the directory layout above. Set env vars (below) before starting Grok.

### Cursor (optional dual-support)

```bash
mkdir -p ~/.cursor/plugins/local
cp -a /path/to/grokbot-discord-fleet ~/.cursor/plugins/local/grokbot-discord-fleet
# or: ln -s /path/to/grokbot-discord-fleet ~/.cursor/plugins/local/grokbot-discord-fleet
```

Cursor uses `.cursor-plugin/plugin.json` and `mcp.json` (`${CURSOR_PLUGIN_ROOT}`).

## Environment / plugin variables

| Name | Required | Purpose |
|------|----------|---------|
| `DISCORD_BOT_TOKEN` | For Discord REST tools | Bot token. **Never commit.** Host vault key: `DISCORD_FLEET_WAKE` |
| `DISCORD_GUILD_ID` | Optional | Default guild snowflake (`<guild-id>` placeholder until set) |
| `DISCORD_BRIDGE_HEALTH_URL` | Optional | Full URL to bridge `GET /healthz` (e.g. `http://127.0.0.1:18083/healthz` via SSH tunnel) |

Bridge HTTP on the host is loopback-only (`127.0.0.1:18083`). From a laptop, tunnel first, then point `DISCORD_BRIDGE_HEALTH_URL` at the tunneled URL.

## Network endpoints (declare for operators / marketplace)

| Endpoint | When | Purpose |
|----------|------|---------|
| `https://discord.com/api/v10/*` (Discord REST) | When `DISCORD_BOT_TOKEN` is set | Identity, guilds, channels (read-only from this plugin) |
| Bridge `GET /healthz` at `DISCORD_BRIDGE_HEALTH_URL` | Optional | Liveness / `discordReady` probe — **not** wake / `sendPrompt` |

No Discord message sends, no channel-map writes, no gateway listen from this plugin.

## Plugin root path variables (honest)

| Host | MCP file | Plugin root placeholder |
|------|----------|-------------------------|
| **Grok Build** | `.mcp.json` | `${GROK_PLUGIN_ROOT}` — documented for plugin hooks as `GROK_PLUGIN_ROOT` / `GROK_PLUGIN_DATA`; used here for portable stdio `args`/`cwd` |
| **Cursor** | `mcp.json` | `${CURSOR_PLUGIN_ROOT}` — Cursor expands this for local plugins |
| Claude Code (compat) | (not dual-shipped here) | Would use `${CLAUDE_PLUGIN_ROOT}` in a `.claude-plugin` + `.mcp.json` layout |

Do **not** assume `${CURSOR_PLUGIN_ROOT}` works under Grok, or `${GROK_PLUGIN_ROOT}` under Cursor. Keep both MCP files if you need both hosts.

## MCP servers

### Status tools (`discord-fleet-status`)

- `fleet_health` — probe bridge `/healthz` when `DISCORD_BRIDGE_HEALTH_URL` is set; Discord REST `GET /users/@me` + guilds when token is set
- `list_channel_map` — documented bridge channel-map schema + Discord guild channels when token + guild id are available

### Manage tools (`discord-fleet-manage`)

- `describe_manage_boundary` — this plugin does **not** wake bots / call `sendPrompt`
- `plan_channel_binding` — dry-run draft row for bridge `channel-map.json` (no writes)
- `inspect_guild` — Discord REST guild/roles/channels snapshot; requires `confirm=true`
- `resolve_channel` — Discord REST `GET /channels/{id}`; requires `confirm=true`

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
- `discord-fleet-bridge-setup` — **operator-driven** wake-bridge setup on an explicit ask (clone/deploy/verify `/healthz`; never silent postinstall; never `curl|bash`; vault `DISCORD_FLEET_WAKE`)

## Marketplace PR (later — not in this change)

To list in `xai-org/plugin-marketplace`, open a PR that appends a **remote** entry to `.grok-plugin/marketplace.json` pinned to a full commit SHA of this repo, then regenerate `plugin-index.json` with the marketplace scripts. Suggested sketch:

```json
{
  "name": "grokbot-discord-fleet",
  "description": "Discord fleet manage/status MCP + skills (REST reads + optional bridge /healthz). Not the wake bridge.",
  "category": "development",
  "source": {
    "source": "url",
    "url": "https://github.com/matthew-rutledge-dev/grokbot-discord-fleet.git",
    "sha": "<full-40-char-sha-after-this-align-commit>"
  },
  "homepage": "https://github.com/matthew-rutledge-dev/grokbot-discord-fleet",
  "keywords": ["discord", "grok-bot", "fleet", "mcp"],
  "domains": ["discord.com", "discordapp.com"]
}
```

## Secrets

No tokens in git. Use env / host plugin variables only. Host `.env` + vault `DISCORD_FLEET_WAKE` stay on the bridge host.

## License

MIT — Copyright (c) 2026 Matthew Rutledge
