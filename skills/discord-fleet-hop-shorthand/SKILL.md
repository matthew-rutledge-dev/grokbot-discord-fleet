---
name: discord-fleet-hop-shorthand
description: use this when Discord wake inbound hits a Grok bot, or when preparing callback context — decode/encode short hop ids (d:<slug>:<msgId>); after absorb, show only human content in Grok chat
---

# Discord fleet hop shorthand

## When to use

- Discord wake inbound to a Grok bot (decode the short envelope the bridge minted, then show only human content in chat)
- Preparing callback / reply context (encode or keep the hop id for threading — never dump it into Discord channel text)

**Bridge mints; this skill decodes for bots.** The wake bridge (`grok-bot-discord-bridge`) builds the inbound prompt. Grok bots use this skill to expand hop ids and keep Discord OUT clean.

## Spec (match bridge)

Inbound wake prompt is exactly three lines (in order):

1. **First line — hop id:** `d:<slug>:<msgId>`
   - `slug` = guild channel-map short name (e.g. `ai-gen-chat`) or DM default `dm`
   - `msgId` = Discord snowflake of the triggering message (for reply / thread)
2. **Thin JSON (second line):** `{id,g,u,map}` plus optional `a`
   - `id` — same hop code as line 1 (`d:<slug>:<msgId>`)
   - `g` — guild id (or `null` for DMs)
   - `u` — author user id
   - `map` — agent alias (guild: channel-map `alias`; DM: `security.dm.alias` or agent id)
   - `a` — optional array of Discord CDN attachment refs (not base64): `[{url, filename?, contentType?, size?}]`. Same refs may appear on `sendPrompt` `metadata.attachments`. CDN URLs expire — fetch promptly if you need the bytes. Attachment-only wakes (empty/missing human line) are OK; text-only wakes omit `a`.
3. **Human content (third line):** cleaned Discord message text (may be empty when the wake is attachment-only)

Example shape (placeholders only):

```text
d:ai-gen-chat:1234567890123456789
{"id":"d:ai-gen-chat:1234567890123456789","g":"1111111111111111111","u":"222222222222222222","map":"<your-agent-alias>"}
hello from Discord
```

Example with optional inbound media refs (placeholders only; CDN host is Discord's):

```text
d:ai-gen-chat:1234567890123456789
{"id":"d:ai-gen-chat:1234567890123456789","g":"1111111111111111111","u":"222222222222222222","map":"<your-agent-alias>","a":[{"url":"https://cdn.discordapp.com/attachments/111/222/shot.png","filename":"shot.png","contentType":"image/png","size":12345}]}
look at this
```

Placeholders only in docs/examples (`ai-gen-chat`, `discord-bot-infra`, fake snowflakes). No real operator hostnames, tokens, or private URLs.

### Guild vs DM

| | Guild | DM |
|---|-------|----|
| Slug | Channel-map `slug` (e.g. `ai-gen-chat`) | Default `dm`, or `security.dm.slug` on the bridge |
| `g` in thin JSON | Guild snowflake | `null` |
| Agent routing | Channel-map row `agentId` / `alias` | Bridge `security.dm.defaultAgentId` (channel-map does **not** apply) |
| Callback `channelId` | Guild channel snowflake | DM channel snowflake from wake metadata `discordChannelId` |

Example DM shape (placeholders only):

```text
d:dm:1234567890123456789
{"id":"d:dm:1234567890123456789","g":null,"u":"222222222222222222","map":"<your-dm-agent-alias-or-id>"}
hello from a DM
```

Strip `d:` + JSON from the visible Grok chat after absorb — same as guild. Discord OUT is human text and/or allowed attachments (never hop codes), via the same `POST /callback` (no separate `send_dm` in this plugin).

## Discord OUT (hard rule)

- Callback / channel reply = **human text** (`content`) and/or **allowed attachments** — never hop metadata
- Callback MIME allowlist (bridge `48e6b699ef39273d23f4bf70b7a4299989b34f9e`): `application/gzip`, `application/javascript`, `application/json`, `application/msword`, `application/pdf`, `application/rtf`, `application/tar`, `application/vnd.rar`, `application/vnd.ms-excel`, `application/vnd.ms-powerpoint`, `application/vnd.oasis.opendocument.presentation`, `application/vnd.oasis.opendocument.spreadsheet`, `application/vnd.oasis.opendocument.text`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/zip`, `application/x-7z-compressed`, `application/x-gzip`, `application/x-gtar`, `application/x-powershell`, `application/x-python`, `application/x-rar-compressed`, `application/x-sh`, `application/x-tar`, `application/x-yaml`, `application/xml`, `audio/mpeg`, `audio/ogg`, `audio/wav`, `image/gif`, `image/jpeg`, `image/png`, `image/webp`, `text/css`, `text/csv`, `text/html`, `text/javascript`, `text/markdown`, `text/plain`, `text/tab-separated-values`, `text/x-powershell`, `text/x-python`, `text/x-shellscript`, `text/xml`, `text/yaml`, `video/mp4`, `video/webm`. When `contentType` is missing or `application/octet-stream`, filename fallback also recognizes the existing media/PDF/text mappings plus `.md`, `.json`, `.xml`, `.yml`, `.yaml`, `.py`, `.ps1`, `.sh`, `.bash`, `.csv`, `.tsv`, `.html`, `.css`, `.js`, `.ts` (mapped to `text/plain`), `.docx`, `.xlsx`, `.pptx`, `.doc`, `.xls`, `.ppt`, `.odt`, `.ods`, `.odp`, `.rtf`, `.zip`, `.tar`, `.gz`, `.tgz`, `.7z`, and `.rar` (`.zip` → `application/zip`, `.tar` → `application/x-tar` / `application/tar`, `.gz` and `.tar.gz` → `application/gzip`, `.tgz` → `application/x-gtar`, `.7z` → `application/x-7z-compressed`, `.rar` → `application/vnd.rar` / `application/x-rar-compressed`). Archives/executables/disk images (`.exe`, `.msi`, `.dmg`, `.iso`, `.appimage`) are otherwise denied; unsupported values return **415**.
- `content` is optional when the callback includes ≥1 attachment (see bridge `/callback` media contract)
- **NEVER** put hop codes (`d:…`) or thin JSON into Discord channel or DM replies
- **NEVER** leave hop codes or thin JSON visible in the Grok agent chat after absorb — human line only (attachment refs stay in internal context; fetch CDN URLs promptly if needed)
- Humans see natural language and/or media only

## Decode + absorb (hard rule)

1. Read first line; if it matches `d:<slug>:<msgId>`, treat as hop id
2. Expand `slug`: for guild, via the operator's channel-map (`slug` → channel / agent binding). For DMs (`slug` often `dm`, `g` null), do **not** expect a guild channel-map row — agent comes from bridge `security.dm.defaultAgentId`; prefer thin JSON `map` when present for alias context
3. Use `msgId` for reply targeting / thread context on the bridge callback path
4. Parse thin JSON for `g` / `u` / `map` into **internal context only** — the bot already has the bits after this step
5. Use the third line, human content, as the user ask (if empty and `a` is present, treat as attachment-only wake)
6. Parse optional `a` (CDN URL refs) into **internal context** — fetch promptly if you need bytes; do not dump raw CDN URLs or hop JSON into Discord OUT
7. **Rewrite / present the inbound turn in the visible Grok human transcript as ONLY that human message content** (e.g. `Not much you`). After absorb, **strip** the `d:<slug>:<msgId>` line and thin JSON block from what the human (and agent chat UI) sees — do not leave the short id + JSON envelope visible
8. Complete both delivery paths below; Grok-chat-only is incomplete

Internal hop fields stay in agent context for callback threading. They are not re-echoed into the chat transcript or Discord.

## Bridge hop timing (host-side)

The bridge may emit one `[timing] key=val …` line per hop stage for bottleneck diagnosis: `authz`, `build_wake`, `sendPrompt`, `callback_auth`, `callback_resolve`, `callback_deliver`, and `callback_total`. Fields include `stage`, `msg`, `hop=d:<slug>:<id>`, `ms`, `ok`, `attachments`, `chunks`, and optional `idle_ms` (from `sendPrompt` acceptance to callback via `replyToMessageId`). These lines belong to the bridge host, not the marketplace MCP; agents do not invent timings. Keep the normal callback evidence line, such as `callback <status> attachments=N`, when available.

## Dual delivery (hard rule)

After decoding a short hop, the agent **MUST** reply through the bridge `CALLBACK` to Discord, using the triggering hop for reply/thread targeting. Body may be plain `content`, allowed `attachments` (JSON base64/url or multipart files), or both (`content` optional when ≥1 attachment). For DMs, `channelId` is the DM channel snowflake (wake metadata `discordChannelId`) — same callback contract as guild. The agent **MAY ALSO** reply in Grok chat, but a Grok-chat reply does not replace the Discord callback. If the callback cannot be completed, report the delivery failure rather than treating chat-only output as complete.

- **Required:** bridge `CALLBACK` → Discord (human text and/or allowed attachments; never hop codes)
- **Optional:** Grok chat reply
- **Incomplete:** Grok chat reply without the Discord callback

### Credentials for self-callback

Prefer durable env (Bot Secrets / plugin vars) — **do not require a host-vault hop**:

- `process.env.DISCORD_BRIDGE_CALLBACK_TOKEN` — Bearer for `POST /callback`
- `process.env.DISCORD_BRIDGE_CALLBACK_URL` — full URL or base ending in `/callback`

File these via skill `discord-fleet-callback-setup`. **Never ask another agent** to deliver the Discord reply — self-callback only. A host vault `DISCORD_BRIDGE.callback_token` is optional legacy fallback only when env is missing.

## Encode (if an agent must pass context)

When handing hop context to another agent or storing callback correlation, use the same form:

```text
d:<slug>:<msgId>
```

Optionally keep thin JSON `{id,g,u,map,a?}` in **agent-to-agent** context only — never in Discord `content` / attachment filenames as hop dumps.

## Related

- Boundary: skill `discord-fleet-boundary`
- Bridge setup / channel-map: skill `discord-fleet-bridge-setup`
- Callback token/URL setup: skill `discord-fleet-callback-setup`
- Bridge SoT: [matthew-rutledge-dev/grok-bot-discord-bridge](https://github.com/matthew-rutledge-dev/grok-bot-discord-bridge) (mint path; callback = `content` and/or allowed attachments)
