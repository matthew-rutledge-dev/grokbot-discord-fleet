---
name: discord-fleet-hop-shorthand
description: use this when Discord wake inbound hits a Grok bot, or when preparing callback context — decode/encode short hop ids (d:<slug>:<message.id>)
---

# Discord fleet hop shorthand

## When to use

- Discord wake inbound to a Grok bot (decode the short envelope the bridge minted)
- Preparing callback / reply context (encode or keep the hop id for threading — never dump it into Discord channel text)

**Bridge mints; this skill decodes for bots.** The wake bridge (`grok-bot-discord-bridge`) builds the inbound prompt. Grok bots use this skill to expand hop ids and keep Discord OUT clean.

## Spec (match bridge)

Inbound wake prompt lines (in order):

1. **First line — hop id:** `d:<slug>:<message.id>`
   - `slug` = stable channel-map short name (e.g. `ai-gen-chat`, `discord-bot-infra`)
   - `message.id` = Discord snowflake of the triggering message (for reply / thread)
2. **Thin JSON (second line):** `{id,g,u,map}`
   - `id` — same hop code as line 1 (`d:<slug>:<message.id>`)
   - `g` — guild id (or `null` for DMs)
   - `u` — author user id
   - `map` — agent alias from channel-map (`alias` field)
3. **Legacy compat line (optional):** `[discord-bridge] from=… guild=… channel=… msg=…`
   - May still be present for older consumers — **ignore for humans**, keep for compat when re-forwarding context
4. **Human content** follows (cleaned Discord message text)

Example shape (placeholders only):

```text
d:ai-gen-chat:1234567890123456789
{"id":"d:ai-gen-chat:1234567890123456789","g":"1111111111111111111","u":"222222222222222222","map":"Rimuru_orch"}
[discord-bridge] from=222222222222222222 (user#0000) guild=1111111111111111111 channel=333333333333333333 msg=1234567890123456789
hello from Discord
```

Placeholders only in docs/examples (`ai-gen-chat`, `discord-bot-infra`, fake snowflakes). No real operator hostnames, tokens, or cdccentral URLs.

## Discord OUT (hard rule)

- Callback / channel reply body = **plain `body.content` only**
- **NEVER** put hop codes (`d:…`), thin JSON, or `[discord-bridge]` lines into Discord channel replies
- Humans see natural language only

## Decode

1. Read first line; if it matches `d:<slug>:<messageId>`, treat as hop id
2. Expand `slug` via the operator's channel-map (`slug` → channel / agent binding). Prefer map `alias` / `agentId` from thin JSON `map` when present
3. Use `messageId` for reply targeting / thread context on the bridge callback path
4. Parse thin JSON for `g` / `u` / `map` if needed internally — **do not** dump the full envelope into Discord
5. Skip the `[discord-bridge]` line for human-facing summaries; use human content lines as the user ask

## Encode (if an agent must pass context)

When handing hop context to another agent or storing callback correlation, use the same form:

```text
d:<slug>:<msgId>
```

Optionally keep thin JSON `{id,g,u,map}` in **agent-to-agent** context only — never in Discord `body.content`.

## Related

- Boundary: skill `discord-fleet-boundary`
- Bridge setup / channel-map: skill `discord-fleet-bridge-setup`
- Bridge SoT: [matthew-rutledge-dev/grok-bot-discord-bridge](https://github.com/matthew-rutledge-dev/grok-bot-discord-bridge) (mint path; callback remains `body.content` only)
