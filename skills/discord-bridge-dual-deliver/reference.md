# Discord bridge dual-deliver — reference

Read this only on a callback error or during setup. The everyday wake path is in `SKILL.md`.

## Legacy wake format (`d:` first line, older host bridges)

The host bridge mints the wake; agents decode it. The reference host bridge (`grok-bot-universal-bridge`, Discord adapter) sends only the compact format below; keep this decoder for older host bridges. Three lines, in order:

1. **Hop id:** `d:<slug>:<msgId>`. `slug` = the route's short name (e.g. `example-chat`), or `dm` for DMs. `msgId` = Discord snowflake of the triggering message (used as `replyToMessageId`).
2. **Thin JSON:** `{id,g,u,un?,dn?,lb?,c?,map,a?}`
   - `id` — same hop code as line 1
   - `g` — guild id, or `null` for DMs
   - `u` — author user id
   - `un` / `dn` / `lb` — optional sender username, display name, and operator label from the bridge user directory; readers must cope with any of them missing
   - `c` — optional Discord channel snowflake (DMs too); decoders must accept the hop with or without it
   - `map` — agent alias (the route's agent)
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

## Compact wake format (default)

The reference host bridge sends only this format; older host bridges may send either. Agents must parse both. Source of truth: the reference host bridge's Discord adapter README (**Prompt**) and `formatPrompt` in its `adapters/discord/format.ts`.

**Visible header** (first line of the prompt):

- DM: `Discord DM from <label>[ (N attachment[s])]: <text>`
- Channel: `Discord #<channel> from <label>[ (N attachment[s])]: <text>`

An attachment-only message has no ` <text>` after the colon.

The user text is everything between the header colon and the trailer, and may span lines (it may be empty for attachment-only wakes). `<label>` is for display only; `u` is the authority for who sent it.

**Trailer** (always the LAST line, after the user text):

```text
trailer = "⟂" SP "d:" slug ":" messageId *( SP key "=" value )
```

`⟂` is U+27C2; values contain no whitespace. Regex: `^⟂ d:(\S+):(\d+)((?: [a-z]+=\S*)*)$`. A trailer without `u` is not valid.

| Key | Meaning |
|---|---|
| `u` | Sender user id (always) |
| `c` | Channel id (always, even for DMs) — callback `channelId` |
| `g` | Guild id (guild only; absent means DM) |
| `map` | Agent alias, percent-encoded — decode only this key |
| `a` | Discord CDN URL, as-is; repeated in order, max 10 |
| other | Ignore unknown keys |

Compact drops attachment `filename`, `contentType`, `size` and the `un`/`dn`/`lb` names; infer the type from the URL or the download.

**Mapping:** hop = `d:<slug>:<msgId>`, `replyToMessageId` = `msgId`, `c` → `channelId` (guild and DM). Delivery is unchanged: post your own reply to the callback URL with the User-Agent and the env token, never paste the trailer, `d:` line or JSON into Discord, keep the `callback <status> attachments=N` evidence line.

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
2. `slug` names the host bridge route that matched (guild channel route, or the DM route, usually `dm`, with `g` absent/null). Prefer `map` for alias context.
3. Keep `msgId` for reply targeting / threading.
4. Parse `g` / `u` / `un` / `dn` / `lb` / `c` / `map` / `a` (legacy JSON or compact trailer keys) into **internal context only**.
5. Use the human text as the ask (compact: after the header colon, up to the trailer); if empty and `a` is present, it is an attachment-only wake. Show inbound images after fetching `a` URLs when the ask needs them.
6. In the visible Grok chat, show **only** the human content — strip the `d:` line and the JSON, or the compact header prefix and trailer. Never re-echo hop fields into chat or Discord.
7. Complete the Discord callback; a Grok-chat reply is optional and never replaces it. If the callback cannot be completed, report the delivery failure rather than treating chat-only output as complete.

### Guild vs DM

| | Guild | DM |
|---|---|---|
| Slug | Route `slug` | `dm` (the DM route's `slug`) |
| `g` | Guild snowflake | absent (compact) / `null` (legacy) |
| Agent routing | Route `match: {guild, channel}` + `allowActors` → route `agent` (registry alias) | Route `match: {dm: "true"}` + `allowActors` → route `agent` |
| Callback target | `channelId` = `c` | `channelId` = `c` (the DM channel; it passed the allowlist on the way in) |

**Resolve the target:** `channelId` = trailer `c` (legacy: thin-JSON `c`, else wake `metadata`; the CDN path `/attachments/<channelId>/…` in an `a` URL is also the channel snowflake). The reference host bridge has no `userId` (open-a-DM) callback: a DM reply goes to the DM channel id `c`. Do not stall asking peers for a channel snowflake. `replyToMessageId` = `msgId`.

## Callback contract

- URL: `DISCORD_BRIDGE_CALLBACK_URL` — the full callback URL. On the reference host bridge the path is `/discord/callback` (`<publicBaseUrl>/discord/callback`); if only a base URL is stored, append `/discord/callback`. Placeholder shape: `https://callback.example.com/discord/callback`.
- Auth: header-only — `Authorization: Bearer <token>` or `x-callback-token`. A `?token=` query is refused (reference host bridge: 400; older bridges: 401). Token = `DISCORD_BRIDGE_CALLBACK_TOKEN` (the same secret the Discord adapter's `callbackTokenRef` points at). If the bridge has no callback token configured, the route answers 503 `callback_disabled` (fail-closed). Callbacks are soft rate-limited (429 with `retry-after`). Never print the token or paste it into chat.
- Do not use other Discord or wake tokens (e.g. a Discord bot token) — they will 401.
- User-Agent: send an explicit non-default one (e.g. `grok-bot-bridge-client/1.0`). Default library UAs (Python urllib/requests, bare curl, etc.) can be rejected by Cloudflare's browser check with `HTTP 403 error code: 1010` before the bridge sees the request, so the bridge logs nothing. The operator may add a Cloudflare skip rule for the callback path; keep sending the User-Agent anyway.
- JSON body: `{channelId, content?, replyToMessageId?, statusMessageId?, threadContent?, attachments?}`. `channelId` is required (guild or DM channel); `content` or `attachments` is required. `statusMessageId` edits that bot message instead of posting; `threadContent` (max 6000) starts a "Planner log" thread on the reply. `content` over 2000 characters is split (max 8000). The target channel must be in an enabled route, or be a DM channel that already passed the allowlist.
- Discord OUT is human text and/or allowed attachments only — never hop codes, thin JSON, raw CDN URLs or meta dumps (not in filenames either).
- This plugin's MCP never calls the callback and has no separate `send_dm`; DMs use the same callback with the DM `channelId`.

### Outbound attachments

- `attachments` ≤ 10; each item is XOR: `{filename, contentType?, data}` (base64, no data-URL prefix) **or** `{filename?, contentType?, url}` (https).
- `content` is optional when there is ≥ 1 attachment.
- JSON only: the reference host bridge does not accept multipart/form-data callbacks.
- **Limits:** at most 10 files, 8 MiB per file, 25 MiB total, enforced while streaming (not only from `content-length`).
- A `url` item must be https: the bridge fetches it with a 15 s timeout, follows at most 3 redirects by hand (each hop re-checked), and refuses private, loopback and link-local targets.
- MIME allowlist (reference host bridge, Discord adapter): `application/gzip`, `application/javascript`, `application/json`, `application/msword`, `application/pdf`, `application/rtf`, `application/tar`, `application/vnd.rar`, `application/vnd.ms-excel`, `application/vnd.ms-powerpoint`, `application/vnd.oasis.opendocument.presentation`, `application/vnd.oasis.opendocument.spreadsheet`, `application/vnd.oasis.opendocument.text`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/zip`, `application/x-7z-compressed`, `application/x-gzip`, `application/x-gtar`, `application/x-powershell`, `application/x-python`, `application/x-rar-compressed`, `application/x-sh`, `application/x-tar`, `application/x-yaml`, `application/xml`, `audio/mpeg`, `audio/ogg`, `audio/wav`, `image/gif`, `image/jpeg`, `image/png`, `image/webp`, `text/css`, `text/csv`, `text/html`, `text/javascript`, `text/markdown`, `text/plain`, `text/tab-separated-values`, `text/x-powershell`, `text/x-python`, `text/x-shellscript`, `text/xml`, `text/yaml`, `video/mp4`, `video/webm`.
- When `contentType` is missing or `application/octet-stream`, the filename fallback also recognizes the existing media/PDF/text mappings plus `.md`, `.json`, `.xml`, `.yml`, `.yaml`, `.py`, `.ps1`, `.sh`, `.bash`, `.csv`, `.tsv`, `.html`, `.css`, `.js`, `.ts` (mapped to `text/plain`), `.docx`, `.xlsx`, `.pptx`, `.doc`, `.xls`, `.ppt`, `.odt`, `.ods`, `.odp`, `.rtf`, `.zip`, `.tar`, `.gz`, `.tgz`, `.7z`, and `.rar` (`.zip` → `application/zip`, `.tar` → `application/x-tar`, `.gz` → `application/gzip`, `.tgz` → `application/x-gtar`, `.7z` → `application/x-7z-compressed`, `.rar` → `application/vnd.rar`).
- Filenames ending in `.exe`, `.msi`, `.dmg`, `.iso`, `.appimage`, `.bat`, `.cmd`, `.scr` or `.com` are refused whatever MIME type is claimed; any type outside the allowlist returns **415** `unsupported_media_type`.

## Errors (full)

| Result | Meaning / fix |
|---|---|
| 403, body `error code: 1010` (Cloudflare text, not bridge JSON) | Missing/flagged User-Agent — retry once with an explicit User-Agent |
| 401 `unauthorized` | Wrong or missing token; the request did reach the origin. Check `DISCORD_BRIDGE_CALLBACK_TOKEN` |
| 400 `use the Authorization header, not ?token=` | Token sent in the query string; move it to the header |
| 503 `callback_disabled` | The bridge has no callback token configured; tell the bridge operator |
| 429 `rate_limited` | Wait `retry-after` seconds, then retry once |
| 404 `not_found` | Wrong path (use `/discord/callback`), or the bridge's Discord adapter is off |
| 400 `channelId required` | No valid `channelId` (DMs too: use trailer `c`) |
| 400 `content_or_attachment_required` | Empty `content` and no attachments |
| 413 `content too long (max 8000)` | Shorten `content` or send a file |
| 403 `channel_not_allowlisted` | Target channel is not in an enabled route and is not an allowlisted DM channel; reply to the wake's own `c` |
| 415 `unsupported_media_type` | Attachment MIME type or extension not allowed |
| 400 `attachment_too_large` / `too_many_attachments` / `invalid_attachment` / `invalid_attachment_url` | Over the caps, bad base64/shape, or a non-https / private `url` |
| 502 `attachment_fetch_failed` | The bridge could not fetch a `url` attachment |
| 502 `discord_send_failed` | Discord rejected the send; retry once later |
| 502 / 1033 (edge page, not bridge JSON) | The tunnel in front of the bridge host is down (bridge host; see the README tunnel sections) |

If it still fails after one retry, report the delivery failure to the bridge operator — do not fall back to another agent or Discord REST.

## Local handler output

If the bridge hop starts a local handler instead of waking the agent, that handler still has to post back. On the reference host bridge a route with `"handler": "local-planner"` does this: it replies once with "Working on it.", then calls the planner with the real inbound Discord message id (`messageId`), the callback URL (`callbackUrl`, default `<publicBaseUrl>/discord/callback`) and `statusMessageId`. The handler POSTs the image or text to that URL with `Authorization: Bearer <token>` or `x-callback-token` (never in the query string), sets `replyToMessageId` to the inbound message id and `channelId` to the hop's channel; the bridge then edits the "Working on it." message. Without the real message id and callback URL, the handler can finish and never post.

## Encode (agent-to-agent context)

When handing hop context to another agent or storing callback correlation, use `d:<slug>:<msgId>`, optionally with the thin JSON `{id,g,u,map,a?}` — in agent-to-agent context only, never in Discord `content` or attachment filenames.

## Hop audit (bridge host owns it)

The reference host bridge writes a JSONL audit line per decision (inbound allow/deny, hold, retry, deliver, give_up, callback, attachment). Ids are masked to their last 4 characters; attachment lines carry only count, total bytes and kinds; message text, URLs and keys are never written. These lines belong to the bridge host, not the marketplace MCP; agents do not invent timings or audit entries. Keep the evidence line `callback <status> attachments=N` when available.

## Setup

- File `DISCORD_BRIDGE_CALLBACK_TOKEN` + `DISCORD_BRIDGE_CALLBACK_URL` as Bot Secrets / plugin variables via skill `discord-fleet-callback-setup` (durable env; no host-vault hop required). A host-vault copy of the callback token is an optional legacy fallback only when env is missing.
- Multi-agent fleets: plugin variables only feed MCP on the installing machine. Every agent that receives Discord wakes needs the same Bot Secrets.
- If the token cannot be loaded from env, say so once and tell the bridge operator.

## Ops notes (generic)

- The host bridge is the operator's self-hosted wake host. Reference: `grok-bot-universal-bridge` (Discord adapter); any host bridge that implements this wake and callback contract works.
- Keep any other Discord gateway client off while the bridge owns the mapped Discord bot.
- Plugin-docs maintainers do not do live Discord delivery for mapped agents; each agent self-delivers.
- Bridge-side operator notes (tunnel connector restarts, `--protocol http2` where UDP is blocked, deploy hygiene for host-only config / `registry.json` / `.env`, never `docker compose config` in shared logs): see the plugin README **Bridge operator notes (generic)**.
- Reference host bridge: `grok-bot-universal-bridge`, Discord adapter (mints the wake; callback = `content` and/or allowed attachments).
