---
name: discord-fleet-callback-setup
description: use when installer wants wake dual-deliver / self-callback without host vault, or after plugin install when bridge callback is configured
---

# Discord fleet callback setup

## When to use

- Installer wants **wake dual-deliver / self-callback** without a host vault hop
- After plugin install when a self-hosted bridge callback is configured
- Operator explicitly asks to file callback token/URL for agent replies to Discord

This is a **first-class setup step**, not docs-only. It is **operator-driven** — never run as silent postinstall.

## Bot create first

If the Discord application / bot / invite are not set up yet, follow the plugin README section **Discord bot token & invite** (Developer Portal → token → intents → OAuth2 invite). This skill only files callback token + URL after a self-hosted bridge exists.

## Hard rules

- Do **not** run this skill silently on marketplace install or as a postinstall hook.
- Do **not** paste tokens into chat. Use the secure secret card / Bot Secrets UI.
- Do **not** commit secret values or real operator hostnames. Docs use placeholders only (e.g. `https://callback.example.com/callback`).
- Do **not** echo token values in evidence lines.
- Do **not** auto-deploy the bridge from this skill.

## Steps (operator-driven)

### a. Confirm self-hosted bridge

Confirm they run a **self-hosted** wake bridge (`matthew-rutledge-dev/grok-bot-discord-bridge` or equivalent) with `CALLBACK_TOKEN` configured on the bridge process. If they only need Discord REST status/manage, skip callback setup.

### b. Save callback token (secret)

Ask them to save Bot Secret (or plugin variable) **`DISCORD_BRIDGE_CALLBACK_TOKEN`** via the **secure secret card** — never paste the value in chat. This is the same secret the bridge uses as `CALLBACK_TOKEN`. Prefer **`Authorization: Bearer`** or **`x-callback-token`** headers on `POST /callback` (query `?token=` is being removed on the bridge next release).

### c. Save callback URL

Ask for **`DISCORD_BRIDGE_CALLBACK_URL`** — full callback URL or base ending in `/callback` for **their** bridge. Non-secret URL is OK as a plugin variable or secret. Placeholder shape only in examples: `https://callback.example.com/callback`. Never ship real operator hosts as defaults.

### d. Verify env names (no values)

Check that the env names exist **without printing values**:

```bash
test -n "$DISCORD_BRIDGE_CALLBACK_TOKEN" && echo "token_set=yes" || echo "token_set=no"
test -n "$DISCORD_BRIDGE_CALLBACK_URL" && echo "url_set=yes" || echo "url_set=no"
```

Report **present/missing only**. Never `echo` the token or URL contents into chat if the URL embeds credentials (prefer URL as non-secret host path).

### e. Smoke (when URL + token present)

Prefer a documented safe probe. If the bridge has no dry-run, use a clearly labeled test **only with user yes**; otherwise verify **401 vs connection reachability** carefully.

Preferred probe (never echo token):

```bash
URL="$DISCORD_BRIDGE_CALLBACK_URL"
# Normalize: if URL does not end with /callback, append it
case "$URL" in
  */callback) ;;
  */) URL="${URL}callback" ;;
  *) URL="${URL%/}/callback" ;;
esac
TOKEN="$DISCORD_BRIDGE_CALLBACK_TOKEN"
code=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channelId":"0","content":""}')
echo "callback_setup http=$code token_set=yes url_set=yes"
```

Interpret:

| Result | Meaning |
|--------|---------|
| **401** | Token rejected (wrong/missing token, or auth path reached) |
| **400** | Token accepted path reached with bad body (probe body is intentionally invalid) |
| Connection fail / empty / 000 | URL wrong, tunnel down, or host unreachable |
| **2xx** | Unexpected for this minimal probe — note status; do not invent success semantics |

Evidence line shape: `callback_setup http=<code> token_set=yes|no url_set=yes|no`. Never echo the token.

### f. Multi-agent fleets

Plugin variables alone feed MCP on the **installing machine**. Dual-deliver runs as the **woken agent**, so **each mapped agent** must have the same Bot Secrets filed:

**Grok Bot → that Bot → Secrets** — file `DISCORD_BRIDGE_CALLBACK_TOKEN` and `DISCORD_BRIDGE_CALLBACK_URL` on every agent that receives Discord wakes.

Without per-bot Secrets, self-callback will fail even if the installing host has plugin vars set.

## Related

- Boundary: skill `discord-fleet-boundary`
- Bridge bring-up: skill `discord-fleet-bridge-setup` (run callback-setup after the bridge is up)
- Dual-deliver / hop: skill `discord-fleet-hop-shorthand` (prefer `process.env.DISCORD_BRIDGE_CALLBACK_TOKEN` + `DISCORD_BRIDGE_CALLBACK_URL`)
- Bridge SoT: [matthew-rutledge-dev/grok-bot-discord-bridge](https://github.com/matthew-rutledge-dev/grok-bot-discord-bridge)
