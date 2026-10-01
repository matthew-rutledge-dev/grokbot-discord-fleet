# Changelog

## 0.3.6

- Align `discord-fleet-hop-shorthand` with bridge commit `a6a26fb`: inbound wake is exactly `d:<slug>:<msgId>`, thin JSON `{id,g,u,map}`, then human content; the obsolete `[discord-bridge]` compatibility line is removed
- Update README, boundary, and bridge-setup guidance to document the three-line wake shape
- Bump plugin manifests to `0.3.6`

## 0.3.5

- Add skill `discord-fleet-hop-shorthand`: decode/encode short wake envelope (`d:<slug>:<message.id>` + thin JSON `{id,g,u,map}`); Discord OUT is plain `body.content` only; bridge mints, bots decode
- README skills list + brief pointers from `discord-fleet-boundary` and `discord-fleet-bridge-setup`

## 0.3.4

- Skill `discord-fleet-bridge-setup`: document optional durable named Cloudflare Tunnels for self-hosted callback + `sendPrompt` wake, with placeholder hostnames only; keep the loopback bridge private, rotate `CALLBACK_TOKEN`, and retain SSH tunnel notes for `/healthz`
- README: briefly note durable named-tunnel configuration and the public `CALLBACK_BASE_URL` / `GROK_BOT_SENDPROMPT_URL` settings

## 0.3.3

- Marketplace-friendly **plugin variables**: declare `variables` on `.grok-plugin/plugin.json` (and sync root / `.cursor-plugin`); `DISCORD_BOT_TOKEN` required; optional `DISCORD_GUILD_ID`, `DISCORD_BRIDGE_HEALTH_URL`
- Docs: each installer uses **their own** Discord bot token / guild; Matthew vault `DISCORD_FLEET_WAKE` is operator-only — not a shared provider; users are not joining Matthew's Discord/infra
- Skill `discord-fleet-bridge-setup`: prefer plugin vars / vault→runtime env; discourage plaintext `.env` when avoidable; optional self-host for **their** machine/guild
- Skill `discord-fleet-boundary` (+ status): clarify per-installer credentials vs Matthew-operator path

## 0.3.2

- Skill `discord-fleet-bridge-setup`: short Windows vs Linux operator notes (same env vars; SSH/WSL tunnel to servergen1 `127.0.0.1:18083/healthz`; wake path Linux-only; Windows local smoke only; no curl|bash; no secrets in git)

## 0.3.1

- Add skill `discord-fleet-bridge-setup`: operator-driven Discord wake bridge setup (explicit user ask only; not postinstall)
- Document vault key `DISCORD_FLEET_WAKE`, loopback `GET /healthz` on `127.0.0.1:18083`, and plugin env `DISCORD_BRIDGE_HEALTH_URL`
- README: mention new skill; anti-jobs (no curl|bash, no secrets in git, no silent wake merge)

## 0.3.0

- Align to Grok Build / xAI plugin-marketplace conventions
- Add `.grok-plugin/plugin.json` (Grok-canonical manifest)
- Add `.mcp.json` with `${GROK_PLUGIN_ROOT}` paths + env map for `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_BRIDGE_HEALTH_URL`
- Keep Cursor dual-support: `.cursor-plugin/plugin.json` + `mcp.json` with `${CURSOR_PLUGIN_ROOT}`
- README: Grok install paths (`grok plugin install`, local `~/.grok/plugins/`, marketplace PR later); declare Discord API + optional bridge health network endpoints
- No secrets; guild id remains a placeholder via env / plugin variables

## 0.2.0

- Wire real manage/status: Discord REST reads + optional bridge `GET /healthz`
- Status: `fleet_health`, `list_channel_map` (replaces stub tools)
- Manage: keep `describe_manage_boundary` + dry-run `plan_channel_binding`; add `inspect_guild` and `resolve_channel` (require `confirm=true`)
- `mcp.json` uses `${CURSOR_PLUGIN_ROOT}`; plugin variables for `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_BRIDGE_HEALTH_URL`
- Docs/skills updated; still no wake / sendPrompt / secrets in git

## 0.1.0

- Initial local scaffold: plugin manifest, MCP stubs (status + manage), three skills

## Unreleased

- BACKLOG: GovInfo / api.data.gov MCP marketplace add-on candidate (vaulted key; no ad-hoc wire)
