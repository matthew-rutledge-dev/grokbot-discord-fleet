# Changelog

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
