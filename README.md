# Grok Bot Discord Fleet

Plugin home for **Discord fleet manage/status** MCP servers + skills. Aligned for **Grok Build** (xAI plugin marketplace conventions) with optional Cursor dual-support.

**This is NOT the wake path.** Runtime wake (Gateway → `sendPrompt` / webhook) lives in a separate repo you may optionally self-host:

- Bridge (optional, your machine): [matthew-rutledge-dev/grok-bot-discord-bridge](https://github.com/matthew-rutledge-dev/grok-bot-discord-bridge)

**Marketplace installers use their own Discord and infrastructure.** Configure **your own** Discord bot token (and optional guild / self-hosted bridge URL) via plugin variables. Host vaults and deploy paths are specific to each installation — never a shared provider.

Do not merge this plugin into a shared general catalog without an explicit maintainer decision. Do not put secrets in git. Do not deploy to someone else's wake path from this plugin.

## What this plugin is

| Piece | Role |
|-------|------|
| `discord-fleet-status` MCP | Optional bridge `GET /healthz` probe + Discord REST identity/guild/channel reads |
| `discord-fleet-manage` MCP | Boundary docs, dry-run channel-map plans, gated read helpers (`confirm=true`) |
| Skills | Boundary, status, manage planning, operator-driven optional bridge setup, **callback-setup** (self-callback secrets), hop-shorthand encode/decode |

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

Declared in `.grok-plugin/plugin.json`, root `plugin.json`, and `.cursor-plugin/plugin.json` as a JSON Schema `variables` object. MCP configs map them into process env via `${DISCORD_BOT_TOKEN}`, `${DISCORD_GUILD_ID}`, `${DISCORD_BRIDGE_HEALTH_URL}`, `${DISCORD_BRIDGE_CALLBACK_TOKEN}`, `${DISCORD_BRIDGE_CALLBACK_URL}` — **no secret values in the repo**.

| Name | Required | Who sets it | Purpose |
|------|----------|-------------|---------|
| `DISCORD_BOT_TOKEN` | **Yes** (for Discord REST tools) | **Each installer — their own bot** | Bot token from the [Discord Developer Portal](https://discord.com/developers/applications). **Never commit.** |
| `DISCORD_GUILD_ID` | Optional | Your guild snowflake | Default guild for channel/guild status tools |
| `DISCORD_BRIDGE_HEALTH_URL` | Optional | Your self-hosted bridge | Full URL to **your** bridge `GET /healthz` (e.g. `http://127.0.0.1:18083/healthz`) |
| `DISCORD_BRIDGE_CALLBACK_TOKEN` | Optional | Your bridge `CALLBACK_TOKEN` | Bearer for **your** bridge `POST /callback` (agent self-callback / dual-deliver). Prefer Bot Secrets. **Never commit.** |
| `DISCORD_BRIDGE_CALLBACK_URL` | Optional | Your bridge callback | Full callback URL or base ending in `/callback` (placeholder `https://callback.example.com/callback`). Never ship real operator hosts. |

### Marketplace installers

1. Create **your own** Discord application + bot; invite it to **your** guild.
2. Set plugin variable `DISCORD_BOT_TOKEN` to that token (Plugins → Configure / host env injection — **prefer vault → runtime env** over plaintext `.env` on disk when avoidable).
3. Optionally set `DISCORD_GUILD_ID`.
4. Optionally self-host the wake bridge on **your** machine and set `DISCORD_BRIDGE_HEALTH_URL` (see skill `discord-fleet-bridge-setup`). Skip if you only need Discord REST status/manage.
5. For wake **self-callback / dual-deliver** without a host vault hop, file `DISCORD_BRIDGE_CALLBACK_TOKEN` + `DISCORD_BRIDGE_CALLBACK_URL` via skill `discord-fleet-callback-setup` (per-bot Secrets for multi-agent fleets).

You are **not** connecting to another installer's Discord, vault, or provider. Missing token → Discord REST tools report graceful "not configured" messages.

### Host-specific deployments

Self-hosted bridge deployments use the host vault or plugin variables configured by that installation. Keep credentials and deploy paths on **your** machine; this marketplace plugin does not provide a shared wake host.

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
| `/callback` | POST | Agent → Discord delivery (Bearer / `x-callback-token` with `CALLBACK_TOKEN`) — agents self-callback using `DISCORD_BRIDGE_CALLBACK_*` (skill `discord-fleet-callback-setup`); this plugin's MCP does not call `/callback` |

Typical self-host listens loopback-only (`127.0.0.1:18083`). Point `DISCORD_BRIDGE_HEALTH_URL` at that URL (or a local SSH tunnel end).

### Outbound media (`POST /callback`)

Auth is unchanged (Bearer or `x-callback-token`). Text-only bodies remain backward compatible. This plugin never calls `/callback`; document for installers' own bridge.

**JSON body**

| Field | Notes |
|-------|--------|
| `channelId` | Required (guild or DM channel snowflake) |
| `content` | Optional if ≥1 attachment |
| `replyToMessageId` | Optional |
| `attachments` | Optional, ≤10 items |

Each attachment is **either** base64 inline **or** an https URL (XOR — not both):

```json
{ "filename": "shot.png", "contentType": "image/png", "data": "<base64-no-data-url-prefix>" }
```

```json
{ "filename": "shot.png", "contentType": "image/png", "url": "https://cdn.example.com/shot.png" }
```

**Multipart:** form fields `channelId`, optional `content`, optional `replyToMessageId`, plus files as `files` / `files[]`.

**Limits:** 8 MiB per file, 25 MiB total. **MIME allowlist (bridge `48e6b699ef39273d23f4bf70b7a4299989b34f9e`):** `application/gzip`, `application/javascript`, `application/json`, `application/msword`, `application/pdf`, `application/rtf`, `application/tar`, `application/vnd.rar`, `application/vnd.ms-excel`, `application/vnd.ms-powerpoint`, `application/vnd.oasis.opendocument.presentation`, `application/vnd.oasis.opendocument.spreadsheet`, `application/vnd.oasis.opendocument.text`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/zip`, `application/x-7z-compressed`, `application/x-gzip`, `application/x-gtar`, `application/x-powershell`, `application/x-python`, `application/x-rar-compressed`, `application/x-sh`, `application/x-tar`, `application/x-yaml`, `application/xml`, `audio/mpeg`, `audio/ogg`, `audio/wav`, `image/gif`, `image/jpeg`, `image/png`, `image/webp`, `text/css`, `text/csv`, `text/html`, `text/javascript`, `text/markdown`, `text/plain`, `text/tab-separated-values`, `text/x-powershell`, `text/x-python`, `text/x-shellscript`, `text/xml`, `text/yaml`, `video/mp4`, `video/webm`. When `contentType` is missing or `application/octet-stream`, filename fallback also recognizes the existing media/PDF/text mappings plus `.md`, `.json`, `.xml`, `.yml`, `.yaml`, `.py`, `.ps1`, `.sh`, `.bash`, `.csv`, `.tsv`, `.html`, `.css`, `.js`, `.ts` (mapped to `text/plain`), `.docx`, `.xlsx`, `.pptx`, `.doc`, `.xls`, `.ppt`, `.odt`, `.ods`, `.odp`, `.rtf`, `.zip`, `.tar`, `.gz`, `.tgz`, `.7z`, and `.rar` (`.zip` → `application/zip`, `.tar` → `application/x-tar` / `application/tar`, `.gz` and `.tar.gz` → `application/gzip`, `.tgz` → `application/x-gtar`, `.7z` → `application/x-7z-compressed`, `.rar` → `application/vnd.rar` / `application/x-rar-compressed`). Archives/executables/disk images (`.exe`, `.msi`, `.dmg`, `.iso`, `.appimage`) are otherwise denied; unsupported values return **415**.

**Error codes (bridge):** `content_or_attachment_required`, `attachment_too_large`, `too_many_attachments`, `unsupported_media_type`, `attachment_fetch_failed`.

### Bridge hop timing (host-side telemetry)

A self-hosted bridge may emit one host-log `[timing] key=val …` line per stage for hop-latency diagnosis. Stages are `authz`, `build_wake`, `sendPrompt`, `callback_auth`, `callback_resolve`, `callback_deliver`, and `callback_total`. Fields include `stage`, `msg`, `hop=d:<slug>:<id>`, `ms`, `ok`, `attachments`, `chunks`, and optional `idle_ms` (from `sendPrompt` acceptance to callback via `replyToMessageId`). Timing lines contain no tokens or content. These logs belong to the bridge host, not this marketplace MCP; agents should not invent timings. Callback caps/MIME are unchanged.

Never put hop codes (`d:…`) or thin JSON into Discord replies — human text and/or allowed attachments only.

### Inbound media (wake)

On **your** bridge, thin JSON after `d:<slug>:<msgId>` may include optional:

```json
"a": [{ "url": "https://cdn.discordapp.com/…", "filename": "shot.png", "contentType": "image/png", "size": 12345 }]
```

These are Discord CDN **URL refs** (not base64). The same refs may appear on `sendPrompt` `metadata.attachments`. Text-only wakes are unchanged; attachment-only wakes (no human text) are OK. **CDN URLs expire** — fetch promptly on the installer/operator side. This plugin does not own wake or perform the fetch.

### Direct messages (DMs)

Wake DMs are handled by **your** optional self-hosted bridge (not this plugin). Summary for installers:

1. **Inbound** — Bridge needs `DirectMessages` intent; `security.dm.policy` is `pairing` | `allowlist` | `disabled`; combine `security.dm.allowFrom` with env allowlists; owner runs `!pair <userId>` under pairing; `ignoreBots` applies.
2. **Agent** — Set `security.dm.defaultAgentId` on **your** bridge `security.json`, or DMs deny as `dm_no_agent`. Guild channel-map rows do **not** route DMs.
3. **Outbound** — Same `POST /callback` as guild: `{channelId, content?, agentId?, replyToMessageId?, attachments?}`. Discord DMs are channels — use the DM channel snowflake from wake metadata (`discordChannelId`). There is **no** separate `send_dm` MCP in this plugin.
4. **Hop** — Guild wakes use `d:<channel-slug>:<msgId>`; DMs use the same shape with slug default `dm` (or `security.dm.slug`), and thin JSON `g` is `null` (optional `a:` for media). Strip `d:` + JSON from visible chat; Discord OUT is human text and/or allowed attachments — never hop codes. See skill `discord-fleet-hop-shorthand`.

Marketplace installers edit **their** bridge `security.json` (`dm.allowFrom`, `dm.defaultAgentId`, policy). Plugin variables are `DISCORD_BOT_TOKEN` / optional guild / health URL / optional callback token+URL — do not ship another operator's agent IDs, guild snowflakes, or real callback hosts as product defaults.

### Optional durable Cloudflare tunnel

Quick `trycloudflare.com` tunnels are temporary and stop when their `cloudflared` process stops. For durable self-hosted wake, use a named Cloudflare Tunnel with a supervised connector and your own public hostnames, for example:

```text
CALLBACK_BASE_URL=https://callback.example.com
GROK_BOT_SENDPROMPT_URL=https://sendprompt.example.com
```

Keep the bridge loopback-only behind the tunnel, rotate `CALLBACK_TOKEN`, and keep secrets in the host vault/runtime environment. The tunnel and wake gateway are optional and are not provided by this plugin. For `/healthz`, keep using the existing loopback binding and SSH tunnel workflow rather than exposing the bridge port.
## Skills

- `discord-fleet-boundary` — always on for fleet work; manage/status vs wake path; **per-installer credentials, not shared provider**; points at callback token/URL + callback-setup for wake replies
- `discord-fleet-status` — health/status checks via status MCP
- `discord-fleet-manage` — channel-binding plans / gated inspect (dry-run / confirm)
- `discord-fleet-bridge-setup` — **operator-driven** optional wake-bridge setup on an explicit ask (clone/deploy/verify `/healthz` on **your** host; never silent postinstall; never `curl|bash`; prefer plugin vars / vault→runtime env over plaintext `.env`). After the bridge is up, run `discord-fleet-callback-setup` for agent self-callback. Skill includes short **Windows vs Linux** notes.
- `discord-fleet-callback-setup` — **first-class** operator-driven setup for durable `DISCORD_BRIDGE_CALLBACK_TOKEN` + `DISCORD_BRIDGE_CALLBACK_URL` (secure secret card; verify present/missing only; safe curl smoke; per-bot Secrets for multi-agent fleets). Not silent postinstall.
- `discord-fleet-hop-shorthand` — inbound wake is exactly `d:<slug>:<msgId>` (guild slug from channel-map; DMs default slug `dm`, `g` may be `null`), thin JSON `{id,g,u,map}` with optional `a:` CDN attachment refs, then human content; after decode/absorb, Grok chat shows **human content only** (strip `d:` + JSON); Discord OUT is human text and/or allowed `/callback` attachments — never hop codes; same `/callback` with DM `channelId`; dual-deliver prefers `process.env.DISCORD_BRIDGE_CALLBACK_*` (no host-vault hop required; never ask another agent to deliver)

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

No tokens in git. Marketplace users set **plugin variables** (or host env injection from their vault). Prefer vault → runtime env over leaving plaintext `.env` on disk when avoidable. Secrets remain in the installer's host vault or plugin variables.

## License

MIT — Copyright (c) 2026 Matthew Rutledge
