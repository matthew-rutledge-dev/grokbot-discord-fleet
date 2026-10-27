---
name: discord-fleet-hop-shorthand
description: use only when encoding a Discord hop id (d:<slug>:<msgId>) for another agent or for callback correlation. Not for inbound Discord wakes — those load skill discord-bridge-dual-deliver only.
---

# Discord fleet hop shorthand (encode)

**Inbound Discord wakes do not use this skill.** Decode and delivery live in skill `discord-bridge-dual-deliver` (`SKILL.md` for the wake path, `reference.md` for the full envelope spec, Guild vs DM routing, MIME list, timing, and errors).

## Encode (if an agent must pass context)

When handing hop context to another agent or storing callback correlation, use the same form the bridge mints:

```text
d:<slug>:<msgId>
```

Optionally keep thin JSON `{id,g,u,map,a?}` in **agent-to-agent** context only — never in Discord `content` / attachment filenames as hop dumps, and never visible in Grok chat after absorb.

Placeholders only in docs/examples (`example-chat`, fake snowflakes). No real operator hostnames, tokens, or private URLs.

## Related

- Wake decode + dual delivery: skill `discord-bridge-dual-deliver`
- Boundary: skill `discord-fleet-boundary`
- Bridge setup / channel-map: skill `discord-fleet-bridge-setup`
- Callback token/URL setup: skill `discord-fleet-callback-setup`
- Reference host bridge: `grok-bot-universal-bridge` (Discord adapter), or any compatible host bridge
