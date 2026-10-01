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
2. **Thin JSON (second line):** `{id,g,u,map}`
   - `id` — same hop code as line 1 (`d:<slug>:<msgId>`)
   - `g` — guild id (or `null` for DMs)
   - `u` — author user id
   - `map` — agent alias (guild: channel-map `alias`; DM: `security.dm.alias` or agent id)
3. **Human content (third line):** cleaned Discord message text

Example shape (placeholders only):

```text
d:ai-gen-chat:1234567890123456789
{"id":"d:ai-gen-chat:1234567890123456789","g":"1111111111111111111","u":"222222222222222222","map":"<your-agent-alias>"}
hello from Discord
```

Placeholders only in docs/examples (`ai-gen-chat`, `discord-bot-infra`, fake snowflakes). No real operator hostnames, tokens, or cdccentral URLs.

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

Strip `d:` + JSON from the visible Grok chat after absorb — same as guild. Discord OUT is still plain `body.content` only (never hop codes), via the same `POST /callback` (no separate `send_dm` in this plugin).

## Discord OUT (hard rule)

- Callback / channel reply body = **plain `body.content` only**
- **NEVER** put hop codes (`d:…`) or thin JSON into Discord channel or DM replies
- **NEVER** leave hop codes or thin JSON visible in the Grok agent chat after absorb — human line only
- Humans see natural language only

## Decode + absorb (hard rule)

1. Read first line; if it matches `d:<slug>:<msgId>`, treat as hop id
2. Expand `slug`: for guild, via the operator's channel-map (`slug` → channel / agent binding). For DMs (`slug` often `dm`, `g` null), do **not** expect a guild channel-map row — agent comes from bridge `security.dm.defaultAgentId`; prefer thin JSON `map` when present for alias context
3. Use `msgId` for reply targeting / thread context on the bridge callback path
4. Parse thin JSON for `g` / `u` / `map` into **internal context only** — the bot already has the bits after this step
5. Use the third line, human content, as the user ask
6. **Rewrite / present the inbound turn in the visible Grok human transcript as ONLY that human message content** (e.g. `Not much you`). After absorb, **strip** the `d:<slug>:<msgId>` line and thin JSON block from what the human (and agent chat UI) sees — do not leave the short id + JSON envelope visible
7. Complete both delivery paths below; Grok-chat-only is incomplete

Internal hop fields stay in agent context for callback threading. They are not re-echoed into the chat transcript or Discord.

## Dual delivery (hard rule)

After decoding a short hop, the agent **MUST** reply through the bridge `CALLBACK` to Discord, using the triggering hop for reply/thread targeting and a plain `body.content` string. For DMs, `channelId` is the DM channel snowflake (wake metadata `discordChannelId`) — same callback contract as guild. The agent **MAY ALSO** reply in Grok chat, but a Grok-chat reply does not replace the Discord callback. If the callback cannot be completed, report the delivery failure rather than treating chat-only output as complete.

- **Required:** bridge `CALLBACK` → Discord, with natural-language text in plain `body.content` only
- **Optional:** Grok chat reply
- **Incomplete:** Grok chat reply without the Discord callback

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
