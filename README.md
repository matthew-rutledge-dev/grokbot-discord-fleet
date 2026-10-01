# Grok Bot Discord Fleet

Plugin home for **Discord fleet manage/status** MCP servers + skills. Aligned for **Grok Build** (xAI plugin marketplace conventions) with optional Cursor dual-support.

**This is NOT the wake path.** Runtime wake (Gateway → `sendPrompt` / webhook) lives in a separate repo you may optionally self-host:

- Bridge (optional, your machine): [matthew-rutledge-dev/grok-bot-discord-bridge](https://github.com/matthew-rutledge-dev/grok-bot-discord-bridge)

**Marketplace installers are not joining Matthew's Discord or infra.** You configure **your own** Discord bot token (and optional guild / self-hosted bridge URL) via plugin variables. Matthew's host vault (`DISCORD_FLEET_WAKE`) and servergen1 wake path are **operator-only** for Matthew's own fleet — not a shared provider.

Do not merge this plugin into the general/Betty catalog. Do not put secrets in git. Do not deploy to someone else's wake path from this plugin.

## What this plugin is

| Piece | Role |
|-------|------|
| `discord-fleet-status` MCP | Optional bridge `GET /healthz` probe + Discord REST identity/guild/channel reads |
| `discord-fleet-manage` MCP | Boundary docs, dry-run channel-map plans, gated read helpers (`confirm=true`) |
| Skills | Boundary, status, manage planning, operator-driven optional bridge setup, hop-shorthand encode/decode |

## Layout (Grok-canonical)

| Path | Purpose |
|------|---------|
| `.grok-plugin/plugin.json` | **Primary** Grok Build / marketplace manifest (includes `variables`) |
| `.mcp.json` | MCP servers for Grok (catalog default name); env maps `${DISCORD_*}` |
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

Then set **plugin variables** (below) to **your** Discord bot token — not anyone else's. Marketplace remote entries must pin a full 40-character commit SHA.

### From this repo now (before marketplace PR)

Grok loads plugins from `./.grok/plugins/`, `~/.grok/plugins/`, config `[plugins] paths`, or `--plugin-dir`:

```bash
# Clone / copy into user plugins
mkdir -p ~/.grok/plugins
git clone https://github.com/matthew-rutledge-dev/grokbot-discord-fleet.git ~/.grok/plugins/grokbot-discord-fleet
# or: grok --plugin-dir /path/to/grokbot-discord-fleet …
```

If your Grok Build build supports installing a local/git path via `grok plugin install`, prefer that over hand-copy; otherwise use the directory layout above. Configure plugin variables / env (below) before starting Grok.

### Cursor (optional dual-support)

```bash
mkdir -p ~/.cursor/plugins/local
cp -a /path/to/grokbot-discord-fleet ~/.cursor/plugins/local/grokbot-discord-fleet
# or: ln -s /path/to/grokbot-discord-fleet ~/.cursor/plugins/local/grokbot-discord-fleet
```

Cursor uses `.cursor-plugin/plugin.json` and `mcp.json` (`${CURSOR_PLUGIN_ROOT}`). Set variables under Plugins → Configure (or equivalent).

## Plugin variables (marketplace-friendly)

Declared in `.grok-plugin/plugin.json`, root `plugin.json`, and `.cursor-plugin/plugin.json` as a JSON Schema `variables` object. MCP configs map them into process env via `${DISCORD_BOT_TOKEN}`, `${DISCORD_GUILD_ID}`, `${DISCORD_BRIDGE_HEALTH_URL}` — **no secret values in the repo**.

| Name | Required | Who sets it | Purpose |
|------|----------|-------------|---------|
| `DISCORD_BOT_TOKEN` | **Yes** (for Discord REST tools) | **Each installer — their own bot** | Bot token from the [Discord Developer Portal](https://discord.com/developers/applications). **Never commit.** |
| `DISCORD_GUILD_ID` | Optional | Your guild snowflake | Default guild for channel/guild status tools |
| `DISCORD_BRIDGE_HEALTH_URL` | Optional | Your self-hosted bridge | Full URL to **your** bridge `GET /healthz` (e.g. `http://127.0.0.1:18083/healthz`) |

### Marketplace installers

1. Create **your own** Discord application + bot; invite it to **your** guild.
2. Set plugin variable `DISCORD_BOT_TOKEN` to that token (Plugins → Configure / host env injection — **prefer vault → runtime env** over plaintext `.env` on disk when avoidable).
3. Optionally set `DISCORD_GUILD_ID`.
4. Optionally self-host the wake bridge on **your** machine and set `DISCORD_BRIDGE_HEALTH_URL` (see skill `discord-fleet-bridge-setup`). Skip if you only need Discord REST status/manage.

You are **not** connecting to Matthew's Discord, vault, or provider. Missing token → Discord REST tools report graceful "not configured" messages.

### Matthew operator-only (not for marketplace)

Matthew's own fleet may load the same env names from host vault key `DISCORD_FLEET_WAKE` and probe a loopback bridge on servergen1 (`/opt/sites/discord-fleet-wake`, Diablo owns). That path is **not** part of the marketplace product surface.

## Network endpoints (declare for operators / marketplace)

| Endpoint | When | Purpose |
|----------|------|---------|
| `https://discord.com/api/v10/*` (Discord REST) | When `DISCORD_BOT_TOKEN` is set | Identity, guilds, channels (read-only from this plugin) |
| Bridge `GET /healthz` at `DISCORD_BRIDGE_HEALTH_URL` | Optional (your bridge) | Liveness / `discordReady` probe — **not** wake / `sendPrompt` |

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

## Bridge HTTP (reference — optional self-host)

From bridge README / `http-server.ts` (read-only reference repo):

| Path | Method | Purpose |
|------|--------|---------|
| `/healthz` | GET | Liveness + `discordReady` / `hasTokenConfigured` |
| `/callback` | POST | Agent → Discord delivery (Bearer `CALLBACK_TOKEN`) — **not used by this plugin** |

Typical self-host listens loopback-only (`127.0.0.1:18083`). Point `DISCORD_BRIDGE_HEALTH_URL` at that URL (or a local SSH tunnel end).

### Optional durable Cloudflare tunnel

Quick `trycloudflare.com` tunnels are temporary and stop when their `cloudflared` process stops. For durable self-hosted wake, use a named Cloudflare Tunnel with a supervised connector and your own public hostnames, for example:

```text
CALLBACK_BASE_URL=https://callback.example.com
GROK_BOT_SENDPROMPT_URL=https://sendprompt.example.com
```

Keep the bridge loopback-only behind the tunnel, rotate `CALLBACK_TOKEN`, and keep secrets in the host vault/runtime environment. The tunnel and wake gateway are optional and are not provided by this plugin. For `/healthz`, keep using the existing loopback binding and SSH tunnel workflow rather than exposing the bridge port.
## Skills

- `discord-fleet-boundary` — always on for fleet work; manage/status vs wake path; **per-installer credentials, not shared provider**
- `discord-fleet-status` — health/status checks via status MCP
- `discord-fleet-manage` — channel-binding plans / gated inspect (dry-run / confirm)
- `discord-fleet-bridge-setup` — **operator-driven** optional wake-bridge setup on an explicit ask (clone/deploy/verify `/healthz` on **your** host; never silent postinstall; never `curl|bash`; prefer plugin vars / vault→runtime env over plaintext `.env`). Skill includes short **Windows vs Linux** notes.
- `discord-fleet-hop-shorthand` — decode/encode short wake hop ids (`d:<slug>:<message.id>` + thin JSON); Discord OUT is plain `body.content` only — never put codes in channel replies

## Marketplace PR (later — not in this change)

To list in `xai-org/plugin-marketplace`, open a PR that appends a **remote** entry to `.grok-plugin/marketplace.json` pinned to a full commit SHA of this repo, then regenerate `plugin-index.json` with the marketplace scripts. Suggested sketch:

```json
{
  "name": "grokbot-discord-fleet",
  "description": "Discord fleet manage/status MCP + skills (REST reads + optional self-hosted bridge /healthz). Installer brings own bot token. Not the wake bridge.",
  "category": "development",
  "source": {
    "source": "url",
    "url": "https://github.com/matthew-rutledge-dev/grokbot-discord-fleet.git",
    "sha": "<full-40-char-sha-after-this-commit>"
  },
  "homepage": "https://github.com/matthew-rutledge-dev/grokbot-discord-fleet",
  "keywords": ["discord", "grok-bot", "fleet", "mcp"],
  "domains": ["discord.com", "discordapp.com"]
}
```

## Secrets

No tokens in git. Marketplace users set **plugin variables** (or host env injection from their vault). Prefer vault → runtime env over leaving plaintext `.env` on disk when avoidable. Matthew operator vault key `DISCORD_FLEET_WAKE` is **not** used by marketplace installers.

## License

MIT — Copyright (c) 2026 Matthew Rutledge
