# Discord bridge dual-deliver — reference

Read this only on a callback error or during setup. The everyday wake path is in `SKILL.md`.

## Legacy wake format (`d:` first line, bridge 0.2.13 and `WAKE_PROMPT_FORMAT=legacy`)

The bridge mints the wake; agents decode it. Three lines, in order:

1. **Hop id:** `d:<slug>:<msgId>`. `slug` = guild channel-map short name (e.g. `example-chat`), or `dm` for DMs (or the bridge's `security.dm.slug`). `msgId` = Discord snowflake of the triggering message (used as `replyToMessageId`).
2. **Thin JSON:** `{id,g,u,un?,dn?,lb?,c?,map,a?}`
   - `id` — same hop code as line 1
   - `g` — guild id, or `null` for DMs
   - `u` — author user id
   - `un` / `dn` / `lb` — optional sender username, display name, and operator label from the bridge user directory (bridge 0.2.11+); readers must cope with any of them missing
   - `c` — optional Discord channel snowflake (DMs too); decoders must accept the hop with or without it
   - `map` — agent alias (guild: channel-map `alias`; DM: `security.dm.alias` or agent id)
   - `a` — optional Discord CDN attachment refs (not base64): `[{url, filename?, contentType?, size?}]`. The same refs may appear on `sendPrompt` `metadata.attachments`. CDN URLs expire — fetch promptly. Text-only wakes omit `a`.
3. **Human content:** cleaned Discord message text. May be empty for attachment-only wakes (then treat `a` as the ask).

Examples (placeholders only):

```text
d:example-chat:1234567890123456789
{"id":"d:example-chat:1234567890123456789","g":"1111111111111111111","u":"222222222222222222","map":"<your-agent-alias>","c":"3333333333333333333"}
hello from Discord
```

```text
d:example-chat:1234567890123456789
{"id":"d:example-chat:1234567890123456789","g":"1111111111111111111","u":"222222222222222222","map":"<your-agent-alias>","a":[{"url":"https://cdn.discordapp.com/attachments/111/222/shot.png","filename":"shot.png","contentType":"image/png","size":12345}]}
look at this
```

```text
d:dm:1234567890123456789
{"id":"d:dm:1234567890123456789","g":null,"u":"222222222222222222","un":"example-user","lb":"Example","map":"<your-dm-agent-alias-or-id>"}
hello from a DM
```

## Compact wake format (bridge 0.2.14+, default)

Bridge flag `WAKE_PROMPT_FORMAT=compact|legacy`, default `compact`. `legacy` is the exact 0.2.13 output above. Agents must parse both. Source of truth: the bridge README section **Inbound wake** and `parseWakeTrailer` in the bridge `src/wake-prompt.ts`.

**Visible header** (first line of the prompt):

- DM: `Discord DM from <label>[ (N attachment[s])]: <text>`
- Channel: `Discord #<channel>[ (N attachment[s])] from <label>: <text>`

The user text is everything between the header colon and the trailer, and may span lines (it may be empty for attachment-only wakes). `<label>` is for display only; `u` is the authority for who sent it.

**Trailer** (always the LAST line, after the user text):

```text
trailer = "⟂" SP "d:" slug ":" messageId *( SP key "=" value )
```

`⟂` is U+27C2; values contain no whitespace. Regex: `^⟂ d:(\S+):(\d+)((?: [a-z]+=\S*)*)$`. A trailer without `u` is not valid.

| Key | Meaning |
|---|---|
| `u` | Sender user id (always) — DM callback `userId` |
| `c` | Channel id (always, even for DMs) — callback `channelId` |
| `g` | Guild id (guild only; absent means DM) |
| `map` | Agent alias, percent-encoded — decode only this key |
| `a` | Discord CDN URL, as-is; repeated in order, max 10 |
| other | Ignore unknown keys |

Compact drops attachment `filename`, `contentType`, `size` and the `un`/`dn`/`lb` names; infer the type from the URL or the download.

**Mapping:** hop = `d:<slug>:<msgId>`, `replyToMessageId` = `msgId`, `u` → DM `userId`, `c` → `channelId`. Delivery is unchanged: post your own reply to `/callback` with the User-Agent and the env token, never paste the trailer, `d:` line or JSON into Discord, keep the `callback <status> attachments=N` evidence line.

Samples (placeholders only):

```text
Discord DM from Alice: can you check the build?
⟂ d:dm:1111111111111111111 u=222222222222222222 c=333333333333333333 map=example-agent
```

```text
Discord #general from Bob (1 attachment): what is in this photo?
⟂ d:general:1111111111111111112 u=444444444444444444 c=555555555555555555 g=666666666666666666 map=example-agent a=https://cdn.example.com/attachments/555555555555555555/777777777777777777/photo.png?ex=1&is=2&hm=abc
```

Legacy equivalent of the DM sample:

```text
d:dm:1111111111111111111
{"id":"d:dm:1111111111111111111","g":null,"u":"222222222222222222","map":"example-agent","un":"alice","dn":"Alice","lb":"Alice","c":"333333333333333333"}
can you check the build?
```

### Decode + absorb

1. If the last line matches the compact trailer regex, parse it (compact). Otherwise, if line 1 matches `d:<slug>:<msgId>`, treat it as the hop id (legacy).
2. Guild: expand `slug` via the operator's channel-map (`slug` → channel / agent binding). DM (`slug` usually `dm`, `g` null): no channel-map row; the agent comes from bridge `security.dm.defaultAgentId`. Prefer thin JSON `map` for alias context.
3. Keep `msgId` for reply targeting / threading.
4. Parse `g` / `u` / `un` / `dn` / `lb` / `c` / `map` / `a` (legacy JSON or compact trailer keys) into **internal context only**.
5. Use the human text as the ask (compact: after the header colon, up to the trailer); if empty and `a` is present, it is an attachment-only wake. Show inbound images after fetching `a` URLs when the ask needs them.
6. In the visible Grok chat, show **only** the human content — strip the `d:` line and the JSON, or the compact header prefix and trailer. Never re-echo hop fields into chat or Discord.
7. Complete the Discord callback; a Grok-chat reply is optional and never replaces it. If the callback cannot be completed, report the delivery failure rather than treating chat-only output as complete.

### Guild vs DM

| | Guild | DM |
|---|---|---|
| Slug | Channel-map `slug` | `dm`, or bridge `security.dm.slug` |
| `g` | Guild snowflake | `null` |
| Agent routing | Channel-map row `agentId` / `alias` | Bridge `security.dm.defaultAgentId` (channel-map does not apply; without it the bridge denies `dm_no_agent`) |
| Callback target | `channelId` | `userId` = `u` (bridge opens the DM for allowlisted users); a DM channel snowflake as `channelId` also works |

**Resolve the target:** guild → `channelId` from thin-JSON `c` or wake `metadata.discordChannelId` (the CDN path `/attachments/<channelId>/…` in `a[].url` is also the channel snowflake; else channel-map / metadata). DM → `userId` = `u` and omit `channelId` (a known DM channel snowflake as `channelId` also works) — do not stall asking peers for a DM channel snowflake. `replyToMessageId` = `msgId`.

## Callback contract

- URL: `DISCORD_BRIDGE_CALLBACK_URL` — full URL or base ending in `/callback`; normalize so the request hits `/callback`. Placeholder shape: `https://callback.example.com/callback`. Alternatively the bridge `CALLBACK_BASE_URL` + `CALLBACK_PATH`.
- Auth: header-only since bridge 0.2.4 — `Authorization: Bearer <token>` or `x-callback-token`. Query `?token=` is rejected (401). Token = `DISCORD_BRIDGE_CALLBACK_TOKEN` (same secret as the bridge `CALLBACK_TOKEN`). Never print it or paste it into chat.
- Do not use other Discord or wake tokens (e.g. a Discord bot token) — they will 401.
- User-Agent: send an explicit non-default one (e.g. `grok-bot-discord-bridge-client/1.0`). Default library UAs (Python urllib/requests, bare curl, etc.) can be rejected by Cloudflare's browser check with `HTTP 403 error code: 1010` before the bridge sees the request, so the bridge logs nothing. The operator may add a Cloudflare skip rule for `/callback`; keep sending the User-Agent anyway.
- JSON body: `{channelId? | userId?, content?, agentId?, replyToMessageId?, attachments?}`.
- Discord OUT is human text and/or allowed attachments only — never hop codes, thin JSON, raw CDN URLs or meta dumps (not in filenames either).
- This plugin's MCP never calls `/callback` and has no separate `send_dm`; DMs use the same `/callback`.

### Outbound attachments

- `attachments` ≤ 10; each item is XOR: `{filename, contentType?, data}` (base64, no data-URL prefix) **or** `{filename?, contentType?, url}` (https).
- `content` is optional when there is ≥ 1 attachment.
- Multipart: form fields `channelId` or `userId`, optional `content`, optional `replyToMessageId`, plus files as `files` / `files[]`.
- Limits: 8 MiB per file, 25 MiB total.
- MIME allowlist (bridge `48e6b699ef39273d23f4bf70b7a4299989b34f9e`): `application/gzip`, `application/javascript`, `application/json`, `application/msword`, `application/pdf`, `application/rtf`, `application/tar`, `application/vnd.rar`, `application/vnd.ms-excel`, `application/vnd.ms-powerpoint`, `application/vnd.oasis.opendocument.presentation`, `application/vnd.oasis.opendocument.spreadsheet`, `application/vnd.oasis.opendocument.text`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/zip`, `application/x-7z-compressed`, `application/x-gzip`, `application/x-gtar`, `application/x-powershell`, `application/x-python`, `application/x-rar-compressed`, `application/x-sh`, `application/x-tar`, `application/x-yaml`, `application/xml`, `audio/mpeg`, `audio/ogg`, `audio/wav`, `image/gif`, `image/jpeg`, `image/png`, `image/webp`, `text/css`, `text/csv`, `text/html`, `text/javascript`, `text/markdown`, `text/plain`, `text/tab-separated-values`, `text/x-powershell`, `text/x-python`, `text/x-shellscript`, `text/xml`, `text/yaml`, `video/mp4`, `video/webm`.
- When `contentType` is missing or `application/octet-stream`, the filename fallback also recognizes the existing media/PDF/text mappings plus `.md`, `.json`, `.xml`, `.yml`, `.yaml`, `.py`, `.ps1`, `.sh`, `.bash`, `.csv`, `.tsv`, `.html`, `.css`, `.js`, `.ts` (mapped to `text/plain`), `.docx`, `.xlsx`, `.pptx`, `.doc`, `.xls`, `.ppt`, `.odt`, `.ods`, `.odp`, `.rtf`, `.zip`, `.tar`, `.gz`, `.tgz`, `.7z`, and `.rar` (`.zip` → `application/zip`, `.tar` → `application/x-tar` / `application/tar`, `.gz` and `.tar.gz` → `application/gzip`, `.tgz` → `application/x-gtar`, `.7z` → `application/x-7z-compressed`, `.rar` → `application/vnd.rar` / `application/x-rar-compressed`).
- Archives/executables/disk images (`.exe`, `.msi`, `.dmg`, `.iso`, `.appimage`) are otherwise denied; unsupported values return **415**.

## Errors (full)

| Result | Meaning / fix |
|---|---|
| 403, body `error code: 1010` (Cloudflare text, not bridge JSON) | Missing/flagged User-Agent — retry once with an explicit User-Agent |
| 401 | Wrong or missing token, or `?token=` used; the request did reach the origin. Check `DISCORD_BRIDGE_CALLBACK_TOKEN` |
| 400 `channelId_required` | Neither `channelId` nor `userId` sent (e.g. a DM without `userId`) |
| 400 `content_or_attachment_required` | Empty `content` and no attachments |
| 403 `user_not_allowlisted` | DM `userId` is not on the bridge DM allowlist |
| 404 `dm_open_failed` | Bridge could not open the DM |
| 503 `discord_not_ready` | Bridge's Discord client not ready yet; retry later |
| 415 | Attachment MIME type not allowed |
| 502 / 1033 | sendPrompt tunnel is down (bridge host; see skill `discord-wake-on-sleep` and the README tunnel sections) |

If it still fails after one retry, report the delivery failure to the bridge operator — do not fall back to another agent or Discord REST.

## Local handler output

If the bridge hop starts a local handler instead of `sendPrompt`, that handler still has to post back. The hop must pass the real inbound Discord message id and the callback URL (`DISCORD_BRIDGE_CALLBACK_URL`, or the bridge `CALLBACK_BASE_URL` + `CALLBACK_PATH`). The handler POSTs the image or text to that URL with `Authorization: Bearer <token>` or `x-callback-token` (never in the query string) and sets `replyToMessageId` to the inbound message id. Without the real message id and callback URL, the handler can finish and never post.

## Encode (agent-to-agent context)

When handing hop context to another agent or storing callback correlation, use `d:<slug>:<msgId>`, optionally with the thin JSON `{id,g,u,map,a?}` — in agent-to-agent context only, never in Discord `content` or attachment filenames.

## Hop timing (bridge host owns it)

The bridge may emit one host-log `[timing] key=val …` line per stage: `authz`, `build_wake`, `sendPrompt`, `callback_auth`, `callback_resolve`, `callback_deliver`, `callback_total`. Fields include `stage`, `msg`, `hop=d:<slug>:<id>`, `ms`, `ok`, `attachments`, `chunks`, and optional `idle_ms` (from `sendPrompt` acceptance to callback via `replyToMessageId`). Timing lines contain no tokens or content. These lines belong to the bridge host, not the marketplace MCP; agents do not invent timings. Keep the evidence line `callback <status> attachments=N` when available.

## Setup

- File `DISCORD_BRIDGE_CALLBACK_TOKEN` + `DISCORD_BRIDGE_CALLBACK_URL` as Bot Secrets / plugin variables via skill `discord-fleet-callback-setup` (durable env; no host-vault hop required). A host-vault copy of the callback token is an optional legacy fallback only when env is missing.
- Multi-agent fleets: plugin variables only feed MCP on the installing machine. Every agent that receives Discord wakes needs the same Bot Secrets.
- If the token cannot be loaded from env, say so once and tell the bridge operator.

## Ops notes (generic)

- The bridge is the operator's self-hosted wake host. Media contract tip: bridge `48e6b699ef39273d23f4bf70b7a4299989b34f9e`.
- Keep any other Discord gateway client off while the bridge owns the mapped Discord bot.
- Plugin-docs maintainers do not do live Discord delivery for mapped agents; each agent self-delivers.
- Bridge-side operator notes (tunnel connector restarts, `--protocol http2` where UDP is blocked, deploy hygiene for `security.json` / `channel-map.json` / `.env`, never `docker compose config` in shared logs): see the plugin README **Bridge operator notes (generic)**.
- Bridge source of truth: `matthew-rutledge-dev/grok-bot-discord-bridge` (mint path; callback = `content` and/or allowed attachments).
