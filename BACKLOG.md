# Backlog — grokbot-discord-fleet

Local-only until Matthew says push. No secrets in this file.

## Marketplace / connector add-ons (candidates)

### GovInfo / api.data.gov MCP
- **Status:** todo (not started)
- **Ask:** marketplace/plugin-style add-on on the Discord fleet connector track — not ad-hoc `AddMcpServer` on the Cursor account (Matthew skipped that).
- **MCP endpoint:** `https://api.govinfo.gov/mcp`
- **Auth:** header `x-api-key` = api.data.gov key (vaulted; never paste in chat/git)
- **Vault (Diablo / infra):** title `api.data.gov / GovInfo`; url `https://api.data.gov`; mcp `https://api.govinfo.gov/mcp`; accessors `Get-InfraSecret GOVINFO` / `Get-InfraApiKey` (`api_key`). Canonical on servergen1 + Windows replica.
- **Signup:** done for `Matthew.Rutledge@cdccentral.com` (free api.data.gov key)
- **Owners:** Plug_discord owns marketplace add-on scaffold/wire plan; Shion_career does **not** own the MCP wire (career/resume only). Pull key via vault when wiring.
- **Source:** handoff 2026-09-30 via Shion_career

## Done locally (scaffold)
- Plugin layout + Discord manage/status MCP stubs + boundary/status/manage skills under `~/.cursor/plugins/local/grokbot-discord-fleet/`
- Not pushed to `matthew-rutledge-dev/grokbot-discord-fleet` yet (Matthew: leave local until done)
