---
name: discord-fleet-bridge-setup
description: use this when the user explicitly asks to set up, deploy, or verify the Discord wake bridge (operator-driven; not silent postinstall)
---

# Discord fleet bridge setup

## When to use

Only when the user **explicitly** asks to set up, deploy, or verify the Discord wake bridge. This plugin is **not** the wake path — do not run this skill on marketplace install, postinstall, or as a silent side effect.

**Optional self-host:** Marketplace installers who want wake run the bridge on **their own** machine / guild with **their own** bot token. They use their own Discord and infrastructure. Skip this skill entirely if they only need Discord REST status/manage via plugin variables.

## Discord bot first

Need a bot token / guild invite / intents? Use the plugin README **Discord bot token & invite** checklist (Developer Portal → `DISCORD_BOT_TOKEN` → Message Content for wake → OAuth2 invite). This skill assumes you already have **your** bot token and (for wake) Portal intents enabled.

## Hard rules (anti-jobs)

- Do **not** merge wake into marketplace postinstall or any install hook.
- Do **not** use `curl | bash` or any third-party delivery pipe.
- Do **not** put secrets in git, chat logs, or this plugin tree. Never print tokens.
- Do **not** invent wake / `sendPrompt` calls from this plugin's MCP tools.
- Prefer **plugin variables** / vault → runtime env for `DISCORD_BOT_TOKEN` (and related). Discourage plaintext `.env` on disk when a vault or host secret injection path exists; if a local `.env` is unavoidable for the bridge process, keep it off git, mode-restricted, and never echo values.

## Credentials model

| Audience | How secrets are supplied |
|----------|--------------------------|
| **Marketplace installer** | Plugin variables (`DISCORD_BOT_TOKEN`, optional `DISCORD_GUILD_ID`, optional `DISCORD_BRIDGE_HEALTH_URL`, optional `DISCORD_BRIDGE_CALLBACK_TOKEN` / `DISCORD_BRIDGE_CALLBACK_URL`) pointing at **their** bot / **their** self-hosted `/healthz` and `/callback`. |
| **Self-hosted operator** | The installer's host vault or plugin variables → runtime env on the installer's wake host. Not a shared provider. |

## Windows vs Linux (operators)

| Topic | Notes |
|-------|--------|
| Env / plugin vars | Same names on both: `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_BRIDGE_HEALTH_URL`, `DISCORD_BRIDGE_CALLBACK_TOKEN`, `DISCORD_BRIDGE_CALLBACK_URL` (plugin vars or vault→env — never commit). |
| Health URL | Self-hosted bridge typically listens loopback-only (e.g. `http://127.0.0.1:18083/healthz`). From another machine, open an **SSH tunnel** (or WSL → SSH), then set `DISCORD_BRIDGE_HEALTH_URL` to the local tunnel end. Example: `ssh -L 18083:127.0.0.1:18083 user@your-host`. |
| Deploy path | Use **your own** deploy path on **your** machine; do not point marketplace installers at another operator's host. |
| Windows local | Fine for **local smoke** of this plugin's MCP/skills and optional local bridge. Prefer plugin vars over plaintext `.env` when avoidable. |
| Delivery | Never `curl \| bash` or third-party install pipes. No secrets in git, chat, or this tree. |

## Optional durable Cloudflare tunnel (self-hosted wake)

`trycloudflare.com` quick tunnels are temporary: they end when the `cloudflared` process stops. For a durable optional self-hosted wake path, use a named Cloudflare Tunnel and run its connector under a supervisor so it survives restarts. Publish the callback and gateway routes with placeholder hostnames such as:

- `CALLBACK_BASE_URL=https://callback.example.com` — the public callback origin for the bridge/gateway.
- `GROK_BOT_SENDPROMPT_URL=https://sendprompt.example.com` — the user's own gateway endpoint that accepts `sendPrompt`.

Keep the bridge bound to loopback (`127.0.0.1`) and route the named tunnel to it; do not expose the bridge port directly. Rotate `CALLBACK_TOKEN` whenever the callback is deployed, shared, or suspected exposed, and supply it through the host vault/runtime environment — never commit or print it. These routes are optional self-host configuration, not endpoints provided by this plugin.

## Hop timing (optional bridge telemetry)

A self-hosted bridge may emit one host-log `[timing] key=val …` line per hop stage for latency diagnosis: `authz`, `build_wake`, `sendPrompt`, `callback_auth`, `callback_resolve`, `callback_deliver`, and `callback_total`. Fields include `stage`, `msg`, `hop=d:<slug>:<id>`, `ms`, `ok`, `attachments`, `chunks`, and optional `idle_ms` (from `sendPrompt` acceptance to callback via `replyToMessageId`). Lines contain no tokens or content. This is host-side telemetry, not output from the marketplace MCP; agents must not invent timing values. Callback caps/MIME remain unchanged.

## Direct messages (DMs) on your bridge

This plugin does **not** own wake. If you self-host the bridge and want DMs:

| Setting | Purpose |
|---------|---------|
| Gateway intent | Bridge enables `DirectMessages` (see bridge README) |
| `security.dm.policy` | `pairing` \| `allowlist` \| `disabled` (env override `DISCORD_DM_POLICY`) |
| `security.dm.allowFrom` | User snowflakes allowed without pairing (plus env allowlists) |
| Owner `!pair <userId>` | Under `pairing`, owner approves a user (in-memory for process lifetime on current bridge) |
| `ignoreBots` | Bot authors are ignored |
| `security.dm.defaultAgentId` | **Required** for DMs — missing → deny `dm_no_agent`. Guild `channel-map.json` rows do **not** apply to DMs |

**Outbound replies:** agents use the same bridge `POST /callback` as guild traffic. Prefer **Bearer** or **`x-callback-token`** headers (query `?token=` is being removed on the bridge next release). Text-only bodies remain valid.

```json
{
  "channelId": "<DM or guild channel snowflake>",
  "content": "<plain reply; optional if attachments present>",
  "agentId": "<optional>",
  "replyToMessageId": "<optional triggering message id>",
  "attachments": [
    { "filename": "shot.png", "contentType": "image/png", "data": "<base64-no-data-url-prefix>" }
  ]
}
```

Attachment items are XOR: `{filename, contentType?, data}` (base64, no data-URL prefix) **or** `{filename?, contentType?, url}` (https). Max **10** attachments; **8 MiB**/file, **25 MiB** total. **MIME allowlist (bridge `48e6b699ef39273d23f4bf70b7a4299989b34f9e`):** `application/gzip`, `application/javascript`, `application/json`, `application/msword`, `application/pdf`, `application/rtf`, `application/tar`, `application/vnd.rar`, `application/vnd.ms-excel`, `application/vnd.ms-powerpoint`, `application/vnd.oasis.opendocument.presentation`, `application/vnd.oasis.opendocument.spreadsheet`, `application/vnd.oasis.opendocument.text`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/zip`, `application/x-7z-compressed`, `application/x-gzip`, `application/x-gtar`, `application/x-powershell`, `application/x-python`, `application/x-rar-compressed`, `application/x-sh`, `application/x-tar`, `application/x-yaml`, `application/xml`, `audio/mpeg`, `audio/ogg`, `audio/wav`, `image/gif`, `image/jpeg`, `image/png`, `image/webp`, `text/css`, `text/csv`, `text/html`, `text/javascript`, `text/markdown`, `text/plain`, `text/tab-separated-values`, `text/x-powershell`, `text/x-python`, `text/x-shellscript`, `text/xml`, `text/yaml`, `video/mp4`, `video/webm`. When `contentType` is missing or `application/octet-stream`, filename fallback also recognizes the existing media/PDF/text mappings plus `.md`, `.json`, `.xml`, `.yml`, `.yaml`, `.py`, `.ps1`, `.sh`, `.bash`, `.csv`, `.tsv`, `.html`, `.css`, `.js`, `.ts` (mapped to `text/plain`), `.docx`, `.xlsx`, `.pptx`, `.doc`, `.xls`, `.ppt`, `.odt`, `.ods`, `.odp`, `.rtf`, `.zip`, `.tar`, `.gz`, `.tgz`, `.7z`, and `.rar` (`.zip` → `application/zip`, `.tar` → `application/x-tar` / `application/tar`, `.gz` and `.tar.gz` → `application/gzip`, `.tgz` → `application/x-gtar`, `.7z` → `application/x-7z-compressed`, `.rar` → `application/vnd.rar` / `application/x-rar-compressed`). Archives/executables/disk images (`.exe`, `.msi`, `.dmg`, `.iso`, `.appimage`) are otherwise denied; unsupported values return **415**. Multipart alternative: form fields `channelId` / `content?` / `replyToMessageId?` plus `files` / `files[]`. Bridge error codes include `content_or_attachment_required`, `attachment_too_large`, `too_many_attachments`, `unsupported_media_type`, `attachment_fetch_failed`.

Discord DMs are channels; there is **no** `send_dm` tool in this plugin. Use placeholders for agent ids / guild snowflakes in docs and examples — each installer configures **their** bridge.

**Hop for DMs:** same three-line wake as guild; slug defaults to `dm` (or `security.dm.slug`); thin JSON `g` is `null`; optional `a:` CDN attachment refs. See skill `discord-fleet-hop-shorthand`.

## How

1. **Confirm intent + host** — Ask which host (marketplace: **their** machine) and proceed only after explicit yes for that host. Clarify they will use **their own** Discord bot / guild.
2. **Clone / pull the bridge** — Repo: `matthew-rutledge-dev/grok-bot-discord-bridge`. On the target host, clone or `git pull` into the agreed path. Follow that repo's README — not this plugin.
3. **Env: prefer plugin vars / vault → runtime** — Load bot token and related secrets from plugin variables or the host vault injection into process env. Discourage writing a long-lived plaintext `.env` when avoidable. If the bridge docs require a host `.env`, use `.env.example` names only; never commit real `.env` or echo secret values.
4. **Deploy / run** — Start or update per bridge README (Compose / process on **their** host). Keep service stopped until a real token is configured if the bridge docs say so.
5. **Verify health** — Bridge HTTP is usually loopback-only. On the host: `GET http://127.0.0.1:18083/healthz` (or the port in bridge docs). From a laptop, open an SSH tunnel first, then probe the tunneled URL. Expect liveness / `discordReady` fields from bridge docs — treat missing token or stopped Compose as evidence, not failure to invent.
6. **Point the plugin at health** — Set plugin variable / env `DISCORD_BRIDGE_HEALTH_URL` to the full `/healthz` URL. Status MCP can then probe; still no wake from this plugin. Inbound wakes are exactly `d:<slug>:<msgId>` (DMs: slug default `dm`, `g` null), thin JSON `{id,g,u,map}` with optional `a:` CDN refs, then human content (attachment-only OK); see skill `discord-fleet-hop-shorthand` for bot-side decode — never put hop codes in Discord replies; fetch CDN URLs promptly. Outbound `/callback` may include `attachments` or multipart files (limits/MIME above). If enabling DMs, set **your** `security.dm.defaultAgentId` + policy/allowFrom on the bridge.
7. **Ownership** — Marketplace: user owns their bridge, guild, credentials, and deploy path; do not take over another operator's host from this plugin.

## Evidence expected

- Explicit user confirmation of host + setup intent (and that credentials are **theirs**)
- Bridge clone/pull path used
- Health probe result for `GET /healthz` (or clear note that service/token/tunnel is missing)
- Confirmation that `DISCORD_BRIDGE_HEALTH_URL` was set (value may be shown; **never** the bot token)
- Note on credential path used (plugin vars / vault→env vs unavoidable local `.env` — without printing secrets)

## After the bridge is up — callback setup (required for agent self-callback)

Wake dual-deliver needs agents to `POST /callback` themselves. After health verifies, run skill **`discord-fleet-callback-setup`** so the installer files durable Bot Secrets / plugin vars `DISCORD_BRIDGE_CALLBACK_TOKEN` and `DISCORD_BRIDGE_CALLBACK_URL` (no host vault hop). This is a first-class setup step, not docs-only. For multi-agent fleets, each mapped agent needs the same Secrets.

## Related

- **Plugin MCP deps (if you also cloned this plugin):** run `./scripts/bootstrap-mcp.sh` (Windows: `.\scripts\bootstrap-mcp.ps1`) in the plugin root before status/manage MCP will load — separate from bridge `npm ci`.

- Boundary: skill `discord-fleet-boundary`
- After setup: skill `discord-fleet-status` + status MCP `fleet_health`
- **Required for self-callback:** skill `discord-fleet-callback-setup`
- Wake hop encode/decode: inbound is exactly `d:<slug>:<msgId>` (DM slug default `dm`; `g` may be `null`), thin JSON `{id,g,u,map,a?}`, then human content; skill `discord-fleet-hop-shorthand` — Discord OUT is human text and/or allowed `/callback` attachments (same `/callback` for DM `channelId`)
- Bridge SoT: [matthew-rutledge-dev/grok-bot-discord-bridge](https://github.com/matthew-rutledge-dev/grok-bot-discord-bridge)
