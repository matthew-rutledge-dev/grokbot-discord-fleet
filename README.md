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
| `discord-fleet-manage` MCP | Boundary docs, dry-run channel-map plans, gated Discord REST (`confirm=true`): inspect/resolve, message history, post message, bot channel perms |
| Skills | Boundary, status, manage planning, operator-driven optional bridge setup, **callback-setup** (self-callback secrets), hop-shorthand encode/decode |

## Layout (Grok-canonical)

| Path | Purpose |
|------|---------|
| `.grok-plugin/plugin.json` | **Primary** Grok Build / marketplace manifest (includes `variables`) |
| `.mcp.json` | MCP servers for Grok (catalog default name); env maps `${DISCORD_*}` |
| `skills/` | Skill folders with `SKILL.md` |
| `mcp/status`, `mcp/manage` | Local stdio MCP TypeScript sources (start via `node` + local `tsx` after bootstrap) |
| `scripts/bootstrap-mcp.sh` | **Required** post-clone `npm ci` (Linux / macOS / Git Bash) |
| `scripts/bootstrap-mcp.ps1` | **Required** post-clone `npm ci` on native Windows PowerShell |
| `assets/logo.svg` | Marketplace logo (referenced from manifests) |
| `.cursor-plugin/plugin.json` + `mcp.json` | Optional Cursor dual-support |

Marketplace index tooling (`xai-org/plugin-marketplace`) discovers `.grok-plugin/plugin.json` and defaults MCP scan to `.mcp.json`.

## Install — Grok Build

### Grok Build marketplace install

The official [xAI plugin-marketplace PR #1088](https://github.com/xai-org/plugin-marketplace/pull/1088) is open for this plugin. After xAI merges it, install the catalog entry with:

```bash
grok plugin marketplace list
grok plugin install grokbot-discord-fleet --trust
```

Then run **Post-clone MCP deps** (`./scripts/bootstrap-mcp.sh` or `.\scripts\bootstrap-mcp.ps1` from the installed plugin root) unless the host documents that it already ran `npm ci` for plugin MCP packages. Set **plugin variables** (below) to **your** Discord bot token — not anyone else's. The marketplace entry is SHA-pinned to this repository; do not replace it with an unpinned remote.

### Local/manual install

Grok loads plugins from `./.grok/plugins/`, `~/.grok/plugins/`, config `[plugins] paths`, or `--plugin-dir`:

```bash
# Clone / copy into user plugins
mkdir -p ~/.grok/plugins
git clone https://github.com/matthew-rutledge-dev/grokbot-discord-fleet.git ~/.grok/plugins/grokbot-discord-fleet
# Required: install MCP package dependencies (first-time + after pull when lockfiles change)
~/.grok/plugins/grokbot-discord-fleet/scripts/bootstrap-mcp.sh
# Windows PowerShell:
#   ~/.grok/plugins/grokbot-discord-fleet/scripts/bootstrap-mcp.ps1
# or: grok --plugin-dir /path/to/grokbot-discord-fleet …
```

If your Grok Build build supports installing a local/git path via `grok plugin install`, prefer that over hand-copy; otherwise use the directory layout above. Configure plugin variables / env (below) before starting Grok. Always run **Post-clone MCP deps** after clone/copy.

### Cursor (optional dual-support)

```bash
mkdir -p ~/.cursor/plugins/local
cp -a /path/to/grokbot-discord-fleet ~/.cursor/plugins/local/grokbot-discord-fleet
# or: ln -s /path/to/grokbot-discord-fleet ~/.cursor/plugins/local/grokbot-discord-fleet
# Required: install MCP package dependencies
~/.cursor/plugins/local/grokbot-discord-fleet/scripts/bootstrap-mcp.sh
# Windows PowerShell:
#   ~/.cursor/plugins/local/grokbot-discord-fleet/scripts/bootstrap-mcp.ps1
```

Cursor uses `.cursor-plugin/plugin.json` and `mcp.json` (`${CURSOR_PLUGIN_ROOT}`). Set variables under Plugins → Configure (or equivalent). MCP servers start with **`node ./node_modules/tsx/dist/cli.mjs src/index.ts`** in each package cwd (portable on Windows and Linux — avoids fragile bare `npm` / `npm.cmd` stdio spawns). They fail until bootstrap has run.

Cursor does not read `~/.grok/plugins`. Copy or symlink the same commit into `~/.cursor/plugins/local/grokbot-discord-fleet`, run bootstrap there, set the same plugin variables, and restart Cursor. A symlink is one tree. A copy has to be updated again after every pull.

The Grok Bot desktop app also keeps its own plugin copy. It does not read `~/.grok/plugins` or the Cursor folder. Install this same commit in that app and restart the app. Updating only Grok Build leaves the other two hosts on the old files.

### If the MCP handshake closes

`discord-fleet-status` and `discord-fleet-manage` speak MCP on stdin. A "connection closed" during initialize means the process exited before it answered. Check these in order:

1. `node` and `npm` are on `PATH`. Run the bootstrap script for the copy that host actually loads.
2. Set `DISCORD_BOT_TOKEN` in that host's plugin variables, or in the environment of the process that starts the host. The value is read when the host process starts. A session that is already open does not see a token added later.
3. Confirm the host expanded its plugin-root variable before spawn. Grok Build uses `${GROK_PLUGIN_ROOT}` in `.mcp.json`. Cursor uses `${CURSOR_PLUGIN_ROOT}` in `mcp.json`. If that variable is empty, `cwd` is not the `mcp/status` or `mcp/manage` directory and Node exits immediately.
4. On that machine only, you may set `cwd` in the local MCP file to the absolute `mcp/status` and `mcp/manage` directories. Do not commit that change. The public files keep the placeholder.
5. Restart the host. Skills can load while the MCP servers stay down. The next start is what attaches the servers.

A manual check from the plugin root, with a throwaway token, should print one JSON line whose `serverInfo.name` is `discord-fleet-manage`:

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}' \
  | DISCORD_BOT_TOKEN=probe node ./node_modules/tsx/dist/cli.mjs src/index.ts
```

Run that with the working directory `mcp/manage`. Do not use your real bot token in the command line.

### Post-clone MCP deps (required)

Both MCP servers are TypeScript and need local `node_modules` (including `@modelcontextprotocol/sdk` and `tsx`). **README-only install without this step leaves MCP unloadable.**

**Prereqs:** Node.js LTS on `PATH` (`node` and `npm` / `npm.cmd`).

```bash
# Linux / macOS / Git Bash — from the plugin root:
./scripts/bootstrap-mcp.sh
# equivalent:
#   (cd mcp/status && npm ci) && (cd mcp/manage && npm ci)
```

```powershell
# Windows native PowerShell — from the plugin root:
.\scripts\bootstrap-mcp.ps1
# If script execution is blocked for the session:
#   powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-mcp.ps1
```

**Windows notes (marketplace / Cursor):**
- Prefer `bootstrap-mcp.ps1` on PowerShell. Git Bash works with `bootstrap-mcp.sh` (script is LF via `.gitattributes`; hardened so `pipefail` does not break older Git Bash).
- MCP configs use `command: node` + `./node_modules/tsx/dist/cli.mjs` (not bare `npm start`) so stdio launch does not hang on `npm`/`npm.cmd` resolution.
- If a `.sh` file was somehow checked out with CRLF and the shebang fails: `bash scripts/bootstrap-mcp.sh` or convert with `sed -i 's/\r$//' scripts/bootstrap-mcp.sh`.
- Plugin root placeholders: Cursor `${CURSOR_PLUGIN_ROOT}` in `mcp.json`; Grok `${GROK_PLUGIN_ROOT}` in `.mcp.json`. Paths use forward slashes; Node on Windows accepts them when `cwd` is set.

Re-run after pulling commits that change `mcp/*/package-lock.json`. No postinstall hooks ship in this repo — bootstrap is an explicit operator step (never silent RCE).

## Plugin variables (marketplace-friendly)

Declared in `.grok-plugin/plugin.json`, root `plugin.json`, and `.cursor-plugin/plugin.json` as a JSON Schema `variables` object. MCP configs inject the variables used by the MCP servers (`DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, and `DISCORD_BRIDGE_HEALTH_URL`) into their process environments. Callback variables remain manifest-declared for operator-driven skills/Bot Secrets and are not used by these MCP servers — **no secret values in the repo**.

| Name | Required | Who sets it | Purpose |
|------|----------|-------------|---------|
| `DISCORD_BOT_TOKEN` | **Yes** (required product input) | **Each installer — their own bot** | Required for Discord REST status/manage tools (identity, reads, posts, permissions, and moderation). Get it from the [Discord Developer Portal](https://discord.com/developers/applications). **Never commit.** |
| `DISCORD_GUILD_ID` | Optional | Your guild snowflake | Default guild for channel/guild status tools |
| `DISCORD_BRIDGE_HEALTH_URL` | Optional | Your self-hosted bridge | Full URL to **your** bridge `GET /healthz` (e.g. `http://127.0.0.1:18083/healthz`) |
| `DISCORD_BRIDGE_CALLBACK_TOKEN` | Optional | Your bridge `CALLBACK_TOKEN` | Bearer for **your** bridge `POST /callback` (agent self-callback / dual-deliver). Prefer Bot Secrets. **Never commit.** |
| `DISCORD_BRIDGE_CALLBACK_URL` | Optional | Your bridge callback | Full callback URL or base ending in `/callback` (placeholder `https://callback.example.com/callback`). Never ship real operator hosts. |

### Marketplace installers

Follow **[Discord bot token & invite](#discord-bot-token--invite)** below for the full bot-create / invite / intent checklist, then:

1. Set plugin variable `DISCORD_BOT_TOKEN` (Plugins → Configure / host env injection — **prefer vault → runtime env** over plaintext `.env` on disk when avoidable).
2. Optionally set `DISCORD_GUILD_ID` and/or `DISCORD_BRIDGE_HEALTH_URL` (self-hosted bridge `/healthz` — skill `discord-fleet-bridge-setup`).
3. For wake **self-callback / dual-deliver**, file `DISCORD_BRIDGE_CALLBACK_TOKEN` + `DISCORD_BRIDGE_CALLBACK_URL` via skill `discord-fleet-callback-setup` (per-bot Secrets for multi-agent fleets).

You are **not** connecting to another installer's Discord, vault, or provider. `DISCORD_BOT_TOKEN` is required for the product: without it, the Discord REST status/manage tools cannot operate. An optional bridge health check can report liveness, but it is not a substitute for the Discord REST integration.

### Host-specific deployments

Self-hosted bridge deployments use the host vault or plugin variables configured by that installation. Keep credentials and deploy paths on **your** machine; this marketplace plugin does not provide a shared wake host.


## Discord bot token & invite

Each marketplace installer creates **their own** Discord application and bot. This plugin never ships a shared token. **Never commit** tokens; **never paste** them in chat — use Bot Secrets / plugin variables / vault → runtime env.

### Checklist

1. **Create the app + bot** — Open the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application** → open the **Bot** tab → **Add Bot** (or use an existing bot on that app).
2. **Copy the bot token** — Bot tab → **Reset Token** / **Copy**. Set it as plugin variable / Bot Secret / env **`DISCORD_BOT_TOKEN`**. Prefer vault → runtime env. Never commit; never paste in chat.
3. **Privileged Gateway Intents** (Portal → Bot → Privileged Gateway Intents) — match what you will run:
   - **This plugin alone** (Discord REST status/manage MCP) — **no** privileged gateway intents required (HTTP REST with the bot token only; this plugin does not open a Discord Gateway).
   - **Optional self-hosted wake bridge** (`matthew-rutledge-dev/grok-bot-discord-bridge`) — enable intents the bridge uses: **Message Content Intent** (privileged; required to read guild/DM message bodies for wake), plus non-privileged **Guilds**, **Guild Messages**, and **Direct Messages** when you want DM wake (see bridge README / skill `discord-fleet-bridge-setup`).
4. **Invite the bot to your guild** — Portal → OAuth2 → **URL Generator**: scope **`bot`**; select the permissions in **[Discord bot permissions](#discord-bot-permissions)** below (messaging minimum, plus moderation if you will use manage MCP timeout/kick/ban/delete/purge). Open the generated URL while logged into Discord, select **your** guild, authorize. **Creating a token does not grant channel access by itself** — see permissions section (role + channel overwrites).
5. **Optional plugin vars** — `DISCORD_GUILD_ID` (default guild snowflake for status/manage tools); `DISCORD_BRIDGE_HEALTH_URL` (full URL to **your** bridge `GET /healthz`, e.g. `http://127.0.0.1:18083/healthz`) when you self-host a bridge.
6. **Optional dual-deliver / self-callback** (separate self-hosted bridge) — file **`DISCORD_BRIDGE_CALLBACK_TOKEN`** + **`DISCORD_BRIDGE_CALLBACK_URL`** via secret cards (skill `discord-fleet-callback-setup`). Auth is **header-only** as of bridge **0.2.4+**: `Authorization: Bearer <token>` or header **`x-callback-token`**. Query `?token=` is **rejected (401)** — do not use.
7. **Skills** — bot/bridge bring-up: `discord-fleet-bridge-setup`; callback secrets: `discord-fleet-callback-setup`; wake hop / dual-deliver: `discord-fleet-hop-shorthand` (prefer `process.env.DISCORD_BRIDGE_CALLBACK_*` on each woken bot).

## Discord bot permissions

Token creation ≠ automatic access. The bot can only act where **(1)** the invite OAuth permission bits allow it, **(2)** the bot’s **role** (and any extra roles you assign) grant those bits in the guild, **(3)** **channel permission overwrites** do not deny View/Send/History (or Manage Messages) for the bot’s role, and **(4)** for member actions (timeout / kick / ban) the bot’s **highest role sits above** the target member’s highest role (Discord role hierarchy). Private channels still need an explicit allow / role invite into that channel.

### Messaging (status + post / history)

| Permission (URL Generator name) | Bit | Needed for |
|---------------------------------|-----|------------|
| **View Channel** (View Channels) | `1 << 10` (1024) | `inspect_guild`, `resolve_channel`, `list_channel_messages`, `post_channel_message`, wake bridge listen |
| **Send Messages** | `1 << 11` (2048) | `post_channel_message`; optional bridge `/callback` replies |
| **Read Message History** | `1 << 16` (65536) | `list_channel_messages`, `purge_channel_messages` (fetch), history before post |
| **Attach Files** | `1 << 15` (32768) | Optional; bridge outbound attachments / rich replies |
| **Embed Links** | `1 << 14` (16384) | Optional; embeds in posts |

**Messaging-only permission integer** (View + Send + History + Attach + Embed): **`117760`**.

### Moderation (manage MCP 0.3.24+)

| Permission | Bit | Needed for |
|------------|-----|------------|
| **Manage Messages** | `1 << 13` (8192) | `delete_message`, `purge_channel_messages` (others’ messages; bulk-delete) |
| **Moderate Members** | `1 << 40` (1099511627776) | `timeout_member` (timeout / clear timeout) |
| **Kick Members** | `1 << 1` (2) | `kick_member` |
| **Ban Members** | `1 << 2` (4) | `ban_member`, `unban_member` |

**Messaging + Manage Messages:** **`125952`**.

**Full fleet (messaging + Manage Messages + Kick + Ban + Moderate Members):** **`1099511753734`**.

### OAuth2 URL Generator — recreate invite

1. Discord Developer Portal → your application → **OAuth2** → **URL Generator**.
2. **Scopes:** check **`bot`** only (add `applications.commands` only if you later add slash commands — this plugin does not require it).
3. **Bot Permissions:** either tick the named boxes above, **or** paste one of the integers into the permissions field / calculator:
   - Messaging only: `117760`
   - Messaging + Manage Messages: `125952`
   - Full moderation set: `1099511753734`
4. Copy the generated URL → open while logged into Discord → select **your** guild → authorize.
5. In the guild: **Server Settings → Roles** — drag the bot’s role **above** any roles you may timeout/kick/ban; confirm channel overwrites allow **View Channel** (and Send / History / Manage Messages as needed) in target channels. Use manage MCP `check_bot_channel_permissions` (`confirm=true`) to verify.

### How to add permissions later (without re-creating the bot)

If the bot is already in the guild but moderation fails with Missing Permissions:

1. **Re-invite with a higher permission integer** (same OAuth2 URL Generator steps; Discord merges/updates the bot’s granted bits on re-authorize), **or**
2. **Server Settings → Roles → [Bot role]** — enable **Moderate Members**, **Kick Members**, **Ban Members**, **Manage Messages** (and messaging bits if missing).
3. Fix **channel overwrites** on private channels (allow the bot role View/Send/History/Manage Messages).
4. Fix **role hierarchy** (bot role above targets). Owner/admin can always re-order roles.

All moderation manage tools still require **`confirm=true`** (dry-run preview without it). They never wake agents / call `sendPrompt`.

## Network endpoints (declare for operators / marketplace)

| Endpoint | When | Purpose |
|----------|------|---------|
| `https://discord.com/api/v10/*` (Discord REST) | When `DISCORD_BOT_TOKEN` is set | Identity, guilds, channels; confirm-gated post / moderation via manage MCP |
| Bridge `GET /healthz` at `DISCORD_BRIDGE_HEALTH_URL` | Optional (your bridge) | Liveness / `discordReady` probe — **not** wake / `sendPrompt` |

Confirm-gated Discord REST from manage MCP may post / moderate when you call tools with `confirm=true`. No channel-map writes, no gateway listen, no wake / `sendPrompt` from this plugin.

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

- `describe_manage_boundary` — this plugin does **not** wake bots / call `sendPrompt`; lists confirm-gated tools
- `plan_channel_binding` — dry-run draft row for bridge `channel-map.json` (no writes)
- `inspect_guild` — Discord REST guild/roles/channels snapshot; requires `confirm=true`
- `resolve_channel` — Discord REST `GET /channels/{id}`; requires `confirm=true`
- `list_channel_messages` — Discord REST recent messages (limit capped at 50); requires `confirm=true`
- `post_channel_message` — Discord REST create message; dry-run without `confirm=true`; refuses empty content; returns message id
- `check_bot_channel_permissions` — computed bot View/Send/History/Manage Messages + Kick/Ban/Moderate flags; requires `confirm=true`
- `timeout_member` — Moderate Members timeout (`durationSeconds=0` clears); dry-run without `confirm=true`
- `kick_member` — Kick Members; dry-run without `confirm=true`
- `ban_member` — Ban Members (optional `deleteMessageSeconds`); dry-run without `confirm=true`
- `unban_member` — remove ban; dry-run without `confirm=true`
- `delete_message` — delete one message; dry-run without `confirm=true`
- `purge_channel_messages` — bulk-delete when Discord allows (≥2,<100, <14d) else single-delete / note limits; cap 100; dry-run without `confirm=true`
- `evaluate_bridge_bot_enable` — pure check of global `botsEnabled` (default on) AND per-site `sites[].enabled`; neither store writes the other; no Discord call

## Bridge bot enable (two independent layers)

Bridge bots use two stores. Do not collapse them into one flag. This plugin evaluates the rule; it does not start or stop bridge processes and does not write the live channel map.

| Store | Key | Default | What it controls |
|-------|-----|---------|------------------|
| Global | `botsEnabled` | **ON**. A missing flag means enabled. | Whether bridge bots run at all. When off, bots do not run even if a site is enabled. |
| Per-site | `sites[].enabled` (same meaning as channel-map `channels[].enabled`) | Off unless that site is explicitly enabled | Whether that site is on. Changing it does not write `botsEnabled`. |

Evaluation order (`bridgeBotRunsForSite` in `mcp/manage/src/bot-enable.ts`):

1. Read `botsEnabled`. If the flag is missing or not a boolean, treat it as on.
2. Read that site's `enabled` flag from the separate site store. A missing site is off.
3. The bridge bot runs for the site only when global is on **and** that site is on.

`setGlobalBotsEnabled` copies site rows unchanged. `setSiteEnabled` preserves `botsEnabled` exactly, including when it was omitted. Manage MCP `evaluate_bridge_bot_enable` returns that result (no Discord call). Example:

```json
{
  "botsEnabled": true,
  "sites": [{ "siteId": "<site-id>", "enabled": true }]
}
```

## Install locations

Grok Build loads this plugin from `~/.grok/plugins/grokbot-discord-fleet` on the operator's machine. The Grok Bot desktop app does not read that directory. It keeps its own plugin copy. Every Fleet deploy must install the same commit in both places. Updating only Grok Build leaves the Grok Bot app on the older copy.

## Channel map example

The live map stays on the bridge host. This plugin does not ship it. Fields below `requireMention` are optional. Values are placeholders.

```json
{
  "enabled": false,
  "channelId": "<snowflake>",
  "label": "example",
  "agentId": "<agent-uuid>",
  "sendPromptUrl": null,
  "requireMention": false,
  "primary_llm": "local",
  "wake_agent": false,
  "handler": "example-handler",
  "local_handler": "example-local-handler",
  "harness": "grok-build",
  "profile": "example-profile"
}
```

Agent ids for a real roster belong in the operator's local roster file, not in this repo. To wake a bot by alias from a shell, operators use their own send script and that local file.

## Bridge HTTP (reference — optional self-host)

From bridge README / `http-server.ts` (read-only reference repo):

| Path | Method | Purpose |
|------|--------|---------|
| `/healthz` | GET | Liveness + `discordReady` / `hasTokenConfigured` |
| `/callback` | POST | Agent → Discord delivery (Bearer / `x-callback-token` with `CALLBACK_TOKEN`) — agents self-callback using `DISCORD_BRIDGE_CALLBACK_*` (skill `discord-fleet-callback-setup`); this plugin's MCP does not call `/callback` |

Typical self-host listens loopback-only (`127.0.0.1:18083`). Point `DISCORD_BRIDGE_HEALTH_URL` at that URL (or a local SSH tunnel end).

### Outbound media (`POST /callback`)

Auth is **header-only** (bridge **0.2.4+**): `Authorization: Bearer <token>` or **`x-callback-token`**. Query `?token=` alone / no auth / wrong Bearer → **401**. Text-only bodies remain valid. This plugin never calls `/callback`; document for installers' own bridge.

### Local handler output

When a bridge hop hands work to a local handler instead of `sendPrompt`, the hop must pass:

- the real inbound Discord message id (the same id as `d:<slug>:<msgId>`), not a placeholder
- the bridge callback URL (`CALLBACK_BASE_URL` + `CALLBACK_PATH`, or `DISCORD_BRIDGE_CALLBACK_URL`)

The handler POSTs the result (text and/or an image) to that URL. Auth is header-only: `Authorization: Bearer <token>` or `x-callback-token`. Do not put the callback token in the query string. Set `replyToMessageId` to the inbound message id and `channelId` to the hop's channel. A handler that is not given those two values can exit successfully and never post.

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

## Bridge operator notes (generic)

- **User-Agent:** callbacks must send a non-default User-Agent (e.g. `grok-bot-discord-bridge-client/1.0`). Default library UAs can be rejected at the edge with Cloudflare **1010** before reaching the bridge, so the bridge logs nothing.
- **DM replies:** send `userId` and omit `channelId`. Sending neither returns `400 channelId_required`.
- **Wake hop JSON:** `c` (channel ID) is optional and may be present for DMs too; decoders must accept the hop with or without it.

| Symptom | Meaning |
|---|---|
| 1010 | Edge blocked the request (usually the User-Agent) |
| 401 | Bad or missing Bearer; the hop did reach the origin |
| 400 `channelId_required` | Neither `channelId` nor `userId` sent |
| 502 / 1033 | sendPrompt tunnel is down |

- **Tunnel connector:** it does not come back on its own after a host restart; run `scripts/ensure-sendprompt-tunnel.sh` from startup. On networks that block UDP, run the connector with `--protocol http2` (QUIC won't connect). The watchdog restarts the connector and checks the public URL.
- **Deploy:** exclude the runtime `security.json`, `channel-map.json` and `.env` from the rsync; back them up first and compare checksums after. Configs are bind-mounted read-only and root-owned. Never run `docker compose config` where logs are shared: it expands secrets.

## Skills

- `discord-fleet-boundary` — always on for fleet work; manage/status vs wake path; **per-installer credentials, not shared provider**; points at callback token/URL + callback-setup for wake replies
- `discord-fleet-status` — health/status checks via status MCP
- `discord-fleet-manage` — channel-binding plans / gated inspect + message history / post / bot channel perms (dry-run / confirm)
- `discord-fleet-bridge-setup` — **operator-driven** optional wake-bridge setup on an explicit ask (clone/deploy/verify `/healthz` on **your** host; never silent postinstall; never `curl|bash`; prefer plugin vars / vault→runtime env over plaintext `.env`). After the bridge is up, run `discord-fleet-callback-setup` for agent self-callback. Skill includes short **Windows vs Linux** notes.
- `discord-fleet-callback-setup` — **first-class** operator-driven setup for durable `DISCORD_BRIDGE_CALLBACK_TOKEN` + `DISCORD_BRIDGE_CALLBACK_URL` (secure secret card; verify present/missing only; safe curl smoke; per-bot Secrets for multi-agent fleets). Not silent postinstall.
- `discord-wake-on-sleep` — operator-driven: one webhook-triggered routine per Grok Bot account (idempotent) that runs `scripts/ensure-sendprompt-tunnel.sh` when the bridge wake hook fires; operator copies webhook URL + sender key into the bridge `.env` (bot never sees the key)
- `discord-fleet-hop-shorthand` — inbound wake is exactly `d:<slug>:<msgId>` (guild slug from channel-map; DMs default slug `dm`, `g` may be `null`), thin JSON `{id,g,u,map}` with optional `a:` CDN attachment refs, then human content; after decode/absorb, Grok chat shows **human content only** (strip `d:` + JSON); Discord OUT is human text and/or allowed `/callback` attachments — never hop codes; same `/callback` with DM `channelId`; dual-deliver prefers `process.env.DISCORD_BRIDGE_CALLBACK_*` (no host-vault hop required; never ask another agent to deliver)

## Submit to Cursor Marketplace (optional)

When local install works (clone → bootstrap → configure variables → MCP `initialize` / `tools/list`):

1. Confirm the [Cursor Plugins submission checklist](https://cursor.com/docs/reference/plugins) (valid `.cursor-plugin/plugin.json`, relative logo `assets/logo.svg`, variables cover every `${…}` in `mcp.json`, public MIT repo, no secrets).
2. Submit the public GitHub URL at [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish).
3. Do **not** submit until a fresh-clone README walk passes without undocumented steps.

## Grok Marketplace PR

The official Grok catalog submission is [xai-org/plugin-marketplace#1088](https://github.com/xai-org/plugin-marketplace/pull/1088). It adds this repository as a **remote** entry, pinned to a full commit SHA, and was validated with the marketplace catalog checks. The entry remains under the public `matthew-rutledge-dev` repository; **CDCCENTRAL is the publisher brand, not a different repository owner**.

After xAI merges the PR, use the [Grok Build marketplace install](#grok-build-marketplace-install) commands above. The Cursor submission at [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish) is a separate, optional catalog path; it does not publish the plugin to Grok.

## sendPrompt tunnel watchdog (optional)

`scripts/ensure-sendprompt-tunnel.sh` is an idempotent entry point (run it from cron/startup); it starts `scripts/sendprompt-tunnel-watchdog.sh` once. The watchdog probes `SENDPROMPT_TUNNEL_URL` every 60s, treats any non-3-digit status, `000`, `401`/`403` (usually a misconfigured URL or auth), or 5xx as a miss, kills the connector after 2 misses, restarts at once after a >3 min clock jump (resume from sleep), and does a daily forced restart at 06:00 local (date file; catches up on wake; seeded on first start so a start after 06:00 doesn't restart immediately). Every non-404 probe and every restart is logged.

| Env | Default |
|---|---|
| `SENDPROMPT_TUNNEL_URL` | required |
| `SENDPROMPT_STATE_DIR` | `${XDG_STATE_HOME:-~/.local/state}/grokbot-sendprompt` (logs, locks, date file) |
| `SENDPROMPT_CONNECTOR_PROC` / `SENDPROMPT_CONNECTOR_MATCH` | `cloudflared` / `grok-bot-sendprompt-tunnel` (cmdline substring) |
| `SENDPROMPT_SUPERVISOR` | unset (command that keeps the connector running; word-split, so paths can't contain spaces) |
| `SENDPROMPT_ENSURE` | sibling `ensure-sendprompt-tunnel.sh` |
| `SENDPROMPT_INTERVAL` / `_FAIL_LIMIT` / `_JUMP_SECS` / `_DAILY_HOUR` / `_HEALTHY_CODE` | `60` / `2` / `180` / `6` (empty disables) / `404` |

Check with `scripts/sendprompt-tunnel-watchdog.sh --selftest`.

## Wake on sleep (optional)

Grok Bot boxes hibernate. While asleep the sendPrompt tunnel is down, so the bridge holds Discord messages and then red-Xes them after its hold window. The bridge's optional wake hook fixes this:

1. sendPrompt hits a retryable tunnel error (530, 1033, 502–504, or a network error).
2. The bridge POSTs **once per outage** to a Grok Bot **webhook-triggered routine** (debounced until the next successful sendPrompt).
3. The routine wakes the box and runs `scripts/ensure-sendprompt-tunnel.sh`; the tunnel returns and held messages deliver.

Set up the routine with the `discord-wake-on-sleep` skill: **one routine per Grok Bot account** (all bots on an account share one box), reused if it already exists. Copy the routine's webhook URL and sender key from the routine panel into the bridge `.env` yourself; the bot never sees the key. Never commit either value.

| Bridge env | Default | Meaning |
|---|---|---|
| `SENDPROMPT_WAKE_URL` | blank (off) | Routine webhook URL |
| `SENDPROMPT_WAKE_KEY` | blank (off) | Routine sender key; sent only in a header, never in the body |
| `SENDPROMPT_WAKE_HEADER` | `Authorization: Bearer <key>` | Header that carries the key (**confirm against the bridge release**) |
| `SENDPROMPT_HOLD_MAX_SECONDS` | `900` | How long the bridge holds messages before giving up |

POST body: `{reason, heldCount, firstHeldAt}` — no tokens, no message content. Env names must match the bridge's wake hook release.

**Turn off:** blank `SENDPROMPT_WAKE_URL` / `SENDPROMPT_WAKE_KEY` and restart the bridge, or pause the routine.

**Troubleshooting**

- *Messages still red-X:* the box takes longer to wake + reconnect than `SENDPROMPT_HOLD_MAX_SECONDS`; raise it, and check the routine actually ran.
- *Routine never runs:* wake URL/key blank or mistyped; header shape doesn't match what the routine expects (see `SENDPROMPT_WAKE_HEADER`); the routine is paused.
- *Fires only once:* expected — one POST per outage until a sendPrompt succeeds.
- *Routine runs but tunnel stays down:* `SENDPROMPT_TUNNEL_URL` / connector settings missing from the routine's environment; check the `ensure-sendprompt-tunnel` status line and see **sendPrompt tunnel watchdog** above.
- *Duplicate routines:* delete extras; one per account is enough.

## Secrets

No tokens in git. Marketplace users set **plugin variables** (or host env injection from their vault). Prefer vault → runtime env over leaving plaintext `.env` on disk when avoidable. Secrets remain in the installer's host vault or plugin variables.

## License

MIT — Copyright (c) 2026 Matthew Rutledge
