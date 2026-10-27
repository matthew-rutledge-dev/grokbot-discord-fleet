---
name: discord-bridge-dual-deliver
description: Use when a Discord bridge wake arrives (last line "⟂ d:<slug>:<msgId> …" or first line d:<slug>:<msgId>) — decode it, then POST the reply to the host bridge Discord callback. A Discord wake loads only this skill.
---
# Discord bridge dual-deliver (wake path)

A Discord wake loads **only this skill** — no other hop skills.

## Decode (two formats)
- **Compact** (default; the only format the reference host bridge sends): last line is the trailer `⟂ d:<slug>:<msgId> u=… c=… [g=…] [map=…] [a=<url>]…` — regex `^⟂ d:(\S+):(\d+)((?: [a-z]+=\S*)*)$`. `u` user id (always), `c` channel id (always, DMs too), `g` guild (absent = DM), `map` alias (percent-decode only this), `a` CDN URL (repeats, as-is); ignore unknown keys. The ask is the text after the header colon of `Discord DM from <label>: …` / `Discord #<channel> from <label>: …` (may span lines, up to the trailer). Label is display only; `u` is the authority.
- **Legacy** (older host bridges; `d:` first line): line 2 thin JSON `{id,g,u,map,un?,dn?,lb?,c?,a?}`, line 3 the ask. `a` = `[{url,…}]`.
- Fetch `a` URLs promptly (they expire); compact has no filename/type, so infer from URL or download. Show only the ask in Grok chat.

## Deliver (required; chat-only is incomplete)
`POST` JSON to `process.env.DISCORD_BRIDGE_CALLBACK_URL` — the full callback URL (reference host bridge path: `/discord/callback`; if only a base URL is set, append `/discord/callback`). Headers:
- `Authorization: Bearer $DISCORD_BRIDGE_CALLBACK_TOKEN` (or `x-callback-token`); never `?token=` (refused); never print the token
- `Content-Type: application/json`
- `User-Agent: grok-bot-bridge-client/1.0` (any explicit non-default UA) — default UAs get Cloudflare 1010

Body (`msgId` → `replyToMessageId`; `c` → `channelId`, guild **and** DM):
- `{"channelId":"<c>","content":"…","replyToMessageId":"<msgId>"}`
- Optional `attachments` (see `reference.md`).

Never paste the trailer, `d:` line or JSON into Discord. Self-callback only: never ask another agent to deliver, never post via Discord REST. Evidence line: `callback <status> attachments=N`.

## Errors
| Code | Fix |
|---|---|
| 403 `error code: 1010` | Edge block; set the User-Agent, retry once |
| 401 | Wrong/missing token; check env |
| 400 `?token=` / `channelId required` | Use the header; send `channelId` = trailer `c` (DMs too) |
| 403 `channel_not_allowlisted` | Reply only to the wake's own channel (`c`) |
| 404 | Wrong path; use `/discord/callback` |
| 503 `callback_disabled` | Bridge has no callback token configured; tell the operator |
| 502 / 1033 (edge page) | Tunnel to the bridge host is down |

Attachments, MIME list, setup and ops: read `reference.md` in this folder **only** on an error or during setup.
