---
name: discord-bridge-dual-deliver
description: Use when a Discord bridge wake arrives (first line d:<slug>:<msgId>, or a Discord DM/#channel wake line) — decode it, then POST the reply to the bridge /callback. A Discord wake loads only this skill.
---
# Discord bridge dual-deliver (wake path)

A Discord wake loads **only this skill** — no other hop skills.

## Decode
- Legacy wake: line 1 `d:<slug>:<msgId>` (`slug` `dm` for DMs), line 2 thin JSON `{id,g,u,map,un?,dn?,lb?,c?,a?}`, line 3 human text (may be empty if `a` is set). `g` guild (`null` in DMs), `u` sender id, `un`/`dn`/`lb` username/display name/label (any may be missing), `c` channel id (optional, DMs too), `a` Discord CDN refs `[{url,filename?,contentType?,size?}]` — fetch promptly, they expire.
- Human wake format (bridge 0.2.14+): a readable text line with routing in sendPrompt metadata or one compact trailing line. Both formats are supported once that bridge ships; take routing from whichever is present.
- Show only the human text in Grok chat. Never put hop codes or JSON in Discord.

## Deliver (required; chat-only is incomplete)
`POST` to `process.env.DISCORD_BRIDGE_CALLBACK_URL` (normalize to end in `/callback`). Headers:
- `Authorization: Bearer $DISCORD_BRIDGE_CALLBACK_TOKEN` (or `x-callback-token`); never `?token=` (401); never print the token
- `Content-Type: application/json` (or multipart)
- `User-Agent: grok-bot-discord-bridge-client/1.0` — default UAs get Cloudflare 1010

Body:
- Channel: `{"channelId":"<c>","content":"…","agentId":"<you>","replyToMessageId":"<msgId>"}`
- DM: `{"userId":"<u>","content":"…","agentId":"<you>","replyToMessageId":"<msgId>"}` — omit `channelId`

Self-callback only: never ask another agent to deliver, never post via Discord REST. Evidence line: `callback <status> attachments=N`.

## Errors
| Code | Fix |
|---|---|
| 403 `error code: 1010` | Edge block; set the User-Agent, retry once |
| 401 | Wrong/missing token; check env |
| 400 `channelId_required` | DM sent without `userId` |
| 502 / 1033 | sendPrompt tunnel down (bridge host) |

Attachments, MIME list, timing, setup and ops: read `reference.md` in this folder **only** on an error or during setup.
