# Changelog

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
