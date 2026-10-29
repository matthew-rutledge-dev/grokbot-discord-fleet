# Grok Bot Discord Fleet

Plugin home for the **Discord fleet** MCP server (`discord-fleet`: status + manage tools in one server) + skills. Aligned for **Grok Build** (xAI plugin marketplace conventions) with optional Cursor dual-support.

**This is NOT the wake path.** Runtime wake (Gateway → `sendPrompt` / webhook) lives in a separate repo you may optionally self-host:

- Host bridge (optional, your machine): the reference wake runtime is [grok-bot-universal-bridge](https://github.com/matthew-rutledge-dev/grok-bot-universal-bridge) with its Discord adapter enabled. Any compatible self-hosted host bridge works. Install and run it from that repo's README; the older standalone Discord bridge is superseded and is not the recommended path. Wakes go Discord → host bridge → the Grok Bot Gateway (`sendPrompt` / webhook routine); this plugin is not on that path.

**Marketplace installers use their own Discord and infrastructure.** Configure **your own** Discord bot token (and optional guild / self-hosted bridge URL) via plugin variables. Host vaults and deploy paths are specific to each installation — never a shared provider.

Do not merge this plugin into a shared general catalog without an explicit maintainer decision. Do not put secrets in git. Do not deploy to someone else's wake path from this plugin.

## What this plugin is

| Piece | Role |
|-------|------|
| `discord-fleet` MCP (one server) | Status tools: optional bridge `GET /healthz` probe + Discord REST identity/guild/channel reads. Manage tools: boundary docs, dry-run channel-map plans, Discord REST reads (inspect/resolve, message history, bot channel perms; no confirm needed) and `confirm=true`-gated writes (post message, moderation). Optional **read-only mode** (`DISCORD_FLEET_READ_ONLY` on, e.g. `1`) hides every write/moderation tool |
| Skills | Boundary, status, manage planning, operator-driven optional bridge setup, **callback-setup** (self-callback secrets), **wake-on-sleep** (recommended), **bridge-dual-deliver** (Discord wake decode + callback), hop-shorthand encode |

Not in this plugin: waking a Grok Bot or sending it a prompt from Grok Build, Cursor or a script. That's [grokbuild-grokbots](https://github.com/matthew-rutledge-dev/grokbuild-grokbots), which is the single source for that webhook setup (`GROKBOTS_WEBHOOK_URL` / `GROKBOTS_WEBHOOK_KEY` / roster file). This plugin covers the Discord side only.

## Layout (Grok-canonical)

| Path | Purpose |
|------|---------|
| `.grok-plugin/plugin.json` | **Primary** Grok Build / marketplace manifest (includes `variables`) |
| `.mcp.json` | MCP server for Grok (catalog default name); one `discord-fleet` entry; env maps `${DISCORD_*}` |
| `skills/` | Skill folders with `SKILL.md` |
| `mcp/discord-fleet` | Local stdio MCP TypeScript sources for the single server (bootstrap runs `npm ci --omit=dev` + `npm run build`; hosts start `node <plugin-root>/mcp/discord-fleet/dist/index.js`; `npm test` runs the tests) |
| `scripts/bootstrap-mcp.sh` | **Required** post-clone `npm ci --omit=dev` + `npm run build` (Linux / macOS / Git Bash) |
| `scripts/bootstrap-mcp.ps1` | **Required** post-clone `npm ci --omit=dev` + `npm run build` on native Windows PowerShell |
| `assets/logo.svg` | Marketplace logo (referenced from manifests) |
| `.cursor-plugin/plugin.json` + `mcp.json` | Optional Cursor dual-support |

Marketplace index tooling (`xai-org/plugin-marketplace`) discovers `.grok-plugin/plugin.json` and defaults MCP scan to `.mcp.json`.

## Install — Grok Build

### Grok Build marketplace install

The official [xAI plugin-marketplace PR #1088](https://github.com/xai-org/plugin-marketplace/pull/1088) is still open, not merged (rechecked 2026-10-20). Until xAI merges it, use **Local/manual install** below. After it merges, install the catalog entry with:

```bash
grok plugin marketplace list
grok plugin install grokbot-discord-fleet --trust
```

Then run **Post-clone MCP deps** (`./scripts/bootstrap-mcp.sh` or `.\scripts\bootstrap-mcp.ps1` from the installed plugin root) unless the host documents that it already ran `npm ci` and `npm run build` for plugin MCP packages. Set **plugin variables** (below) to **your** Discord bot token — not anyone else's. The marketplace entry is SHA-pinned to this repository; do not replace it with an unpinned remote.

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

Cursor uses `.cursor-plugin/plugin.json` and `mcp.json` (`${CURSOR_PLUGIN_ROOT}`). Set variables under Plugins → Configure (or equivalent). The MCP server starts with **`node ${CURSOR_PLUGIN_ROOT}/mcp/discord-fleet/dist/index.js`** (Grok Build: `${GROK_PLUGIN_ROOT}`). The path is absolute, so it works even when a host ignores the MCP `cwd` field, on Windows and Linux, and avoids fragile bare `npm` / `npm.cmd` stdio spawns. It fails until bootstrap has built `dist/index.js`.

Cursor does not read `~/.grok/plugins`. Copy or symlink the same commit into `~/.cursor/plugins/local/grokbot-discord-fleet`, run bootstrap there, set the same plugin variables, and restart Cursor. A symlink is one tree. A copy has to be updated again after every pull.

The Grok Bot desktop app also keeps its own plugin copy. It does not read `~/.grok/plugins` or the Cursor folder. Install this same commit in that app and restart the app. Updating only Grok Build leaves the other two hosts on the old files.

### If the MCP handshake closes

`discord-fleet` speaks MCP on stdin. A "connection closed" during initialize means the process exited before it answered. Check these in order:

1. `node` and `npm` are on `PATH`. Run the bootstrap script for the copy that host actually loads.
2. Set `DISCORD_BOT_TOKEN` in that host's plugin variables, or in the environment of the process that starts the host. The value is read when the host process starts. A session that is already open does not see a token added later.
3. Confirm the host expanded its plugin-root variable before spawn. Grok Build uses `${GROK_PLUGIN_ROOT}` in `.mcp.json`. Cursor uses `${CURSOR_PLUGIN_ROOT}` in `mcp.json`. If that variable is empty, the `dist/index.js` path in `args` is wrong and Node exits immediately (`Cannot find module`). The launch path does not depend on `cwd`, so a host that ignores `cwd` still works.
4. On that machine only, you may replace the placeholder in `args` with the absolute path to `mcp/discord-fleet/dist/index.js`. Do not commit that change. The public files keep the placeholder.
5. Restart the host. Skills can load while the MCP server stays down. The next start is what attaches the server.

A manual check from the plugin root, with a throwaway token, should print one JSON line whose `serverInfo.name` is `discord-fleet`:

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}' \
  | DISCORD_BOT_TOKEN=probe node mcp/discord-fleet/dist/index.js
```

Run that from the plugin root after bootstrap (any working directory works if you give the absolute path to `dist/index.js`). Do not use your real bot token in the command line.

### Post-clone MCP deps (required)

The MCP server is TypeScript: it needs local `node_modules` (including `@modelcontextprotocol/sdk` and `typescript`) and a build to `dist/index.js`. The bootstrap scripts do both. **README-only install without this step leaves MCP unloadable.**

**Prereqs:** Node.js LTS on `PATH` (`node` and `npm` / `npm.cmd`).

```bash
# Linux / macOS / Git Bash — from the plugin root:
./scripts/bootstrap-mcp.sh
# equivalent:
#   (cd mcp/discord-fleet && npm ci && npm run build)
```

```powershell
# Windows native PowerShell — from the plugin root:
.\scripts\bootstrap-mcp.ps1
# If script execution is blocked for the session:
#   powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-mcp.ps1
```

**Windows notes (marketplace / Cursor):**
- Prefer `bootstrap-mcp.ps1` on PowerShell. Git Bash works with `bootstrap-mcp.sh` (script is LF via `.gitattributes`; hardened so `pipefail` does not break older Git Bash).
- MCP configs use `command: node` + the absolute built entry `<plugin-root>/mcp/discord-fleet/dist/index.js` (not bare `npm start`, not a cwd-relative path) so stdio launch does not hang on `npm`/`npm.cmd` resolution and works when the host ignores `cwd`.
- If a `.sh` file was somehow checked out with CRLF and the shebang fails: `bash scripts/bootstrap-mcp.sh` or convert with `sed -i 's/\r$//' scripts/bootstrap-mcp.sh`.
- Plugin root placeholders: Cursor `${CURSOR_PLUGIN_ROOT}` in `mcp.json`; Grok `${GROK_PLUGIN_ROOT}` in `.mcp.json`. Paths use forward slashes; Node on Windows accepts them.

Re-run after pulling commits that change `mcp/discord-fleet/package-lock.json`. No postinstall hooks ship in this repo — bootstrap is an explicit operator step (never silent RCE).

**Upgrading from 0.3.32 or older (BREAKING):**

- The MCP server names `discord-fleet-status` and `discord-fleet-manage` are replaced by one server, `discord-fleet`. Tool names are unchanged, but anything keyed to the old **server** names must be updated: MCP allowlists, auto-approve / permission rules, and host prefixes (for example Cursor shows plugin servers as `plugin-<plugin>-<server>`, so `plugin-grokbot-discord-fleet-discord-fleet-manage` becomes `plugin-grokbot-discord-fleet-discord-fleet`).
- The old `mcp/status` and `mcp/manage` packages are gone. Hosts now launch the built `mcp/discord-fleet/dist/index.js`, which only exists after bootstrap (`npm ci --omit=dev` + `npm run build`). Run bootstrap once on every copy a host loads, then reload MCP servers (or restart the host).

## Plugin variables (marketplace-friendly)

Declared in `.grok-plugin/plugin.json`, root `plugin.json`, and `.cursor-plugin/plugin.json` as a JSON Schema `variables` object. MCP configs inject only the variables the `discord-fleet` server reads (`DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_BRIDGE_HEALTH_URL`, and `DISCORD_FLEET_READ_ONLY`) into its process environment. Callback variables remain manifest-declared for operator-driven skills/Bot Secrets; they are not passed to or read by the MCP server (least privilege) — **no secret values in the repo**.

| Name | Required | Who sets it | Purpose |
|------|----------|-------------|---------|
| `DISCORD_BOT_TOKEN` | **Yes** (required product input) | **Each installer — their own bot** | Required for Discord REST status/manage tools (identity, reads, posts, permissions, and moderation). Get it from the [Discord Developer Portal](https://discord.com/developers/applications). **Never commit.** |
| `DISCORD_GUILD_ID` | Optional | Your guild snowflake | Default guild for channel/guild status tools |
| `DISCORD_BRIDGE_HEALTH_URL` | Optional | Your self-hosted bridge | Full URL to **your** bridge `GET /healthz` (e.g. `http://127.0.0.1:18090/healthz`) |
| `DISCORD_FLEET_READ_ONLY` | Optional | You | Set to `1` (or `true` / `yes` / `on`) to hide every Discord write/moderation tool. Unset / empty / `0` / `false` / `no` / `off` = all tools; any other value also turns it **on** (fails closed, with a warning). See **[Read-only mode](#read-only-mode)** |
| `DISCORD_BRIDGE_CALLBACK_TOKEN` | Optional | The secret your bridge's Discord `callbackTokenRef` points at | Bearer for **your** bridge `POST /discord/callback` (agent self-callback / dual-deliver). Prefer Bot Secrets. **Never commit.** |
| `DISCORD_BRIDGE_CALLBACK_URL` | Optional | Your bridge callback | Full callback URL (placeholder `https://callback.example.com/discord/callback`). Never ship real operator hosts. |

### Marketplace installers

Follow **[Discord bot token & invite](#discord-bot-token--invite)** below for the full bot-create / invite / intent checklist, then:

1. Set plugin variable `DISCORD_BOT_TOKEN` (Plugins → Configure / host env injection — **prefer vault → runtime env** over plaintext `.env` on disk when avoidable).
2. Optionally set `DISCORD_GUILD_ID` and/or `DISCORD_BRIDGE_HEALTH_URL` (self-hosted bridge `/healthz` — skill `discord-fleet-bridge-setup`). Set `DISCORD_FLEET_READ_ONLY=1` if this install should only read (no post / moderation tools).
3. For wake **self-callback / dual-deliver**, file `DISCORD_BRIDGE_CALLBACK_TOKEN` + `DISCORD_BRIDGE_CALLBACK_URL` via skill `discord-fleet-callback-setup` (per-bot Secrets for multi-agent fleets).
4. **Wake on sleep (recommended)** — right after callback setup, run skill `discord-wake-on-sleep` so a bridge wake hook can wake a sleeping Grok Bot computer. Without it, Discord messages sent while the bot sleeps can red-X after the hold window. Skipping is allowed but not recommended. See **Wake on sleep (recommended)**.

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
   - **Optional self-hosted host bridge** (for example `grok-bot-universal-bridge`'s Discord adapter) — enable intents the bridge uses: **Message Content Intent** (privileged; required to read guild/DM message bodies for wake), plus non-privileged **Guilds**, **Guild Messages**, **Direct Messages** (DM wake) and **Guild Voice States** (non-privileged; the bridge requests it for its voice-channel play/stream features). See your host bridge's docs / skill `discord-fleet-bridge-setup`.
4. **Invite the bot to your guild** — Portal → OAuth2 → **URL Generator**: scope **`bot`**; select the permissions in **[Discord bot permissions](#discord-bot-permissions)** below (messaging minimum, plus moderation if you will use the timeout/kick/ban/delete/purge tools). Open the generated URL while logged into Discord, select **your** guild, authorize. **Creating a token does not grant channel access by itself** — see permissions section (role + channel overwrites).
5. **Optional plugin vars** — `DISCORD_GUILD_ID` (default guild snowflake for status/manage tools); `DISCORD_BRIDGE_HEALTH_URL` (full URL to **your** bridge `GET /healthz`, e.g. `http://127.0.0.1:18090/healthz`) when you self-host a bridge; `DISCORD_FLEET_READ_ONLY=1` to hide write/moderation tools.
6. **Optional dual-deliver / self-callback** (separate self-hosted bridge) — file **`DISCORD_BRIDGE_CALLBACK_TOKEN`** + **`DISCORD_BRIDGE_CALLBACK_URL`** via secret cards (skill `discord-fleet-callback-setup`). Callback path on the reference host bridge: `POST /discord/callback`. Auth is **header-only**: `Authorization: Bearer <token>` or header **`x-callback-token`**. Query `?token=` is **refused** (400 on the reference host bridge) — do not use. With no callback token configured on the bridge, the route answers **503** `callback_disabled`.
7. **Wake on sleep (recommended)** — after callback setup, run skill `discord-wake-on-sleep` (one webhook-triggered routine per Grok Bot account + the bridge wake hook, `wake.urlRef` / `wake.keyRef`). Grok Bot computers sleep when idle and Discord alone can't wake them; without this, messages sent while asleep can red-X after the hold window. Skipping is allowed but not recommended.
8. **Skills** — bot/bridge bring-up: `discord-fleet-bridge-setup`; callback secrets: `discord-fleet-callback-setup`; wake on sleep (recommended): `discord-wake-on-sleep`; wake decode (compact and legacy formats) / dual-deliver: `discord-bridge-dual-deliver` (a Discord wake loads only this skill); hop encode: `discord-fleet-hop-shorthand` (prefer `process.env.DISCORD_BRIDGE_CALLBACK_*` on each woken bot).

## Discord bot permissions

Token creation ≠ automatic access. The bot can only act where **(1)** the invite OAuth permission bits allow it, **(2)** the bot’s **role** (and any extra roles you assign) grant those bits in the guild, **(3)** **channel permission overwrites** do not deny View/Send/History (or Manage Messages) for the bot’s role, and **(4)** for member actions (timeout / kick / ban) the bot’s **highest role sits above** the target member’s highest role (Discord role hierarchy). Private channels still need an explicit allow / role invite into that channel.

### Messaging (status + post / history)

| Permission (URL Generator name) | Bit | Needed for |
|---------------------------------|-----|------------|
| **View Channel** (View Channels) | `1 << 10` (1024) | `inspect_guild`, `resolve_channel`, `list_channel_messages`, `post_channel_message`, wake bridge listen |
| **Send Messages** | `1 << 11` (2048) | `post_channel_message`; optional bridge callback replies |
| **Read Message History** | `1 << 16` (65536) | `list_channel_messages`, `purge_channel_messages` (fetch), history before post |
| **Attach Files** | `1 << 15` (32768) | Optional; bridge outbound attachments / rich replies |
| **Embed Links** | `1 << 14` (16384) | Optional; embeds in posts |

**Messaging-only permission integer** (View + Send + History + Attach + Embed): **`117760`**.

### Moderation (manage tools, 0.3.24+)

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
5. In the guild: **Server Settings → Roles** — drag the bot’s role **above** any roles you may timeout/kick/ban; confirm channel overwrites allow **View Channel** (and Send / History / Manage Messages as needed) in target channels. Use `check_bot_channel_permissions` (read-only, no confirm needed) to verify.

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
| `https://discord.com/api/v10/*` (Discord REST) | When `DISCORD_BOT_TOKEN` is set | Identity, guilds, channels; confirm-gated post / moderation via the manage tools |
| Bridge `GET /healthz` at `DISCORD_BRIDGE_HEALTH_URL` | Optional (your bridge) | Liveness probe (`{ok, adapters, held}` on the reference host bridge) — **not** wake / `sendPrompt` |

Confirm-gated Discord REST from the manage tools may post / moderate (unless read-only mode is on) when you call tools with `confirm=true`. No channel-map writes, no gateway listen, no wake / `sendPrompt` from this plugin.

## Plugin root path variables (honest)

| Host | MCP file | Plugin root placeholder |
|------|----------|-------------------------|
| **Grok Build** | `.mcp.json` | `${GROK_PLUGIN_ROOT}` — documented for plugin hooks as `GROK_PLUGIN_ROOT` / `GROK_PLUGIN_DATA`; used here for portable stdio `args`/`cwd` |
| **Cursor** | `mcp.json` | `${CURSOR_PLUGIN_ROOT}` — Cursor expands this for local plugins |
| Claude Code (compat) | (not dual-shipped here) | Would use `${CLAUDE_PLUGIN_ROOT}` in a `.claude-plugin` + `.mcp.json` layout |

Do **not** assume `${CURSOR_PLUGIN_ROOT}` works under Grok, or `${GROK_PLUGIN_ROOT}` under Cursor. Keep both MCP files if you need both hosts. Each file has one entry, `discord-fleet`.

## MCP server (`discord-fleet`)

One stdio server holds every tool (same pattern as single-server MCPs such as GitHub's). Tool names did not change from the old two-server layout (`discord-fleet-status` + `discord-fleet-manage`, 0.3.32 and older), so skills and prompts that call tools by name keep working; only the server name is now `discord-fleet`.

Read tools never need `confirm` and run in both modes. That includes `inspect_guild`, `resolve_channel`, `check_bot_channel_permissions`, and `list_channel_messages` (up to 50 recent messages per call), so any agent with this server can read whatever the bot token can see; scope the bot's channel access accordingly. The 7 write tools (post + moderation) always need `confirm=true` (dry-run preview without it). Unset plugin variables that a host passes through literally (for example `DISCORD_GUILD_ID=${DISCORD_GUILD_ID}`) and empty values are treated as unset.

### Read-only mode

Set plugin variable / env **`DISCORD_FLEET_READ_ONLY=1`** (also `true`, `yes`, `on`) to run the server read-only. The switch fails closed:

| Value | Mode |
|-------|------|
| unset, empty, or an unexpanded `${...}` placeholder | off (all tools) |
| `0`, `false`, `no`, `off` (any case) | off (all tools) |
| `1`, `true`, `yes`, `on` (any case) | **on** |
| anything else (e.g. `enabled`, `2`) | **on**, and the server writes one warning to stderr at start |

When on:

- `tools/list` hides every tool that can change Discord: `post_channel_message`, `timeout_member`, `kick_member`, `ban_member`, `unban_member`, `delete_message`, `purge_channel_messages`.
- Calling one of those names anyway is refused with `readOnly: true` and no Discord call.
- The 9 read tools stay available: `fleet_health`, `list_channel_map`, `describe_manage_boundary`, `plan_channel_binding`, `inspect_guild`, `resolve_channel`, `list_channel_messages`, `check_bot_channel_permissions`, `evaluate_bridge_bot_enable`. None of them need `confirm`, so read-only mode still lets the agent read guild metadata, roles, channels, permissions and message history (`list_channel_messages`, up to 50 messages per call, content truncated to 500 chars each). Read-only means "cannot change Discord", not "cannot read".
- `describe_manage_boundary` reports `readOnly: true|false` plus `readOnlyStatus`, which shows the actual flag value and how it was read, e.g. `read-only ON (DISCORD_FLEET_READ_ONLY="enabled", unrecognised value treated as ON)`, `read-only ON (DISCORD_FLEET_READ_ONLY="1")`, `read-only OFF (DISCORD_FLEET_READ_ONLY="off", explicit off value)` or `read-only OFF (DISCORD_FLEET_READ_ONLY unset: not set)`. It echoes only this flag, never other variables.

With read-only off (default), all 16 tools are listed and every write tool still needs `confirm=true`; without it you get a dry-run preview and nothing is sent. The setting is read when the server starts, so reload MCP servers (or restart the host) after changing it.

### Status tools

- `fleet_health` — probe bridge `/healthz` when `DISCORD_BRIDGE_HEALTH_URL` is set; Discord REST `GET /users/@me` + guilds when token is set
- `list_channel_map` — documented bridge channel-map schema + Discord guild channels when token + guild id are available

### Manage tools

- `describe_manage_boundary` — this plugin does **not** wake bots / call `sendPrompt`; lists read tools (no confirm) and confirm-gated write tools, and reports `readOnly`
- `plan_channel_binding` — dry-run draft row for bridge `channel-map.json` (no writes)
- `inspect_guild` — Discord REST guild/roles/channels snapshot; read-only, no confirm needed
- `resolve_channel` — Discord REST `GET /channels/{id}`; read-only, no confirm needed
- `list_channel_messages` — Discord REST recent messages (limit capped at 50); read-only, no confirm needed
- `post_channel_message` — Discord REST create message; dry-run without `confirm=true`; refuses empty content; returns message id
- `check_bot_channel_permissions` — computed bot View/Send/History/Manage Messages + Kick/Ban/Moderate flags; read-only, no confirm needed
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

Evaluation order (`bridgeBotRunsForSite` in `mcp/discord-fleet/src/bot-enable.ts`):

1. Read `botsEnabled`. If the flag is missing or not a boolean, treat it as on.
2. Read that site's `enabled` flag from the separate site store. A missing site is off.
3. The bridge bot runs for the site only when global is on **and** that site is on.

`setGlobalBotsEnabled` copies site rows unchanged. `setSiteEnabled` preserves `botsEnabled` exactly, including when it was omitted. The `evaluate_bridge_bot_enable` tool returns that result (no Discord call). Example:

```json
{
  "botsEnabled": true,
  "sites": [{ "siteId": "<site-id>", "enabled": true }]
}
```

## Install locations

Grok Build loads this plugin from `~/.grok/plugins/grokbot-discord-fleet` on the operator's machine. The Grok Bot desktop app does not read that directory. It keeps its own plugin copy. Every Fleet deploy must install the same commit in both places. Updating only Grok Build leaves the Grok Bot app on the older copy.

## Channel map example

The live map stays on the bridge host. This plugin does not ship it. On the reference host bridge the same binding is a Discord adapter route (`id`, `enabled`, `match: {guild, channel}` or `{dm: "true"}`, `allowActors`, optional `allowGroups`, `agent` = a registry alias, `requireAddressed`, `slug`, optional `handler: "local-planner"`); `plan_channel_binding` still drafts the older channel-map row below, so translate it field by field. Fields below `requireMention` are optional. Values are placeholders.

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

Agent ids for a real roster belong in the operator's host-only bridge registry, not in this repo. To wake or prompt a bot by name from Grok Build, Cursor or a script (not through Discord), use [grokbuild-grokbots](https://github.com/matthew-rutledge-dev/grokbuild-grokbots) and its roster file; its README is the single source for that setup.

## Bridge HTTP (reference — optional self-host)

From the reference host bridge ([grok-bot-universal-bridge](https://github.com/matthew-rutledge-dev/grok-bot-universal-bridge), Discord adapter README):

| Path | Method | Purpose |
|------|--------|---------|
| `/healthz` | GET | Liveness: `{ok, adapters, held}` (counts only; no Discord readiness field — check readiness on the host, e.g. its `--check` run) |
| `/discord/callback` | POST | Agent → Discord delivery (Bearer / `x-callback-token`, the secret behind the Discord adapter's `callbackTokenRef`) — agents self-callback using `DISCORD_BRIDGE_CALLBACK_*` (skill `discord-fleet-callback-setup`); this plugin's MCP does not call it |
| `/discord/voice/play`, `/discord/voice/stream` | POST | Optional voice features (off unless enabled on the bridge; same callback token) |

Typical self-host listens loopback-only (example `127.0.0.1:18090`). Point `DISCORD_BRIDGE_HEALTH_URL` at that URL (or a local SSH tunnel end). Behind a tunnel, route by path (`/discord/*`).

### Outbound media (`POST /discord/callback`)

Auth is **header-only**: `Authorization: Bearer <token>` or **`x-callback-token`**. No auth / wrong Bearer → **401**; `?token=` → **400**; no callback token configured on the bridge → **503** `callback_disabled`; over the soft rate limit → **429** with `retry-after`. Text-only bodies remain valid. This plugin never calls the callback; document for installers' own bridge.

### Local handler output

When a bridge hop hands work to a local handler instead of `sendPrompt`, the hop must pass:

- the real inbound Discord message id (the same id as `d:<slug>:<msgId>`), not a placeholder
- the bridge callback URL (`<publicBaseUrl>/discord/callback`, or `DISCORD_BRIDGE_CALLBACK_URL`)

On the reference host bridge, a route with `"handler": "local-planner"` does this: it posts one "Working on it." message and passes `messageId`, `callbackUrl` and `statusMessageId` to the planner; the callback then edits that message.

The handler POSTs the result (text and/or an image) to that URL. Auth is header-only: `Authorization: Bearer <token>` or `x-callback-token`. Do not put the callback token in the query string. Set `replyToMessageId` to the inbound message id and `channelId` to the hop's channel. A handler that is not given those two values can exit successfully and never post.

**JSON body**

| Field | Notes |
|-------|--------|
| `channelId` | Required (guild or DM channel snowflake) |
| `content` | Optional if ≥1 attachment (split at 2000 characters; max 8000) |
| `replyToMessageId` | Optional |
| `statusMessageId` | Optional; edit this bot message instead of posting |
| `threadContent` | Optional (max 6000); starts a "Planner log" thread on the reply |
| `attachments` | Optional, ≤10 items |

Each attachment is **either** base64 inline **or** an https URL (XOR — not both):

```json
{ "filename": "shot.png", "contentType": "image/png", "data": "<base64-no-data-url-prefix>" }
```

```json
{ "filename": "shot.png", "contentType": "image/png", "url": "https://cdn.example.com/shot.png" }
```

JSON only: the reference host bridge does not accept multipart/form-data callbacks. A `url` item must be https: the bridge fetches it with a 15 s timeout, follows at most 3 redirects by hand (each hop re-checked), and refuses private, loopback and link-local targets.

**Limits:** at most 10 files, 8 MiB per file, 25 MiB total, enforced while streaming (not only from `content-length`). **MIME allowlist (reference host bridge, Discord adapter):** `application/gzip`, `application/javascript`, `application/json`, `application/msword`, `application/pdf`, `application/rtf`, `application/tar`, `application/vnd.rar`, `application/vnd.ms-excel`, `application/vnd.ms-powerpoint`, `application/vnd.oasis.opendocument.presentation`, `application/vnd.oasis.opendocument.spreadsheet`, `application/vnd.oasis.opendocument.text`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/zip`, `application/x-7z-compressed`, `application/x-gzip`, `application/x-gtar`, `application/x-powershell`, `application/x-python`, `application/x-rar-compressed`, `application/x-sh`, `application/x-tar`, `application/x-yaml`, `application/xml`, `audio/mpeg`, `audio/ogg`, `audio/wav`, `image/gif`, `image/jpeg`, `image/png`, `image/webp`, `text/css`, `text/csv`, `text/html`, `text/javascript`, `text/markdown`, `text/plain`, `text/tab-separated-values`, `text/x-powershell`, `text/x-python`, `text/x-shellscript`, `text/xml`, `text/yaml`, `video/mp4`, `video/webm`. When `contentType` is missing or `application/octet-stream`, filename fallback also recognizes the existing media/PDF/text mappings plus `.md`, `.json`, `.xml`, `.yml`, `.yaml`, `.py`, `.ps1`, `.sh`, `.bash`, `.csv`, `.tsv`, `.html`, `.css`, `.js`, `.ts` (mapped to `text/plain`), `.docx`, `.xlsx`, `.pptx`, `.doc`, `.xls`, `.ppt`, `.odt`, `.ods`, `.odp`, `.rtf`, `.zip`, `.tar`, `.gz`, `.tgz`, `.7z`, and `.rar` (`.zip` → `application/zip`, `.tar` → `application/x-tar` / `application/tar`, `.gz` and `.tar.gz` → `application/gzip`, `.tgz` → `application/x-gtar`, `.7z` → `application/x-7z-compressed`, `.rar` → `application/vnd.rar` / `application/x-rar-compressed`). Filenames ending in `.exe`, `.msi`, `.dmg`, `.iso`, `.appimage`, `.bat`, `.cmd`, `.scr` or `.com` are refused whatever MIME type is claimed; any type outside the allowlist returns **415** `unsupported_media_type`.

**Error codes (bridge):** `channelId required`, `content_or_attachment_required`, `channel_not_allowlisted` (403), `unsupported_media_type` (415), `attachment_too_large`, `too_many_attachments`, `invalid_attachment`, `invalid_attachment_url` (400), `attachment_fetch_failed`, `discord_send_failed` (502).

### Bridge audit (host-side)

The reference host bridge writes a JSONL audit line per decision (inbound allow/deny, hold, retry, deliver, give_up, callback, attachment). Ids are masked to their last 4 characters, attachment lines carry only count, total bytes and kinds, and message text, URLs and keys are never written. These logs belong to the bridge host, not this marketplace MCP; agents should not invent timings.

Never put hop codes (`d:…`) or thin JSON into Discord replies — human text and/or allowed attachments only.

### Inbound media (wake)

On **your** bridge, inbound attachments are never downloaded by the bridge: up to 10 Discord CDN URLs go in the compact trailer as repeated `a=<url>` keys and in `sendPrompt` / webhook `metadata.attachments`. Older host bridges' legacy thin JSON after `d:<slug>:<msgId>` may include optional:

```json
"a": [{ "url": "https://cdn.discordapp.com/…", "filename": "shot.png", "contentType": "image/png", "size": 12345 }]
```

These are Discord CDN **URL refs** (not base64). The same refs may appear on `sendPrompt` `metadata.attachments`. Text-only wakes are unchanged; attachment-only wakes (no human text) are OK. **CDN URLs expire** — fetch promptly on the installer/operator side. This plugin does not own wake or perform the fetch.

### Direct messages (DMs)

Wake DMs are handled by **your** optional self-hosted bridge (not this plugin). Summary for installers:

1. **Inbound** — Bridge needs the `DirectMessages` intent. On the reference host bridge DMs match a route with `match: {"dm": "true"}` (off unless enabled) and its `allowActors` list (deny by default: an empty list allows nobody); `ignoreBots` applies.
2. **Agent** — The DM route's `agent` (a registry alias) receives the wake. Guild routes do **not** route DMs.
3. **Outbound** — Same `POST /discord/callback` as guild: `{channelId, content?, replyToMessageId?, attachments?}` with `channelId` = the trailer's `c` (the DM channel, which already passed the allowlist; the bridge remembers it across restarts). The reference host bridge has no `userId` (open-a-DM) callback. There is **no** separate `send_dm` MCP in this plugin.
4. **Hop** — Guild wakes use `d:<channel-slug>:<msgId>`; DMs use the same shape with the DM route's slug (usually `dm`); the compact trailer has no `g` (legacy thin JSON `g` is `null`); optional `a` for media. Strip `d:` + JSON from visible chat; Discord OUT is human text and/or allowed attachments — never hop codes. See skill `discord-bridge-dual-deliver`.

Marketplace installers edit **their** bridge's Discord routes (DM route `enabled`, `allowActors`, `agent`). Plugin variables are `DISCORD_BOT_TOKEN` / optional guild / health URL / optional callback token+URL — do not ship another operator's agent IDs, guild snowflakes, or real callback hosts as product defaults.

### Optional durable Cloudflare tunnel

Quick `trycloudflare.com` tunnels are temporary and stop when their `cloudflared` process stops. For durable self-hosted wake, use a named Cloudflare Tunnel with a supervised connector and your own public hostnames, for example:

```text
# host bridge config: http.publicBaseUrl (callback = <publicBaseUrl>/discord/callback)
https://callback.example.com
# registry entry deliver.urlRef → your Gateway sendPrompt / webhook endpoint
https://sendprompt.example.com
```

### Durable sendPrompt tunnel (Grok Bot computer)

The bridge reaches the Grok Bot computer's local sendPrompt port through a named Cloudflare Tunnel. Placeholders only; use your own names:

```bash
cloudflared tunnel login                                     # once, in your own browser
cloudflared tunnel create example-tunnel                     # writes credentials JSON under ~/.cloudflared/
cloudflared tunnel route dns example-tunnel sendprompt.example.com
cloudflared tunnel --protocol http2 run --url http://127.0.0.1:<sendprompt-port> example-tunnel
```

Use `--protocol http2` where UDP is blocked (QUIC won't connect). Keep the credentials JSON out of git and chat.

Keep that connector running with a supervisor and point the plugin scripts at it:

```bash
# <state-dir>/sendprompt-supervise.sh  (chmod +x; path must not contain spaces)
#!/usr/bin/env bash
exec 9>"${SENDPROMPT_STATE_DIR:-$HOME/.local/state/grokbot-sendprompt}/supervise.lock"
flock -n 9 || exit 0                                         # held lock = "supervisor up" for ensure
while true; do
  cloudflared tunnel --protocol http2 run --url http://127.0.0.1:<sendprompt-port> example-tunnel 9>&-
  sleep 5
done
```

```bash
export SENDPROMPT_TUNNEL_URL=https://sendprompt.example.com/
export SENDPROMPT_SUPERVISOR=<state-dir>/sendprompt-supervise.sh   # word-split: no spaces
export SENDPROMPT_CONNECTOR_MATCH=example-tunnel                    # substring of the connector cmdline
```

Then `scripts/ensure-sendprompt-tunnel.sh` starts the supervisor and watchdog if they're down (see **sendPrompt tunnel watchdog**). Run it from startup and from the wake routine.

Keep the bridge loopback-only behind the tunnel, rotate the callback token (the secret behind `callbackTokenRef`), and keep secrets in the host vault/runtime environment. The tunnel itself is yours to run (setup above); this plugin only ships the ensure/watchdog scripts. For `/healthz`, keep using the existing loopback binding and SSH tunnel workflow rather than exposing the bridge port.

## Bridge operator notes (generic)

- **User-Agent:** callbacks must send a non-default User-Agent (e.g. `grok-bot-bridge-client/1.0`). Default library UAs can be rejected at the edge with Cloudflare **1010** before reaching the bridge, so the bridge logs nothing.
- **DM replies:** send `channelId` = the trailer's `c` (the DM channel). Without a valid `channelId` the reference host bridge returns `400 channelId required`.
- **Wake hop JSON:** `c` (channel ID) is optional and may be present for DMs too; decoders must accept the hop with or without it.

| Symptom | Meaning |
|---|---|
| 1010 | Edge blocked the request (usually the User-Agent) |
| 401 | Bad or missing Bearer; the hop did reach the origin |
| 400 | `?token=` used, or no valid `channelId` |
| 404 | Wrong path (use `/discord/callback`) or the Discord adapter is off |
| 503 `callback_disabled` | No callback token configured on the bridge |
| 502 / 1033 (edge page) | The tunnel in front of the bridge host is down |

- **Tunnel connector:** it does not come back on its own after a host restart; run `scripts/ensure-sendprompt-tunnel.sh` from startup. On networks that block UDP, run the connector with `--protocol http2` (QUIC won't connect). The watchdog restarts the connector and checks the public URL.
- **Deploy:** keep the host-only files (bridge and adapter configs, `registry.json`, `.env`) in a sibling directory outside the checkout (e.g. `<repo>-host/`) so `git pull` and the Docker build context never touch them; back them up first and compare checksums after. Configs are bind-mounted read-only and owned by the service user. Script `docker compose run` / `exec` with `-T`. Never run `docker compose config` where logs are shared: it expands secrets.

## Wake on sleep (recommended)

Standard setup step, right after bridge setup and callback setup. **Why:** Grok Bot computers sleep a lot when idle, and Discord messages alone can't wake them. Without this step, messages sent while the bot is asleep can fail after the bridge's hold window (shown as a red X in Discord). Skipping is allowed but **not recommended**.

Bridge side: the reference host bridge's core wake hook (`wake.urlRef` / `wake.keyRef` / `wake.header` in its bridge config, example in [`config/bridge.example.json`](https://github.com/matthew-rutledge-dev/grok-bot-universal-bridge/blob/main/config/bridge.example.json); see its [design notes](https://github.com/matthew-rutledge-dev/grok-bot-universal-bridge/blob/main/docs/DESIGN.md), **Wake-on-sleep**, and the [Discord adapter README](https://github.com/matthew-rutledge-dev/grok-bot-universal-bridge/blob/main/adapters/discord/README.md), which also marks it recommended). `BRIDGE_WAKE_URL` / `BRIDGE_WAKE_KEY` in its `.env` are the default ref targets; leaving them blank turns the hook off.

Grok Bot boxes hibernate. While asleep the sendPrompt tunnel is down, so the bridge holds Discord messages and then red-Xes them after its hold window. The bridge's wake hook fixes this:

1. Delivery hits a retryable error (502/503/504/530, Cloudflare 1033, a timeout or a network error) and the message is held.
2. On the first hold of an outage the bridge POSTs **once** to a Grok Bot **webhook-triggered routine** (re-armed after a successful delivery or when nothing is held; a failed wake never drops the hold).
3. The routine wakes the box and runs `scripts/ensure-sendprompt-tunnel.sh`; the tunnel returns and held messages deliver.

Set up the routine with the `discord-wake-on-sleep` skill: **one routine per Grok Bot account** (all bots on an account share one box), reused if it already exists. Never commit the URL, the key, or a real automation folder id.

**One webhook routine can serve both** Discord wakes and GrokBuild prompts. If the bot already has a webhook routine from [grokbuild-grokbots](https://github.com/matthew-rutledge-dev/grokbuild-grokbots) (skill `grokbots-routine-setup`), you can append the wake step (`bash <absolute-plugin-root>/scripts/ensure-sendprompt-tunnel.sh` for bodies with no `kind`) to that routine's prompt instead of creating a second routine, and give the bridge the same URL and key. Follow the **Reuse path** in the `discord-wake-on-sleep` skill (step a): it still resolves the plugin root and sets `SENDPROMPT_TUNNEL_URL` from step b. GrokBuild bodies always carry `kind`; the bridge's wake body (`{reason, heldCount, firstHeldAt}`) doesn't. The caller-side GrokBuild setup (`GROKBOTS_*` variables, roster file) is documented only in that repo.

**Setup flow (least user work):**

1. The bot creates (or reuses) the routine. The routine panel has three fields: **POST URL**, **key**, and an **Authorization header** field.
2. The bot gives you deep links to each field, taken from the routine's line in its automation status: `grokbot://app/v1/sidebar?target=webhook-url&automation=<folder id>`, plus `target=webhook-key` and `target=webhook-header`. Fallback: click the bot's name in the chat header (or press Cmd+Shift+I) and pick the routine under **Routines**.
3. The bot asks for the **key** with a masked secret-request card. The value lands as a box env var (e.g. `BRIDGE_WAKE_KEY`); the bot never sees or prints it. You paste the **URL** in chat. It is not secret unless it embeds a token in its path; then treat it like the key.
4. The bot, or whoever owns the bridge server, writes both into the bridge `.env` (the env names its `wake.urlRef` / `wake.keyRef` point at, e.g. `BRIDGE_WAKE_URL` / `BRIDGE_WAKE_KEY`) with a script that reads the env var (no echo) and backs up `.env` first. Keep `hold.maxSec` at its default of 1800. The script writes **in place** (`cat new > .env`, not `mv`) so the inode, owner and mode survive single-file bind mounts and root-owned read-only perms. Then recreate the bridge container with `docker compose up -d` (`docker restart` and `docker compose restart` do not re-read `env_file`). Hand-editing `.env` is only a fallback.
5. The default header, `Authorization: Bearer <key>`, is verified. A successful wake POST returns HTTP 200 with JSON `{success:true, runUuid}`.

| Bridge config | Default | Meaning |
|---|---|---|
| `wake.urlRef` | unset (off) | `env:NAME` / `file:/abs/path` ref to the routine webhook URL (e.g. `env:BRIDGE_WAKE_URL`); literal values are refused |
| `wake.keyRef` | unset | Ref to the routine sender key (e.g. `env:BRIDGE_WAKE_KEY`); sent only in a header, never in the body |
| `wake.header` | `Authorization` | Header that carries the key. `Authorization` sends `Bearer <key>`; any other name sends the raw key (e.g. `X-Webhook-Key: <key>`). The default is verified against the Grok Bot routine webhook. |
| `wake.timeoutMs` | `5000` | Wake POST timeout |
| `hold.maxSec` | `1800` | How long the bridge holds messages before giving up |

POST body: `{reason, heldCount, firstHeldAt}` — no tokens, no message content.

On the Grok Bot computer: `SENDPROMPT_TUNNEL_URL` is **required**: `scripts/ensure-sendprompt-tunnel.sh` exits without it. Set it to the public URL of this computer's sendPrompt tunnel (e.g. `https://sendprompt.example.com/`) as a box env var / Bot Secret so the routine sees it. The routine prompt needs the **absolute** path to the plugin install; the desktop app keeps its own copy (see **Install locations**), so the skill resolves it once (`$GROK_PLUGIN_ROOT` or `find / -path '*/grokbot-discord-fleet/scripts/ensure-sendprompt-tunnel.sh'`) and writes it into the prompt.

**End-to-end check:** DM the bot and get a reply. Optional sleep test: let the computer idle or hibernate, send a message, and confirm the wake routine ran and the reply arrived within the hold window.

**Turn off:** blank `BRIDGE_WAKE_URL` / `BRIDGE_WAKE_KEY` (or remove `wake.urlRef`) and recreate the bridge container with `docker compose up -d` (`docker restart` and `docker compose restart` do not re-read `env_file`), or pause the routine.

**Troubleshooting**

- *Messages still red-X:* the box takes longer to wake + reconnect than `hold.maxSec`; keep it at least 1800, and check the routine actually ran.
- *Routine never runs:* a good wake POST returns HTTP 200 with JSON `{success:true, runUuid}`. If it doesn't, the wake URL/key is blank or mistyped, `wake.header` was changed from the default `Authorization` (unset it), or the routine is paused.
- *Fires only once:* expected — one POST per outage until a delivery succeeds or nothing is held.
- *Routine runs but tunnel stays down:* the ensure script can't find its tunnel URL / connector settings (`SENDPROMPT_TUNNEL_URL` is required and must be visible to the routine); check the `ensure-sendprompt-tunnel` status line and see **sendPrompt tunnel watchdog** below.
- *Duplicate routines:* delete extras; one per account is enough.

## Skills

- `discord-fleet-boundary` — always on for fleet work; manage/status vs wake path; **per-installer credentials, not shared provider**; points at callback token/URL + callback-setup for wake replies
- `discord-fleet-status` — health/status checks via the `discord-fleet` MCP status tools
- `discord-fleet-manage` — channel-binding plans, inspect + message history + bot channel perms (reads, no confirm), post / moderation (writes: dry-run without `confirm=true`; hidden in read-only mode) via the `discord-fleet` MCP
- `discord-fleet-bridge-setup` — **operator-driven** optional wake-bridge setup on an explicit ask (clone/deploy/verify `/healthz` on **your** host; never silent postinstall; never `curl|bash`; prefer plugin vars / vault→runtime env over plaintext `.env`). After the bridge is up, run `discord-fleet-callback-setup` for agent self-callback, then `discord-wake-on-sleep` (recommended). Skill includes short **Windows vs Linux** notes.
- `discord-fleet-callback-setup` — **first-class** operator-driven setup for durable `DISCORD_BRIDGE_CALLBACK_TOKEN` + `DISCORD_BRIDGE_CALLBACK_URL` (secure secret card; verify present/missing only; safe curl smoke; per-bot Secrets for multi-agent fleets). Not silent postinstall.
- `discord-wake-on-sleep` — **recommended** setup step right after callback setup: one webhook-triggered routine per Grok Bot account (idempotent) that runs `scripts/ensure-sendprompt-tunnel.sh` when the bridge wake hook fires; key collected by masked secret card (bot never sees it), URL pasted in chat, no-echo `.env` write
- `discord-bridge-dual-deliver` — the only skill a Discord wake loads (~2 KB): decode the compact wake (the reference host bridge's only format) and the legacy `d:<slug>:<msgId>` + thin JSON `{id,g,u,un?,dn?,lb?,c?,map,a?}` wake from older host bridges (`Discord DM from <label>: <text>` / `Discord #<channel> from <label>: <text>` + last-line trailer `⟂ d:<slug>:<msgId> u=… c=… …`), show only human content in Grok chat, then self-callback `POST /discord/callback` with `DISCORD_BRIDGE_CALLBACK_*`, `Authorization: Bearer` / `x-callback-token`, a non-default User-Agent, `channelId` = trailer `c` (guild and DM); short error table. Full envelope spec, MIME list, audit, setup and ops live in its `reference.md`, read only on errors or setup
- `discord-fleet-hop-shorthand` — encode only: pass `d:<slug>:<msgId>` (optional thin JSON) in agent-to-agent context; never in Discord or visible chat

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

## Secrets

No tokens in git. Marketplace users set **plugin variables** (or host env injection from their vault). Prefer vault → runtime env over leaving plaintext `.env` on disk when avoidable. Secrets remain in the installer's host vault or plugin variables.

## License

MIT — Copyright (c) 2026 Matthew Rutledge
